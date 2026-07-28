import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { siteConfig } from "@/site.config";

/**
 * Public navigation.
 *
 * Deliberately contains no link to `/admin` and no auth state — the public
 * bundle must not reveal that an admin surface exists (§10).
 */
export function SiteHeader() {
  return (
    <header className="border-border bg-background/85 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="rounded-sm text-base font-semibold tracking-tight"
        >
          {siteConfig.name}
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:bg-accent text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5 text-sm transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
