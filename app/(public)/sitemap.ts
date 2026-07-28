import type { MetadataRoute } from "next";

import { getCategories, getPublishedPosts, getTags } from "@/lib/content/posts";
import { absoluteUrl, siteConfig } from "@/site.config";

/**
 * Sitemap built from published content only — drafts must never be discoverable
 * (§7). Regenerated on every deploy, which the Git-based CMS triggers on publish.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories, tags] = await Promise.all([
    getPublishedPosts(),
    getCategories(),
    getTags(),
  ]);

  const newestPost = posts[0]?.frontmatter;
  const homeLastModified = newestPost
    ? new Date(newestPost.updatedAt ?? newestPost.date)
    : new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: homeLastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl("/topics"),
      lastModified: homeLastModified,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: absoluteUrl("/search"),
      lastModified: homeLastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  const archivePages = Math.max(
    0,
    Math.ceil(posts.length / siteConfig.postsPerPage) - 1,
  );

  const archiveRoutes: MetadataRoute.Sitemap = Array.from(
    { length: archivePages },
    (_, index) => ({
      url: absoluteUrl(`/page/${index + 2}`),
      lastModified: homeLastModified,
      changeFrequency: "weekly" as const,
      priority: 0.4,
    }),
  );

  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: absoluteUrl(`/blog/${post.frontmatter.slug}`),
    lastModified: new Date(post.frontmatter.updatedAt ?? post.frontmatter.date),
    changeFrequency: "monthly",
    priority: post.frontmatter.featured ? 0.9 : 0.8,
  }));

  const taxonomyRoutes: MetadataRoute.Sitemap = [
    ...categories.map((category) => ({
      url: absoluteUrl(`/category/${category.slug}`),
      lastModified: homeLastModified,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...tags.map((tag) => ({
      url: absoluteUrl(`/tag/${tag.slug}`),
      lastModified: homeLastModified,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];

  return [...staticRoutes, ...archiveRoutes, ...postRoutes, ...taxonomyRoutes];
}
