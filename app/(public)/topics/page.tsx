import type { Metadata } from "next";
import Link from "next/link";

import { JsonLdScript } from "@/components/json-ld";
import { Badge } from "@/components/ui/badge";
import { getCategories, getTags } from "@/lib/content/posts";
import { breadcrumbSchema } from "@/lib/seo/jsonld";
import { pluralize } from "@/lib/utils";
import { siteConfig } from "@/site.config";

export const metadata: Metadata = {
  title: "Topics",
  description: `Browse every category and tag on ${siteConfig.name} to find posts by subject.`,
  alternates: { canonical: "/topics" },
};

export default async function TopicsPage() {
  const [categories, tags] = await Promise.all([getCategories(), getTags()]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <JsonLdScript
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Topics", path: "/topics" },
        ])}
      />

      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Topics
        </h1>
        <p className="text-muted-foreground mt-2">
          Every category and tag across the archive.
        </p>
      </header>

      <section aria-labelledby="categories-heading" className="mb-12">
        <h2
          id="categories-heading"
          className="text-muted-foreground mb-4 text-xs font-semibold tracking-wide uppercase"
        >
          Categories
        </h2>
        {categories.length === 0 ? (
          <p className="text-muted-foreground text-sm">No categories yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/category/${category.slug}`}
                  className="border-border hover:border-foreground/25 hover:bg-accent/40 flex items-center justify-between rounded-lg border px-4 py-3 transition-colors"
                >
                  <span className="font-medium">{category.label}</span>
                  <span className="text-muted-foreground text-sm">
                    {category.count} {pluralize(category.count, "post")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="tags-heading">
        <h2
          id="tags-heading"
          className="text-muted-foreground mb-4 text-xs font-semibold tracking-wide uppercase"
        >
          Tags
        </h2>
        {tags.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tags yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag.slug}>
                <Link href={`/tag/${tag.slug}`}>
                  <Badge
                    variant="outline"
                    className="hover:border-foreground/30 hover:text-foreground gap-1.5 py-1 transition-colors"
                  >
                    {tag.label}
                    <span className="opacity-60">{tag.count}</span>
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
