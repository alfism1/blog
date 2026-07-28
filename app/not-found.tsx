import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you were looking for does not exist.",
  robots: { index: false, follow: true },
};

/**
 * Root 404. Lives outside the `(public)` group so it also catches unmatched
 * top-level URLs, and renders the public chrome itself.
 */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main
        id="main"
        className="flex flex-1 items-center justify-center px-4 py-24"
      >
        <div className="text-center">
          <p className="text-muted-foreground text-sm font-semibold tracking-widest uppercase">
            404
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Page not found
          </h1>
          <p className="text-muted-foreground mx-auto mt-3 max-w-md">
            That link may be broken, or the post may have moved. Try searching
            the archive instead.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className={buttonVariants()}>
              Back home
            </Link>
            <Link
              href="/search"
              className={buttonVariants({ variant: "outline" })}
            >
              Search posts
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
