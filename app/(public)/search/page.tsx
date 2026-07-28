import { Suspense } from "react";
import type { Metadata } from "next";

import { JsonLdScript } from "@/components/json-ld";
import { SearchClient } from "@/components/public/search-client";
import { Skeleton } from "@/components/ui/skeleton";
import { buildSearchIndex } from "@/lib/search-index";
import { breadcrumbSchema } from "@/lib/seo/jsonld";
import { siteConfig } from "@/site.config";

export const metadata: Metadata = {
  title: "Search",
  description: `Search every published post on ${siteConfig.name}. Results are computed instantly in your browser — nothing is sent to a server.`,
  alternates: { canonical: "/search" },
  // The result list is client-rendered and has no standalone value in an index.
  robots: { index: true, follow: true, nosnippet: false },
};

function SearchFallback() {
  return (
    <div className="mt-2 space-y-4">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-4 w-56" />
    </div>
  );
}

export default async function SearchPage() {
  // Built at compile time and embedded in the static HTML — the search page
  // makes no network request of its own.
  const documents = await buildSearchIndex();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <JsonLdScript
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Search", path: "/search" },
        ])}
      />

      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Search
        </h1>
        <p className="text-muted-foreground mt-2">
          Fuzzy search across every published post. Runs entirely in your
          browser.
        </p>
      </header>

      {/* useSearchParams needs a Suspense boundary during prerendering. */}
      <Suspense fallback={<SearchFallback />}>
        <SearchClient documents={documents} />
      </Suspense>
    </div>
  );
}
