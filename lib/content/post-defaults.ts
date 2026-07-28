import type { PostStatus } from "./schema";

/**
 * The editor's form shape.
 *
 * Lives outside the `"use client"` form module so server components can build
 * the initial values without importing a client boundary.
 */
export interface PostFormValues {
  title: string;
  slug: string;
  description: string;
  date: string;
  updatedAt?: string;
  /** Comma-separated in the form; split on submit. */
  tags: string;
  category: string;
  coverImageSrc: string;
  coverImageAlt: string;
  status: PostStatus;
  featured: boolean;
  body: string;
}

/**
 * Starter body for a new post. Opens with the conclusion, which is both the
 * inverted-pyramid convention for technical writing and the structure that AI
 * answer engines extract most cleanly (§12).
 */
const STARTER_BODY = `Open with the answer: one or two sentences stating what this post
concludes, before any setup.

## The first real heading

Write the body here in MDX. Fenced code blocks are highlighted.

<Callout type="tip">
This is a tip callout.
</Callout>

<KeyTakeaway>
This is a key takeaway.
</KeyTakeaway>

<Figure src="/images/…" alt="…" />
`;

export function emptyPostValues(): PostFormValues {
  return {
    title: "",
    slug: "",
    description: "",
    date: new Date().toISOString(),
    tags: "",
    category: "",
    coverImageSrc: "",
    coverImageAlt: "",
    // New posts start as drafts so nothing is published by accident.
    status: "draft",
    featured: false,
    body: STARTER_BODY,
  };
}
