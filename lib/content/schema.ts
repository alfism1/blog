import { z } from "zod";

/** kebab-case, url-safe. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const DESCRIPTION_MIN = 120;
export const DESCRIPTION_MAX = 160;

const isoDate = z
  .string()
  .min(1, "Date is required")
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Must be a valid ISO date string",
  })
  .transform((value) => new Date(value).toISOString());

export const slugSchema = z
  .string()
  .min(1, "Slug is required")
  .max(120, "Slug must be 120 characters or fewer")
  .regex(
    SLUG_PATTERN,
    "Slug must be kebab-case: lowercase letters, numbers and single hyphens",
  );

export const postStatusSchema = z.enum(["draft", "published"]);

/**
 * Frontmatter as authored in the `.mdx` file.
 *
 * `coverImage` is an object rather than a bare string so alt text can be
 * *required* whenever a cover image exists (SEO requirement §11). A bare string
 * is still accepted on read for backwards compatibility and normalised below.
 */
export const coverImageSchema = z.object({
  src: z
    .string()
    .min(1, "Cover image path is required")
    .refine(
      (value) => value.startsWith("/images/") || /^https?:\/\//.test(value),
      { message: "Cover image must live under /images/ or be an absolute URL" },
    ),
  alt: z
    .string()
    .min(4, "Cover images require descriptive alt text (min 4 characters)")
    .max(240, "Alt text must be 240 characters or fewer"),
});

const coverImageInput = z.preprocess((value) => {
  // Tolerate `coverImage: /images/foo.png` written by hand in MDX.
  if (typeof value === "string") {
    return value.trim() === "" ? undefined : { src: value, alt: "" };
  }
  return value;
}, coverImageSchema.optional());

export const frontmatterSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(140, "Title must be 140 characters or fewer"),
  slug: slugSchema,
  description: z
    .string()
    .min(
      DESCRIPTION_MIN,
      `Description must be at least ${DESCRIPTION_MIN} characters for a useful meta description`,
    )
    .max(
      DESCRIPTION_MAX,
      `Description must be at most ${DESCRIPTION_MAX} characters or search engines will truncate it`,
    ),
  date: isoDate,
  updatedAt: isoDate.optional(),
  tags: z.array(z.string().min(1)).max(12, "12 tags maximum").default([]),
  category: z.string().min(1).optional(),
  coverImage: coverImageInput,
  status: postStatusSchema.default("draft"),
  featured: z.boolean().default(false),
});

/** What a valid post body + frontmatter looks like coming out of the editor. */
export const postInputSchema = z.object({
  frontmatter: frontmatterSchema,
  body: z.string().min(1, "Post body cannot be empty"),
});

/** Payload accepted by `PUT /api/admin/posts/[slug]` — slug may be renamed. */
export const postUpdateSchema = postInputSchema.extend({
  /** Original slug, used to detect a rename so the old file can be removed. */
  previousSlug: slugSchema,
});

export const uploadSchema = z.object({
  slug: slugSchema,
  filename: z
    .string()
    .min(1)
    .max(120)
    .regex(
      /^[A-Za-z0-9._-]+$/,
      "Filename may only contain letters, numbers, dots, dashes and underscores",
    )
    .refine((value) => !value.includes(".."), { message: "Invalid filename" }),
});

export type Frontmatter = z.infer<typeof frontmatterSchema>;
export type FrontmatterInput = z.input<typeof frontmatterSchema>;
export type PostInput = z.infer<typeof postInputSchema>;
export type PostStatus = z.infer<typeof postStatusSchema>;
export type CoverImage = z.infer<typeof coverImageSchema>;

/** Derive a kebab-case slug from arbitrary title text. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

/** Flatten a ZodError into `{ "frontmatter.title": "…" }` for form display. */
export function flattenIssues(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in result)) result[key] = issue.message;
  }
  return result;
}
