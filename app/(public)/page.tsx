import type { Metadata } from "next";

import { JsonLdScript } from "@/components/json-ld";
import { Pagination } from "@/components/public/pagination";
import { PostCard, PostList } from "@/components/public/post-card";
import {
  getFeaturedPost,
  getPublishedPosts,
  paginate,
} from "@/lib/content/posts";
import { websiteSchema } from "@/lib/seo/jsonld";
import { siteConfig } from "@/site.config";

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [posts, featured] = await Promise.all([
    getPublishedPosts(),
    getFeaturedPost(),
  ]);

  // The featured post gets the hero slot, so drop it from the list below to
  // avoid showing the same post twice on page 1.
  const rest = featured
    ? posts.filter(
        (post) => post.frontmatter.slug !== featured.frontmatter.slug,
      )
    : posts;

  const { items, page, totalPages } = paginate(rest, 1);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <JsonLdScript data={websiteSchema()} />

      <section className="mb-12">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {siteConfig.name}
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-lg leading-relaxed">
          {siteConfig.description}
        </p>
      </section>

      {featured ? (
        <section aria-labelledby="featured-heading" className="mb-12">
          <h2
            id="featured-heading"
            className="text-muted-foreground mb-4 text-xs font-semibold tracking-wide uppercase"
          >
            Featured
          </h2>
          <PostCard post={featured} featured priority />
        </section>
      ) : null}

      <section aria-labelledby="latest-heading">
        <h2
          id="latest-heading"
          className="text-muted-foreground mb-4 text-xs font-semibold tracking-wide uppercase"
        >
          {featured ? "More posts" : "Latest posts"}
        </h2>
        <PostList
          posts={items}
          emptyMessage={
            featured
              ? "That is everything for now — more soon."
              : "No posts yet — check back soon."
          }
        />
        <Pagination
          page={page}
          totalPages={totalPages}
          hrefFor={(target) => (target === 1 ? "/" : `/page/${target}`)}
        />
      </section>
    </div>
  );
}
