import "server-only";

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { auth } from "@/lib/auth";
import { ContentError } from "@/lib/content/types";
import { flattenIssues } from "@/lib/content/schema";
import { checkRateLimit, clientKey, WRITE_RATE_LIMIT } from "@/lib/rate-limit";

export interface ApiErrorBody {
  error: string;
  /** Field-level messages keyed by dotted path, for form display. */
  fields?: Record<string, string>;
}

export function apiError(
  message: string,
  status: number,
  fields?: Record<string, string>,
): NextResponse<ApiErrorBody> {
  return NextResponse.json<ApiErrorBody>(
    fields ? { error: message, fields } : { error: message },
    { status },
  );
}

/**
 * Re-verify the session inside the route handler.
 *
 * `proxy.ts` already redirects unauthenticated browsers away from `/admin/*`,
 * but API routes are directly reachable and must never trust that check alone
 * (§9). Returns a response to send, or `null` when the caller may proceed.
 */
export async function requireAdmin(
  request: Request,
): Promise<NextResponse<ApiErrorBody> | null> {
  const session = await auth();
  if (!session?.user) {
    return apiError("Not signed in.", 401);
  }

  const limit = checkRateLimit(
    clientKey(request.headers, "admin-write"),
    WRITE_RATE_LIMIT,
  );
  if (!limit.ok) {
    const response = apiError(
      `Too many requests. Retry in ${limit.retryAfterSeconds}s.`,
      429,
    );
    response.headers.set("Retry-After", String(limit.retryAfterSeconds));
    return response;
  }

  return null;
}

/** Turn any thrown value into a useful HTTP response. */
export function handleApiError(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof ZodError) {
    return apiError("Validation failed.", 422, flattenIssues(error));
  }

  if (error instanceof ContentError) {
    return apiError(error.message, error.status);
  }

  if (error instanceof SyntaxError) {
    return apiError("Request body is not valid JSON.", 400);
  }

  console.error("[admin-api] unhandled error", error);
  return apiError(
    "Something went wrong on the server. Check the deployment logs.",
    500,
  );
}

/**
 * Invalidate every cached route a post appears on.
 *
 * With the GitHub adapter the push also triggers a full redeploy, but
 * revalidating here means the currently running deployment stops serving stale
 * HTML immediately rather than waiting ~60s for the new build (§10).
 */
export function revalidatePostRoutes(input: {
  slug: string;
  previousSlug?: string;
  category?: string;
  tags?: string[];
}): void {
  const paths = new Set<string>([
    "/",
    "/topics",
    "/search",
    "/rss.xml",
    "/llms.txt",
    "/sitemap.xml",
    `/blog/${input.slug}`,
  ]);

  if (input.previousSlug && input.previousSlug !== input.slug) {
    paths.add(`/blog/${input.previousSlug}`);
  }

  for (const path of paths) {
    revalidatePath(path);
  }

  // Listing routes are dynamic segments; revalidate the whole subtree so every
  // category/tag/archive page picks the change up.
  revalidatePath("/category/[category]", "page");
  revalidatePath("/tag/[tag]", "page");
  revalidatePath("/page/[page]", "page");
}
