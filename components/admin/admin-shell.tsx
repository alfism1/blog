import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";

import { LogoutButton } from "@/components/admin/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/site.config";

/** Header + page frame shared by every authenticated admin screen. */
export function AdminShell({
  children,
  adapterName,
}: {
  children: React.ReactNode;
  adapterName: "local-fs" | "github-api";
}) {
  return (
    <>
      <header className="border-border bg-background/85 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="font-semibold tracking-tight">
              {siteConfig.name}
              <span className="text-muted-foreground ml-2 font-normal">
                admin
              </span>
            </Link>
            <Badge
              variant={adapterName === "github-api" ? "success" : "outline"}
              title={
                adapterName === "github-api"
                  ? "Writes commit to GitHub and trigger a Vercel deploy"
                  : "Writes go straight to content/posts on this machine"
              }
            >
              {adapterName === "github-api" ? "GitHub" : "Local files"}
            </Badge>
          </div>

          <nav aria-label="Admin" className="flex items-center gap-1">
            <Link
              href="/"
              target="_blank"
              rel="noreferrer"
              className="hover:bg-accent text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors"
            >
              View site
              <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
            </Link>
            <ThemeToggle />
            <LogoutButton />
          </nav>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6"
      >
        {children}
      </main>
    </>
  );
}
