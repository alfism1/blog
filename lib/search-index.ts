import "server-only";

import { cache } from "react";

import { getPublishedPosts, getPost } from "@/lib/content/posts";
import { excerptFromMdx } from "@/lib/utils";

/** One searchable record. Kept small — this ships to the browser verbatim. */
export interface SearchDocument {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  date: string;
  category?: string;
  tags: string[];
  readingTimeMinutes: number;
}

/**
 * Build the client-side search index.
 *
 * Runs at build time (the search page is statically generated), so visitors get
 * a plain JSON payload and `fuse.js` does the matching in the browser — no
 * search server, no database, no per-query cost.
 *
 * Drafts are excluded: `getPublishedPosts` already filters them out.
 */
export const buildSearchIndex = cache(async (): Promise<SearchDocument[]> => {
  const posts = await getPublishedPosts();

  return Promise.all(
    posts.map(async (post) => {
      // The listing carries metadata only; fetch the body for the excerpt.
      const full = await getPost(post.frontmatter.slug);
      const { frontmatter } = post;

      return {
        slug: frontmatter.slug,
        title: frontmatter.title,
        description: frontmatter.description,
        excerpt: full ? excerptFromMdx(full.body, 240) : "",
        date: frontmatter.date,
        category: frontmatter.category,
        tags: [...frontmatter.tags],
        readingTimeMinutes: post.readingTimeMinutes,
      };
    }),
  );
});
