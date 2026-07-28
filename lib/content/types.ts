import type { Frontmatter } from "./schema";

/** A post as stored: validated frontmatter plus its raw MDX body. */
export interface Post {
  frontmatter: Frontmatter;
  body: string;
  /** Estimated reading time in minutes, rounded up. */
  readingTimeMinutes: number;
  /** Word count of the MDX body (used to decide whether to render a ToC). */
  wordCount: number;
}

/** Listing-shaped post: everything except the (potentially large) MDX body. */
export type PostMeta = Omit<Post, "body">;

/** A file in the content repo that failed validation — surfaced, never swallowed. */
export interface InvalidPost {
  path: string;
  error: string;
}

export interface ListResult {
  posts: PostMeta[];
  invalid: InvalidPost[];
}

export interface WriteResult {
  slug: string;
  /** Commit SHA when the adapter is git-backed; `null` for local filesystem. */
  commitSha: string | null;
  /** True when the write will trigger a Vercel redeploy. */
  triggersDeploy: boolean;
}

export interface UploadResult {
  /** Public path, e.g. `/images/my-post/diagram.png`. */
  path: string;
  commitSha: string | null;
  triggersDeploy: boolean;
}

/**
 * The single interface every storage backend implements.
 *
 * Reads and writes are deliberately on the same interface so the admin panel and
 * the public pages can never drift apart: whichever backend is active, both
 * surfaces see the same content.
 */
export interface ContentAdapter {
  readonly name: "local-fs" | "github-api";
  /** True when a write causes a real deploy (GitHub push → Vercel build). */
  readonly triggersDeploy: boolean;

  list(): Promise<ListResult>;
  get(slug: string): Promise<Post | null>;
  create(post: {
    frontmatter: Frontmatter;
    body: string;
  }): Promise<WriteResult>;
  update(
    previousSlug: string,
    post: { frontmatter: Frontmatter; body: string },
  ): Promise<WriteResult>;
  remove(
    slug: string,
    options?: { deleteImages?: boolean },
  ): Promise<WriteResult>;
  uploadImage(input: {
    slug: string;
    filename: string;
    data: Buffer;
  }): Promise<UploadResult>;
}

/** Thrown by adapters so API routes can map failures to useful HTTP statuses. */
export class ContentError extends Error {
  constructor(
    message: string,
    readonly status: number = 500,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ContentError";
  }
}
