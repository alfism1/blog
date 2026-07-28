import { Feed } from "feed";

import { getPost, getPublishedPosts } from "@/lib/content/posts";
import { excerptFromMdx } from "@/lib/utils";
import { absoluteUrl, siteConfig } from "@/site.config";

/**
 * RSS 2.0 feed at `/rss.xml`.
 *
 * Statically generated at build time (no dynamic request APIs are touched), so
 * Vercel serves it from the edge cache at zero function cost. A publish commits
 * to Git → redeploy → the feed is rebuilt.
 */
export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const posts = await getPublishedPosts();
  const updated = posts[0]
    ? new Date(posts[0].frontmatter.updatedAt ?? posts[0].frontmatter.date)
    : new Date();

  const feed = new Feed({
    title: siteConfig.title,
    description: siteConfig.description,
    id: absoluteUrl("/"),
    link: absoluteUrl("/"),
    language: siteConfig.language,
    favicon: absoluteUrl("/favicon.ico"),
    copyright: siteConfig.copyright,
    updated,
    generator: "Next.js + feed",
    feedLinks: {
      rss: absoluteUrl("/rss.xml"),
    },
    author: {
      name: siteConfig.author.name,
      email: siteConfig.author.email,
      link: siteConfig.author.url,
    },
  });

  for (const post of posts) {
    const { frontmatter } = post;
    const url = absoluteUrl(`/blog/${frontmatter.slug}`);
    const full = await getPost(frontmatter.slug);

    feed.addItem({
      title: frontmatter.title,
      id: url,
      link: url,
      description: frontmatter.description,
      // Full text stays out of the feed on purpose: readers land on the site,
      // which keeps canonical attribution with the original URL.
      content: full ? excerptFromMdx(full.body, 600) : frontmatter.description,
      author: [
        {
          name: siteConfig.author.name,
          email: siteConfig.author.email,
          link: siteConfig.author.url,
        },
      ],
      date: new Date(frontmatter.updatedAt ?? frontmatter.date),
      published: new Date(frontmatter.date),
      category: [
        ...(frontmatter.category ? [{ name: frontmatter.category }] : []),
        ...frontmatter.tags.map((tag) => ({ name: tag })),
      ],
      image: frontmatter.coverImage
        ? absoluteUrl(frontmatter.coverImage.src)
        : undefined,
    });
  }

  return new Response(feed.rss2(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
