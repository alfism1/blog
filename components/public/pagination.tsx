import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  /** `(page) => href`. Page 1 usually maps to the bare listing URL. */
  hrefFor: (page: number) => string;
}

/**
 * Path-based pagination (`/page/2`), never `?page=2` — clean URLs are a stated
 * SEO requirement and let each page be statically generated.
 */
export function Pagination({ page, totalPages, hrefFor }: PaginationProps) {
  if (totalPages <= 1) return null;

  const linkClass = cn(buttonVariants({ variant: "outline", size: "sm" }));
  const disabledClass = cn(
    buttonVariants({ variant: "outline", size: "sm" }),
    "pointer-events-none opacity-40",
  );

  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex items-center justify-between gap-4"
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={linkClass} rel="prev">
          <ChevronLeftIcon aria-hidden="true" />
          Newer
        </Link>
      ) : (
        <span className={disabledClass} aria-hidden="true">
          <ChevronLeftIcon />
          Newer
        </span>
      )}

      <p className="text-muted-foreground text-sm" aria-current="page">
        Page {page} of {totalPages}
      </p>

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={linkClass} rel="next">
          Older
          <ChevronRightIcon aria-hidden="true" />
        </Link>
      ) : (
        <span className={disabledClass} aria-hidden="true">
          Older
          <ChevronRightIcon />
        </span>
      )}
    </nav>
  );
}
