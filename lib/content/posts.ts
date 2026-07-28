import "server-only";

import { cache } from "react";

import { siteConfig } from "@/site.config";

import { getContentAdapter } from "./adapter";
import type { ListResult, Post, PostMeta } from "./types";

/**
 * `cache()` dedupes within a single render pass / request. During a production
 * build that means one GitHub round trip serves every statically generated page
 * instead of one per page.
 */
export const listAll = cache(async (): Promise<ListResult> => {
  const result = await getContentAdapter().list();
  if (result.invalid.length > 0 && process.env.NODE_ENV !== "production") {
    for (const entry of result.invalid) {
      console.warn(`[content] skipping ${entry.path}: ${entry.error}`);
    }
  }
  return result;
});

export const getPost = cache(async (slug: string): Promise<Post | null> =>
  getContentAdapter().get(slug),
);

function byNewestFirst(a: PostMeta, b: PostMeta): number {
  return (
    Date.parse(b.frontmatter.date) - Date.parse(a.frontmatter.date) ||
    a.frontmatter.title.localeCompare(b.frontmatter.title)
  );
}

/** Every post the public is allowed to see, newest first. */
export const getPublishedPosts = cache(async (): Promise<PostMeta[]> => {
  const { posts } = await listAll();
  return posts
    .filter((post) => post.frontmatter.status === "published")
    .sort(byNewestFirst);
});

/** Every post including drafts — admin surfaces only. */
export const getAllPosts = cache(async (): Promise<PostMeta[]> => {
  const { posts } = await listAll();
  return posts.slice().sort(byNewestFirst);
});

export const getPublishedPost = cache(
  async (slug: string): Promise<Post | null> => {
    const post = await getPost(slug);
    return post?.frontmatter.status === "published" ? post : null;
  },
);

export interface Paginated<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export function paginate<T>(
  items: T[],
  page: number,
  perPage: number = siteConfig.postsPerPage,
): Paginated<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * perPage;

  return {
    items: items.slice(start, start + perPage),
    page: current,
    totalPages,
    totalItems,
    hasPrevious: current > 1,
    hasNext: current < totalPages,
  };
}

export interface Taxonomy {
  /** URL-safe form used in the route. */
  slug: string;
  /** Human-readable label as authored in frontmatter. */
  label: string;
  count: number;
}

/**
 * Taxonomy terms are matched case-insensitively on their slugified form, so
 * `Next.js`, `next.js` and `nextjs` in different posts collapse to one page.
 */
function taxonomyKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export { taxonomyKey };

function collect(
  posts: PostMeta[],
  pick: (post: PostMeta) => string[],
): Taxonomy[] {
  const seen = new Map<string, Taxonomy>();
  for (const post of posts) {
    for (const value of pick(post)) {
      const key = taxonomyKey(value);
      if (!key) continue;
      const existing = seen.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        seen.set(key, { slug: key, label: value, count: 1 });
      }
    }
  }
  return [...seen.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );
}

export const getCategories = cache(async (): Promise<Taxonomy[]> => {
  const posts = await getPublishedPosts();
  return collect(posts, (post) =>
    post.frontmatter.category ? [post.frontmatter.category] : [],
  );
});

export const getTags = cache(async (): Promise<Taxonomy[]> => {
  const posts = await getPublishedPosts();
  return collect(posts, (post) => post.frontmatter.tags);
});

export const getPostsByCategory = cache(
  async (categorySlug: string): Promise<PostMeta[]> => {
    const posts = await getPublishedPosts();
    const key = taxonomyKey(categorySlug);
    return posts.filter(
      (post) =>
        post.frontmatter.category &&
        taxonomyKey(post.frontmatter.category) === key,
    );
  },
);

export const getPostsByTag = cache(
  async (tagSlug: string): Promise<PostMeta[]> => {
    const posts = await getPublishedPosts();
    const key = taxonomyKey(tagSlug);
    return posts.filter((post) =>
      post.frontmatter.tags.some((tag) => taxonomyKey(tag) === key),
    );
  },
);

/** The most recent featured post, used for the hero slot on the home page. */
export const getFeaturedPost = cache(async (): Promise<PostMeta | null> => {
  const posts = await getPublishedPosts();
  return posts.find((post) => post.frontmatter.featured) ?? null;
});

/**
 * Posts sharing the most tags with `slug`, newest first as the tie-breaker.
 * Cheap, deterministic and needs no external service.
 */
export const getRelatedPosts = cache(
  async (slug: string, limit = 3): Promise<PostMeta[]> => {
    const posts = await getPublishedPosts();
    const current = posts.find((post) => post.frontmatter.slug === slug);
    if (!current) return [];

    const currentTags = new Set(current.frontmatter.tags.map(taxonomyKey));
    const currentCategory = current.frontmatter.category
      ? taxonomyKey(current.frontmatter.category)
      : null;

    return posts
      .filter((post) => post.frontmatter.slug !== slug)
      .map((post) => {
        const shared = post.frontmatter.tags.filter((tag) =>
          currentTags.has(taxonomyKey(tag)),
        ).length;
        const sameCategory =
          currentCategory &&
          post.frontmatter.category &&
          taxonomyKey(post.frontmatter.category) === currentCategory
            ? 1
            : 0;
        return { post, score: shared * 2 + sameCategory };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || byNewestFirst(a.post, b.post))
      .slice(0, limit)
      .map((entry) => entry.post);
  },
);
