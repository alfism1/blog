import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import {
  parsePost,
  postPath,
  serializePost,
  publicImageUrl,
} from "./serialize";
import type { Frontmatter } from "./schema";
import {
  ContentError,
  type ContentAdapter,
  type InvalidPost,
  type ListResult,
  type Post,
  type PostMeta,
  type UploadResult,
  type WriteResult,
} from "./types";

const REPO_ROOT = process.cwd();
const POSTS_DIR = path.join(REPO_ROOT, "content", "posts");
const IMAGES_DIR = path.join(REPO_ROOT, "public", "images");

/** Guard against `../` escaping the content directory via a crafted slug. */
function resolveWithin(base: string, ...segments: string[]): string {
  const target = path.resolve(base, ...segments);
  const normalizedBase = path.resolve(base);
  if (
    target !== normalizedBase &&
    !target.startsWith(normalizedBase + path.sep)
  ) {
    throw new ContentError("Resolved path escapes the content directory", 400);
  }
  return target;
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads and writes `content/posts/*.mdx` directly on disk.
 *
 * Only safe in local development and at build time — Vercel's serverless
 * filesystem is read-only and ephemeral, so writes there would silently vanish.
 */
export const localFsAdapter: ContentAdapter = {
  name: "local-fs",
  triggersDeploy: false,

  async list(): Promise<ListResult> {
    let entries: string[];
    try {
      entries = await fs.readdir(POSTS_DIR);
    } catch (error) {
      // A missing content directory is an empty blog, not a crash.
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { posts: [], invalid: [] };
      }
      throw new ContentError("Could not read the posts directory", 500, error);
    }

    const posts: PostMeta[] = [];
    const invalid: InvalidPost[] = [];

    await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".mdx"))
        .map(async (entry) => {
          const filePath = path.join(POSTS_DIR, entry);
          const relative = `content/posts/${entry}`;
          try {
            const source = await fs.readFile(filePath, "utf8");
            const post = parsePost(
              source,
              relative,
              entry.replace(/\.mdx$/, ""),
            );
            const { body: _body, ...meta } = post;
            void _body;
            posts.push(meta);
          } catch (error) {
            invalid.push({ path: relative, error: (error as Error).message });
          }
        }),
    );

    return { posts, invalid };
  },

  async get(slug: string): Promise<Post | null> {
    const filePath = resolveWithin(POSTS_DIR, `${slug}.mdx`);
    try {
      const source = await fs.readFile(filePath, "utf8");
      return parsePost(source, postPath(slug), slug);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  },

  async create(post: {
    frontmatter: Frontmatter;
    body: string;
  }): Promise<WriteResult> {
    const filePath = resolveWithin(POSTS_DIR, `${post.frontmatter.slug}.mdx`);
    if (await exists(filePath)) {
      throw new ContentError(
        `A post with the slug "${post.frontmatter.slug}" already exists`,
        409,
      );
    }
    await fs.mkdir(POSTS_DIR, { recursive: true });
    await fs.writeFile(filePath, serializePost(post), "utf8");
    return {
      slug: post.frontmatter.slug,
      commitSha: null,
      triggersDeploy: false,
    };
  },

  async update(
    previousSlug: string,
    post: { frontmatter: Frontmatter; body: string },
  ): Promise<WriteResult> {
    const nextSlug = post.frontmatter.slug;
    const previousPath = resolveWithin(POSTS_DIR, `${previousSlug}.mdx`);
    const nextPath = resolveWithin(POSTS_DIR, `${nextSlug}.mdx`);

    if (!(await exists(previousPath))) {
      throw new ContentError(
        `No post found with the slug "${previousSlug}"`,
        404,
      );
    }
    if (nextSlug !== previousSlug && (await exists(nextPath))) {
      throw new ContentError(
        `Cannot rename: a post with the slug "${nextSlug}" already exists`,
        409,
      );
    }

    await fs.writeFile(nextPath, serializePost(post), "utf8");
    if (nextSlug !== previousSlug) await fs.rm(previousPath, { force: true });

    return { slug: nextSlug, commitSha: null, triggersDeploy: false };
  },

  async remove(
    slug: string,
    options: { deleteImages?: boolean } = {},
  ): Promise<WriteResult> {
    const filePath = resolveWithin(POSTS_DIR, `${slug}.mdx`);
    if (!(await exists(filePath))) {
      throw new ContentError(`No post found with the slug "${slug}"`, 404);
    }
    await fs.rm(filePath);

    if (options.deleteImages) {
      const dir = resolveWithin(IMAGES_DIR, slug);
      await fs.rm(dir, { recursive: true, force: true });
    }

    return { slug, commitSha: null, triggersDeploy: false };
  },

  async uploadImage({
    slug,
    filename,
    data,
  }: {
    slug: string;
    filename: string;
    data: Buffer;
  }): Promise<UploadResult> {
    const dir = resolveWithin(IMAGES_DIR, slug);
    const filePath = resolveWithin(dir, filename);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, data);
    return {
      path: publicImageUrl(slug, filename),
      commitSha: null,
      triggersDeploy: false,
    };
  },
};
