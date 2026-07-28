import matter from "gray-matter";
import readingTime from "reading-time";

import { frontmatterSchema, type Frontmatter } from "./schema";
import { ContentError, type Post } from "./types";

/** Average adult prose speed; `reading-time` defaults to 200wpm which reads slow. */
const WORDS_PER_MINUTE = 220;

/**
 * YAML-serialise a frontmatter value.
 *
 * Deliberately hand-rolled rather than pulling in `js-yaml`: the schema is a
 * closed set of primitives, string arrays and one nested object, and emitting
 * quoted scalars for every string sidesteps the whole class of YAML escaping
 * bugs (colons in titles, leading `#`, values that look like dates or booleans).
 */
function yamlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function stringifyFrontmatter(frontmatter: Frontmatter): string {
  const lines: string[] = ["---"];

  lines.push(`title: ${yamlString(frontmatter.title)}`);
  lines.push(`slug: ${yamlString(frontmatter.slug)}`);
  lines.push(`description: ${yamlString(frontmatter.description)}`);
  lines.push(`date: ${yamlString(frontmatter.date)}`);

  if (frontmatter.updatedAt) {
    lines.push(`updatedAt: ${yamlString(frontmatter.updatedAt)}`);
  }

  if (frontmatter.tags.length > 0) {
    lines.push("tags:");
    for (const tag of frontmatter.tags) lines.push(`  - ${yamlString(tag)}`);
  }

  if (frontmatter.category) {
    lines.push(`category: ${yamlString(frontmatter.category)}`);
  }

  if (frontmatter.coverImage) {
    lines.push("coverImage:");
    lines.push(`  src: ${yamlString(frontmatter.coverImage.src)}`);
    lines.push(`  alt: ${yamlString(frontmatter.coverImage.alt)}`);
  }

  lines.push(`status: ${yamlString(frontmatter.status)}`);
  lines.push(`featured: ${frontmatter.featured}`);
  lines.push("---");

  return lines.join("\n");
}

/** Compose the full `.mdx` file contents for a post. */
export function serializePost(input: {
  frontmatter: Frontmatter;
  body: string;
}): string {
  const body = input.body.replace(/\r\n/g, "\n").trimEnd();
  return `${stringifyFrontmatter(input.frontmatter)}\n\n${body}\n`;
}

/**
 * Parse a raw `.mdx` file into a validated `Post`.
 *
 * @param source raw file contents
 * @param path   used only for error messages
 * @param fallbackSlug used when frontmatter omits `slug` (derived from filename)
 */
export function parsePost(
  source: string,
  path: string,
  fallbackSlug?: string,
): Post {
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(source);
  } catch (error) {
    throw new ContentError(
      `Could not parse frontmatter in ${path}: ${(error as Error).message}`,
      422,
      error,
    );
  }

  const data = parsed.data as Record<string, unknown>;
  const raw: Record<string, unknown> = {
    ...data,
    slug: data.slug ?? fallbackSlug,
  };

  // gray-matter turns unquoted YAML dates into JS Date objects; the schema
  // expects ISO strings, so normalise before validating.
  for (const key of ["date", "updatedAt"] as const) {
    if (raw[key] instanceof Date) raw[key] = (raw[key] as Date).toISOString();
  }

  const result = frontmatterSchema.safeParse(raw);
  if (!result.success) {
    const detail = result.error.issues
      .map(
        (issue) => `${issue.path.join(".") || "frontmatter"}: ${issue.message}`,
      )
      .join("; ");
    throw new ContentError(`Invalid frontmatter in ${path} — ${detail}`, 422);
  }

  const body = parsed.content.trim();
  const stats = readingTime(body, { wordsPerMinute: WORDS_PER_MINUTE });

  return {
    frontmatter: result.data,
    body,
    readingTimeMinutes: Math.max(1, Math.round(stats.minutes)),
    wordCount: stats.words,
  };
}

/** `content/posts/my-post.mdx` for a given slug. */
export function postPath(slug: string, dir = "content/posts"): string {
  return `${dir}/${slug}.mdx`;
}

/** `public/images/my-post/diagram.png` for a given slug + filename. */
export function imagePath(slug: string, filename: string): string {
  return `public/images/${slug}/${filename}`;
}

/** The browser-facing URL for a repo image path. */
export function publicImageUrl(slug: string, filename: string): string {
  return `/images/${slug}/${filename}`;
}
