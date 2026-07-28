import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLdScript } from "@/components/json-ld";
import { PostList } from "@/components/public/post-card";
import { getCategories, getPostsByCategory } from "@/lib/content/posts";
import { breadcrumbSchema, collectionSchema } from "@/lib/seo/jsonld";
import { pluralize } from "@/lib/utils";
import { siteConfig } from "@/site.config";

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ category: category.slug }));
}

// See the note in app/(public)/blog/[slug]/page.tsx: prerendered terms plus
// on-demand rendering, so a newly published post gets its taxonomy pages
// immediately. An unknown term still 404s below.
export const dynamicParams = true;

async function findCategory(slug: string) {
  const categories = await getCategories();
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await findCategory(slug);
  if (!category) return { title: "Category not found" };

  const description = `${category.count} ${pluralize(category.count, "post")} about ${category.label} on ${siteConfig.name}.`;

  return {
    title: `${category.label}`,
    description,
    alternates: { canonical: `/category/${category.slug}` },
    openGraph: {
      type: "website",
      title: `${category.label} — ${siteConfig.name}`,
      description,
      url: `/category/${category.slug}`,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const category = await findCategory(slug);
  if (!category) notFound();

  const posts = await getPostsByCategory(slug);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <JsonLdScript
        data={[
          collectionSchema({
            name: category.label,
            description: `Posts in the ${category.label} category.`,
            path: `/category/${category.slug}`,
            posts,
          }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Topics", path: "/topics" },
            { name: category.label, path: `/category/${category.slug}` },
          ]),
        ]}
      />

      <header className="mb-10">
        <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
          Category
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {category.label}
        </h1>
        <p className="text-muted-foreground mt-2">
          {posts.length} {pluralize(posts.length, "post")}
        </p>
      </header>

      <PostList
        posts={posts}
        emptyMessage={`No published posts in ${category.label} yet.`}
      />
    </div>
  );
}
