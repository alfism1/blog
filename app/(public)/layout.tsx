import { Analytics } from "@vercel/analytics/next";

import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";

/**
 * Shell for every public, unauthenticated page.
 *
 * Nothing here imports auth, the content adapter's write path, or any admin
 * component, so none of that reaches the public client bundle (§10).
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a
        href="#main"
        className="bg-background border-border focus:ring-ring sr-only rounded-md border px-4 py-2 text-sm focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:ring-2"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      {/*
        Vercel Web Analytics. Mounted here rather than in the root layout so
        `/admin/*` traffic — draft slugs and all — never leaves the browser.
        The script only loads on Vercel deployments; locally it no-ops.
      */}
      <Analytics />
    </>
  );
}
