import "server-only";

interface Bucket {
  count: number;
  /** Epoch ms when this bucket resets. */
  resetAt: number;
  /** Epoch ms until which the key is locked out. */
  blockedUntil: number;
}

const buckets = new Map<string, Bucket>();

/** Drop expired buckets so a hostile IP range cannot grow the map forever. */
function sweep(now: number): void {
  if (buckets.size < 512) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now && bucket.blockedUntil < now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the caller may retry; `0` when not limited. */
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  /** Attempts allowed inside the window. */
  limit: number;
  /** Rolling window length in milliseconds. */
  windowMs: number;
  /** Lockout applied once the limit is hit. */
  blockMs: number;
}

/**
 * In-memory fixed-window throttle.
 *
 * Adequate precisely because this app has **one** user: the only thing it needs
 * to stop is password guessing against a single login form. It is per-instance,
 * so a serverless platform that scales out weakens it proportionally — for a
 * single-admin blog that trade-off is deliberate and keeps the zero-cost
 * constraint (no Redis, no Upstash, no Edge Config required).
 */
export function checkRateLimit(
  key: string,
  { limit, windowMs, blockMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);

  if (bucket && bucket.blockedUntil > now) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000),
    };
  }

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs, blockedUntil: 0 });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;

  if (bucket.count > limit) {
    bucket.blockedUntil = now + blockMs;
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(blockMs / 1000),
    };
  }

  return { ok: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

/** Clear a key's counter — called after a successful login. */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Best-effort client identity from proxy headers. */
export function clientKey(headers: Headers, prefix: string): string {
  const forwarded = headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
  return `${prefix}:${ip}`;
}

export const LOGIN_RATE_LIMIT: RateLimitOptions = {
  limit: 5,
  windowMs: 10 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
};

export const WRITE_RATE_LIMIT: RateLimitOptions = {
  limit: 30,
  windowMs: 60 * 1000,
  blockMs: 60 * 1000,
};
