import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";

import {
  checkRateLimit,
  clientKey,
  LOGIN_RATE_LIMIT,
  resetRateLimit,
} from "@/lib/rate-limit";

/** 7 days, per §8. */
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const credentialsSchema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(500),
});

/** Distinguishable auth failures so the login form can explain what happened. */
class InvalidCredentials extends CredentialsSignin {
  code = "credentials";
}

class TooManyAttempts extends CredentialsSignin {
  code = "throttled";
}

class NotConfigured extends CredentialsSignin {
  code = "not_configured";
}

/**
 * Constant-time-ish username comparison.
 *
 * `bcrypt.compare` already resists timing analysis on the password, but bailing
 * out early on a wrong username would leak whether the username is correct.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** `$2b$12$` + a 53-character salt+digest. */
const BCRYPT_HASH_PATTERN = /^\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$/;

/**
 * Guard against a silently mangled hash.
 *
 * Next.js runs dotenv **variable expansion** over `.env` files, so the `$2b$`,
 * `$12$` segments of a bcrypt hash are treated as `$VAR` references and expand
 * to nothing — quoting does not prevent it. The stored value then looks like a
 * hash fragment and every login fails as "wrong password", which is a miserable
 * thing to debug. Detecting the shape up front turns that into a precise error.
 *
 * In `.env.local`, escape each dollar sign: `ADMIN_PASSWORD_HASH=\$2b\$12\$...`
 * Values set in the Vercel dashboard are not dotenv-parsed and need no escaping.
 */
function assertUsableHash(hash: string): void {
  if (BCRYPT_HASH_PATTERN.test(hash)) return;

  console.error(
    "[auth] ADMIN_PASSWORD_HASH is not a valid bcrypt hash.\n" +
      `       Got ${hash.length} characters starting with ${JSON.stringify(hash.slice(0, 7))}.\n` +
      "       If this came from a .env file, dotenv variable expansion ate the\n" +
      "       `$` segments. Escape them as \\$ — e.g. \\$2b\\$12\\$... — or run\n" +
      "       `npm run hash-password`, which prints the escaped form for you.",
  );

  throw new NotConfigured();
}

export const authConfig: NextAuthConfig = {
  // JWT sessions: no database adapter, no user table, nothing to host (§8).
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/admin/login", error: "/admin/login" },
  trustHost: true,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials, request) {
        const adminUsername = process.env.ADMIN_USERNAME;
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

        if (!adminUsername || !adminPasswordHash) {
          console.error(
            "[auth] ADMIN_USERNAME and/or ADMIN_PASSWORD_HASH are not set.",
          );
          throw new NotConfigured();
        }

        assertUsableHash(adminPasswordHash);

        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) throw new InvalidCredentials();

        // Throttle by client IP before doing any hashing work (§8).
        const key = clientKey(request.headers, "login");
        const limit = checkRateLimit(key, LOGIN_RATE_LIMIT);
        if (!limit.ok) throw new TooManyAttempts();

        const { username, password } = parsed.data;

        const usernameMatches = safeEqual(username, adminUsername);
        // Always run the hash comparison so a wrong username and a wrong
        // password take the same amount of time.
        const passwordMatches = await compare(password, adminPasswordHash);

        if (!usernameMatches || !passwordMatches) {
          throw new InvalidCredentials();
        }

        resetRateLimit(key);

        return {
          id: "admin",
          name: adminUsername,
          email: `${adminUsername}@local`,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = "admin";
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = "admin";
        session.user.role = (token.role as string) ?? "admin";
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

/** True when the caller holds a valid admin session. */
export async function isAuthenticated(): Promise<boolean> {
  const session = await auth();
  return Boolean(session?.user);
}

export { SESSION_MAX_AGE_SECONDS };
