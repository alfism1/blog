import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { JsonLdScript } from "@/components/json-ld";
import { MdxContent } from "@/components/mdx-content";
import { PostCard } from "@/components/public/post-card";
import { TableOfContents } from "@/components/public/table-of-contents";
import { Badge } from "@/components/ui/badge";
import {
  getPublishedPost,
  getPublishedPosts,
  getRelatedPosts,
  taxonomyKey,
} from "@/lib/content/posts";
import { buildToc } from "@/lib/mdx/toc";
import { blogPostingSchema, breadcrumbSchema } from "@/lib/seo/jsonld";
import { formatDate, toDateAttribute } from "@/lib/utils";
import { absoluteUrl, siteConfig } from "@/site.config";

/**
 * Drafts are excluded here, so they are never prerendered and never appear in
 * the build output. Admins preview them at `/admin/preview/[slug]` instead.
 */
export async function generateStaticParams() {
  const posts = await getPublishedPosts();
  return posts.map((post) => ({ slug: post.frontmatter.slug }));
}

/**
 * Every published post is prerendered above. Allowing dynamic params on top of
 * that means a post published from the admin panel is reachable as soon as
 * `revalidatePath` runs, instead of 404ing for the ~60s it takes GitHub to
 * trigger a redeploy and Vercel to finish building.
 *
 * This does not leak drafts: an unknown or unpublished slug still resolves to
 * `null` below and renders the 404 page.
 */
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return { title: "Post not found" };

  const { frontmatter } = post;
  const url = `/blog/${frontmatter.slug}`;
  const ogImage = frontmatter.coverImage
    ? { url: frontmatter.coverImage.src, alt: frontmatter.coverImage.alt }
    : // Falls back to the generated card from ./opengraph-image.tsx
      { url: `${url}/opengraph-image`, alt: frontmatter.title };

  return {
    title: frontmatter.title,
    description: frontmatter.description,
    alternates: { canonical: url },
    keywords: frontmatter.tags,
    authors: [{ name: siteConfig.author.name, url: siteConfig.author.url }],
    openGraph: {
      type: "article",
      title: frontmatter.title,
      description: frontmatter.description,
      url: absoluteUrl(url),
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      publishedTime: frontmatter.date,
      modifiedTime: frontmatter.updatedAt ?? frontmatter.date,
      authors: [siteConfig.author.name],
      tags: [...frontmatter.tags],
      section: frontmatter.category,
      images: [
        { url: ogImage.url, width: 1200, height: 630, alt: ogImage.alt },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: frontmatter.title,
      description: frontmatter.description,
      images: [{ url: ogImage.url, alt: ogImage.alt }],
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  const related = await getRelatedPosts(slug);
  const { frontmatter } = post;
  const toc = buildToc(post.body);
  const showToc = post.wordCount >= siteConfig.tocMinWords && toc.length >= 2;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLdScript
        data={[
          blogPostingSchema(post),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            ...(frontmatter.category
              ? [
                  {
                    name: frontmatter.category,
                    path: `/category/${taxonomyKey(frontmatter.category)}`,
                  },
                ]
              : []),
            { name: frontmatter.title, path: `/blog/${frontmatter.slug}` },
          ]),
        ]}
      />

      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        All posts
      </Link>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-12">
        <article className="min-w-0">
          <header className="mb-8">
            <div className="text-muted-foreground mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <time dateTime={toDateAttribute(frontmatter.date)}>
                {formatDate(frontmatter.date)}
              </time>
              <span aria-hidden="true">·</span>
              <span>{post.readingTimeMinutes} min read</span>
              {frontmatter.category ? (
                <>
                  <span aria-hidden="true">·</span>
                  <Link
                    href={`/category/${taxonomyKey(frontmatter.category)}`}
                    className="hover:text-foreground transition-colors"
                  >
                    {frontmatter.category}
                  </Link>
                </>
              ) : null}
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {frontmatter.title}
            </h1>

            <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
              {frontmatter.description}
            </p>

            {frontmatter.updatedAt &&
            frontmatter.updatedAt !== frontmatter.date ? (
              <p className="text-muted-foreground mt-3 text-sm">
                Updated{" "}
                <time dateTime={toDateAttribute(frontmatter.updatedAt)}>
                  {formatDate(frontmatter.updatedAt)}
                </time>
              </p>
            ) : null}
          </header>

          {frontmatter.coverImage ? (
            <Image
              src={frontmatter.coverImage.src}
              alt={frontmatter.coverImage.alt}
              width={1200}
              height={630}
              priority
              sizes="(max-width: 1024px) 100vw, 720px"
              className="border-border mb-10 aspect-[1200/630] w-full rounded-xl border object-cover"
            />
          ) : null}

          {/* Inline ToC for narrow viewports where the sidebar is hidden. */}
          {showToc ? (
            <details className="border-border bg-muted/40 mb-10 rounded-lg border p-4 lg:hidden">
              <summary className="cursor-pointer text-sm font-medium">
                On this page
              </summary>
              <div className="mt-3">
                <TableOfContents entries={toc} />
              </div>
            </details>
          ) : null}

          <div className="prose">
            <MdxContent source={post.body} />
          </div>

          {frontmatter.tags.length > 0 ? (
            <footer className="border-border mt-12 border-t pt-6">
              <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                Tagged
              </h2>
              <ul className="flex flex-wrap gap-2">
                {frontmatter.tags.map((tag) => (
                  <li key={tag}>
                    <Link href={`/tag/${taxonomyKey(tag)}`}>
                      <Badge
                        variant="outline"
                        className="hover:border-foreground/30 hover:text-foreground transition-colors"
                      >
                        {tag}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </footer>
          ) : null}
        </article>

        {showToc ? (
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <TableOfContents entries={toc} />
            </div>
          </aside>
        ) : null}
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="related-heading" className="mt-16">
          <h2
            id="related-heading"
            className="text-muted-foreground mb-4 text-xs font-semibold tracking-wide uppercase"
          >
            Related posts
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {related.map((item) => (
              <PostCard key={item.frontmatter.slug} post={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
