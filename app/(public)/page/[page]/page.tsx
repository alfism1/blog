import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLdScript } from "@/components/json-ld";
import { Pagination } from "@/components/public/pagination";
import { PostList } from "@/components/public/post-card";
import {
  getFeaturedPost,
  getPublishedPosts,
  paginate,
} from "@/lib/content/posts";
import { breadcrumbSchema } from "@/lib/seo/jsonld";
import { siteConfig } from "@/site.config";

/** Page 1 lives at `/`, so archive pages start at 2. */
async function listablePosts() {
  const [posts, featured] = await Promise.all([
    getPublishedPosts(),
    getFeaturedPost(),
  ]);
  return featured
    ? posts.filter(
        (post) => post.frontmatter.slug !== featured.frontmatter.slug,
      )
    : posts;
}

export async function generateStaticParams() {
  const posts = await listablePosts();
  const totalPages = Math.max(
    1,
    Math.ceil(posts.length / siteConfig.postsPerPage),
  );
  return Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => ({
    page: String(index + 2),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const { page } = await params;
  return {
    title: `Archive — page ${page}`,
    description: `Page ${page} of posts on ${siteConfig.name}.`,
    alternates: { canonical: `/page/${page}` },
  };
}

export default async function ArchivePage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page: raw } = await params;
  const page = Number(raw);

  // Reject `/page/abc`, `/page/0` and `/page/1` (which duplicates `/`).
  if (!Number.isInteger(page) || page < 2) notFound();

  const posts = await listablePosts();
  const result = paginate(posts, page);
  if (result.page !== page) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <JsonLdScript
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: `Page ${page}`, path: `/page/${page}` },
        ])}
      />

      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Archive</h1>
        <p className="text-muted-foreground mt-2">
          Page {result.page} of {result.totalPages}
        </p>
      </header>

      <PostList posts={result.items} />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        hrefFor={(target) => (target === 1 ? "/" : `/page/${target}`)}
      />
    </div>
  );
}
