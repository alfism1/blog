"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertCircleIcon, LoaderCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Auth.js surfaces the `code` from our CredentialsSignin subclasses here. */
/**
 * These strings ship in the public client bundle, so they stay deliberately
 * vague about server configuration — naming the exact environment variables
 * here would enumerate them for anyone who reads the bundle. `lib/auth.ts`
 * logs the precise, actionable diagnosis to the server console instead.
 */
const ERROR_MESSAGES: Record<string, string> = {
  credentials: "Incorrect username or password.",
  throttled:
    "Too many failed attempts. Wait a few minutes before trying again.",
  not_configured:
    "Sign-in is not available: the server is missing its admin configuration. Check the server logs for details.",
  CredentialsSignin: "Incorrect username or password.",
  Configuration:
    "Sign-in is misconfigured on the server. Check the server logs for details.",
};

function messageFor(code: string | undefined): string | null {
  if (!code) return null;
  return ERROR_MESSAGES[code] ?? "Sign in failed. Please try again.";
}

export function LoginForm({
  callbackUrl,
  initialError,
}: {
  callbackUrl: string;
  initialError?: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(
    messageFor(initialError),
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);

    try {
      // `redirect: false` keeps the error on this page instead of bouncing
      // through /api/auth/error and losing what the user typed.
      const result = await signIn("credentials", {
        username: String(formData.get("username") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirect: false,
      });

      if (!result || result.error) {
        setError(messageFor(result?.code ?? result?.error ?? "credentials"));
        setIsPending(false);
        return;
      }

      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection.");
      setIsPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          {error ? (
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/8 text-destructive flex items-start gap-2 rounded-md border p-3 text-sm"
            >
              <AlertCircleIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              autoFocus
              disabled={isPending}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={isPending}
            />
          </div>

          <Button type="submit" disabled={isPending} className="mt-2">
            {isPending ? (
              <>
                <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
