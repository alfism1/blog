import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";

/**
 * Route protection for `/admin/*`.
 *
 * Next.js 16 renamed `middleware.ts` to `proxy.ts` and defaults it to the
 * Node.js runtime, so the full Auth.js config (bcrypt included) can be imported
 * here directly — the split edge-safe config that v15 required is unnecessary.
 *
 * This is the outer gate. Every admin page and API route re-checks the session
 * server-side as well: a proxy alone must never be the only authorisation
 * boundary (§9).
 */
export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isLoginPage = pathname === "/admin/login";
  const session = await auth();
  const isSignedIn = Boolean(session?.user);

  if (isLoginPage) {
    // Already signed in? Skip the form.
    if (isSignedIn) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (!isSignedIn) {
    const loginUrl = new URL("/admin/login", request.url);
    // Preserve the destination so login can bounce the admin back to it.
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Only admin pages. API routes under /api/admin do their own session check so
  // they can return JSON 401s rather than an HTML redirect.
  matcher: ["/admin/:path*"],
};
