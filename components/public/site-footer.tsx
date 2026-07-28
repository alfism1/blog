import Link from "next/link";

import { siteConfig } from "@/site.config";

export function SiteFooter() {
  return (
    <footer className="border-border mt-16 border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>{siteConfig.copyright}</p>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-4">
          <Link href="/topics" className="hover:text-foreground transition-colors">
            Topics
          </Link>
          <Link href="/search" className="hover:text-foreground transition-colors">
            Search
          </Link>
          <a href="/rss.xml" className="hover:text-foreground transition-colors">
            RSS
          </a>
          <a href="/llms.txt" className="hover:text-foreground transition-colors">
            llms.txt
          </a>
        </nav>
      </div>
    </footer>
  );
}
