import type { Metadata } from "next";

import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s — Admin" },
  // Belt and braces alongside robots.txt: the admin panel must never be indexed.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Wrapper for every `/admin/*` route.
 *
 * Session enforcement happens in `proxy.ts` and again in each page/route
 * handler. This layout only supplies chrome, because a layout re-render is not
 * guaranteed on every navigation and must never be the security boundary.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      {children}
      <Toaster />
    </div>
  );
}
