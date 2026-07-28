import type { TocEntry } from "@/lib/mdx/toc";
import { cn } from "@/lib/utils";

/**
 * Server-rendered table of contents — plain anchor links, zero client JS.
 * Scroll offset for the sticky header is handled in CSS via `scroll-padding-top`.
 */
export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  if (entries.length < 2) return null;

  return (
    <nav aria-labelledby="toc-heading" className="text-sm">
      <h2
        id="toc-heading"
        className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase"
      >
        On this page
      </h2>
      <ol className="border-border space-y-2 border-l">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              className={cn(
                "text-muted-foreground hover:text-foreground -ml-px block border-l border-transparent py-0.5 transition-colors hover:border-current",
                entry.depth === 2 ? "pl-4" : "pl-7",
              )}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
