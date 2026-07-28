import type { Metadata } from "next";

import { LoginForm } from "@/components/admin/login-form";
import { siteConfig } from "@/site.config";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/**
 * The only unauthenticated route under `/admin`.
 *
 * There is deliberately no sign-up, password reset or account creation flow
 * anywhere in the application (§8) — the single admin identity comes from
 * environment variables.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {siteConfig.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Sign in to manage posts
          </p>
        </div>

        <LoginForm
          callbackUrl={sanitizeCallbackUrl(callbackUrl)}
          initialError={error}
        />
      </div>
    </div>
  );
}

/**
 * Only same-origin admin paths are accepted as a post-login destination —
 * an attacker-supplied `callbackUrl` must not become an open redirect.
 */
function sanitizeCallbackUrl(value: string | undefined): string {
  if (!value) return "/admin";
  if (!value.startsWith("/admin")) return "/admin";
  if (value.startsWith("//")) return "/admin";
  if (value.startsWith("/admin/login")) return "/admin";
  return value;
}
