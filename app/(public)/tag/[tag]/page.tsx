import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLdScript } from "@/components/json-ld";
import { PostList } from "@/components/public/post-card";
import { getPostsByTag, getTags } from "@/lib/content/posts";
import { breadcrumbSchema, collectionSchema } from "@/lib/seo/jsonld";
import { pluralize } from "@/lib/utils";
import { siteConfig } from "@/site.config";

export async function generateStaticParams() {
  const tags = await getTags();
  return tags.map((tag) => ({ tag: tag.slug }));
}

// See the note in app/(public)/blog/[slug]/page.tsx: prerendered terms plus
// on-demand rendering, so a newly published post gets its taxonomy pages
// immediately. An unknown term still 404s below.
export const dynamicParams = true;

async function findTag(slug: string) {
  const tags = await getTags();
  return tags.find((tag) => tag.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag: slug } = await params;
  const tag = await findTag(slug);
  if (!tag) return { title: "Tag not found" };

  const description = `${tag.count} ${pluralize(tag.count, "post")} tagged ${tag.label} on ${siteConfig.name}.`;

  return {
    title: `#${tag.label}`,
    description,
    alternates: { canonical: `/tag/${tag.slug}` },
    openGraph: {
      type: "website",
      title: `#${tag.label} — ${siteConfig.name}`,
      description,
      url: `/tag/${tag.slug}`,
    },
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag: slug } = await params;
  const tag = await findTag(slug);
  if (!tag) notFound();

  const posts = await getPostsByTag(slug);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <JsonLdScript
        data={[
          collectionSchema({
            name: `#${tag.label}`,
            description: `Posts tagged ${tag.label}.`,
            path: `/tag/${tag.slug}`,
            posts,
          }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Topics", path: "/topics" },
            { name: tag.label, path: `/tag/${tag.slug}` },
          ]),
        ]}
      />

      <header className="mb-10">
        <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
          Tag
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          #{tag.label}
        </h1>
        <p className="text-muted-foreground mt-2">
          {posts.length} {pluralize(posts.length, "post")}
        </p>
      </header>

      <PostList
        posts={posts}
        emptyMessage={`No published posts tagged ${tag.label} yet.`}
      />
    </div>
  );
}
