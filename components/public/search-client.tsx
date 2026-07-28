"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Fuse, { type FuseResult } from "fuse.js";
import { SearchIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { SearchDocument } from "@/lib/search-index";
import { formatDate, pluralize, toDateAttribute } from "@/lib/utils";

const FUSE_OPTIONS = {
  includeScore: true,
  threshold: 0.38,
  ignoreLocation: true,
  minMatchCharLength: 2,
  keys: [
    { name: "title", weight: 5 },
    { name: "tags", weight: 3 },
    { name: "description", weight: 2 },
    { name: "category", weight: 2 },
    { name: "excerpt", weight: 1 },
  ],
};

const MAX_RESULTS = 30;
const DEBOUNCE_MS = 120;

export function SearchClient({ documents }: { documents: SearchDocument[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = React.useState(initialQuery);
  const [debounced, setDebounced] = React.useState(initialQuery);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Fuse pre-computes its index; rebuilding it per keystroke would be wasteful.
  const fuse = React.useMemo(
    () => new Fuse(documents, FUSE_OPTIONS),
    [documents],
  );

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Keep `?q=` in sync so results are shareable and survive a reload.
  React.useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (current === debounced) return;
    const next = debounced
      ? `/search?q=${encodeURIComponent(debounced)}`
      : "/search";
    router.replace(next, { scroll: false });
  }, [debounced, router, searchParams]);

  const results: FuseResult<SearchDocument>[] = React.useMemo(() => {
    const term = debounced.trim();
    if (term.length < 2) return [];
    return fuse.search(term, { limit: MAX_RESULTS });
  }, [debounced, fuse]);

  const showResults = debounced.trim().length >= 2;

  return (
    <div>
      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <label htmlFor="search-input" className="sr-only">
          Search posts
        </label>
        <Input
          id="search-input"
          ref={inputRef}
          type="search"
          value={query}
          autoFocus
          autoComplete="off"
          placeholder="Search posts by title, tag or content…"
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 pr-10 pl-9 text-base"
          aria-describedby="search-status"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 rounded-sm transition-colors"
            aria-label="Clear search"
          >
            <XIcon className="size-4" />
          </button>
        ) : null}
      </div>

      <p
        id="search-status"
        role="status"
        aria-live="polite"
        className="text-muted-foreground mt-3 text-sm"
      >
        {!showResults
          ? `Searching ${documents.length} ${pluralize(documents.length, "post")}. Type at least two characters.`
          : `${results.length} ${pluralize(results.length, "result")} for “${debounced.trim()}”`}
      </p>

      {showResults && results.length === 0 ? (
        <div className="border-border text-muted-foreground mt-8 rounded-xl border border-dashed p-10 text-center">
          <p>No posts match that search.</p>
          <p className="mt-1 text-sm">Try a shorter or more general term.</p>
        </div>
      ) : null}

      {results.length > 0 ? (
        <ul className="mt-6 grid gap-4">
          {results.map(({ item }) => (
            <li key={item.slug}>
              <article className="group border-border hover:border-foreground/25 hover:bg-accent/40 relative rounded-xl border p-5 transition-colors">
                <div className="text-muted-foreground mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <time dateTime={toDateAttribute(item.date)}>
                    {formatDate(item.date)}
                  </time>
                  <span aria-hidden="true">·</span>
                  <span>{item.readingTimeMinutes} min read</span>
                  {item.category ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{item.category}</span>
                    </>
                  ) : null}
                </div>
                <h2 className="text-lg font-semibold tracking-tight">
                  <Link
                    href={`/blog/${item.slug}`}
                    className="after:absolute after:inset-0"
                  >
                    {item.title}
                  </Link>
                </h2>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {item.description}
                </p>
                {item.tags.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {item.tags.slice(0, 4).map((tag) => (
                      <li key={tag}>
                        <Badge variant="outline">{tag}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
