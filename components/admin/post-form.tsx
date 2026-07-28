"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  LoaderCircleIcon,
  SaveIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ImageUpload } from "@/components/admin/image-upload";
import { MdxEditor } from "@/components/admin/mdx-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { PostFormValues } from "@/lib/content/post-defaults";
import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  SLUG_PATTERN,
  slugify,
  type PostStatus,
} from "@/lib/content/schema";
import { cn } from "@/lib/utils";

export type { PostFormValues };

interface PostFormProps {
  mode: "create" | "edit";
  initialValues: PostFormValues;
  /** Slugs already taken, for client-side uniqueness feedback before submit. */
  existingSlugs: string[];
  /** True when writes commit to GitHub and trigger a Vercel redeploy. */
  triggersDeploy: boolean;
}

/** `2026-07-28T09:00` — the value shape a `datetime-local` input expects. */
function toDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDateTimeLocal(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-destructive flex items-center gap-1.5 text-xs">
      <AlertCircleIcon className="size-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

export function PostForm({
  mode,
  initialValues,
  existingSlugs,
  triggersDeploy,
}: PostFormProps) {
  const router = useRouter();

  const [values, setValues] = React.useState(initialValues);
  // Once the slug is edited by hand, stop deriving it from the title.
  const [slugLocked, setSlugLocked] = React.useState(mode === "edit");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const originalSlug = initialValues.slug;

  function update<K extends keyof PostFormValues>(
    key: K,
    value: PostFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (Object.keys(current).length === 0) return current;
      const next = { ...current };
      delete next[`frontmatter.${String(key)}`];
      return next;
    });
  }

  function handleTitleChange(title: string) {
    setValues((current) => ({
      ...current,
      title,
      slug: slugLocked ? current.slug : slugify(title),
    }));
  }

  // --- client-side validation mirroring the zod schema -----------------------

  const descriptionLength = values.description.trim().length;
  const descriptionOk =
    descriptionLength >= DESCRIPTION_MIN &&
    descriptionLength <= DESCRIPTION_MAX;

  const slugTaken =
    values.slug !== originalSlug && existingSlugs.includes(values.slug);
  const slugMalformed =
    values.slug.length > 0 && !SLUG_PATTERN.test(values.slug);

  const localIssues: Record<string, string> = {};
  if (!values.title.trim())
    localIssues["frontmatter.title"] = "Title is required.";
  if (!values.slug) localIssues["frontmatter.slug"] = "Slug is required.";
  else if (slugMalformed)
    localIssues["frontmatter.slug"] =
      "Use lowercase letters, numbers and single hyphens.";
  else if (slugTaken)
    localIssues["frontmatter.slug"] = "A post with this slug already exists.";
  if (!descriptionOk)
    localIssues["frontmatter.description"] =
      `Must be ${DESCRIPTION_MIN}–${DESCRIPTION_MAX} characters (currently ${descriptionLength}).`;
  if (values.coverImageSrc && values.coverImageAlt.trim().length < 4)
    localIssues["frontmatter.coverImage.alt"] =
      "Cover images require descriptive alt text.";
  if (!values.body.trim())
    localIssues["body"] = "The post body cannot be empty.";

  const canSubmit = Object.keys(localIssues).length === 0 && !isSaving;
  const errors = { ...localIssues, ...fieldErrors };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (Object.keys(localIssues).length > 0) {
      setFieldErrors(localIssues);
      return;
    }

    setIsSaving(true);

    const payload = {
      frontmatter: {
        title: values.title.trim(),
        slug: values.slug,
        description: values.description.trim(),
        date: values.date,
        // Stamped by the server on every edit so `dateModified` stays honest.
        ...(mode === "edit" ? { updatedAt: new Date().toISOString() } : {}),
        tags: values.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        ...(values.category.trim() ? { category: values.category.trim() } : {}),
        ...(values.coverImageSrc
          ? {
              coverImage: {
                src: values.coverImageSrc,
                alt: values.coverImageAlt.trim(),
              },
            }
          : {}),
        status: values.status,
        featured: values.featured,
      },
      body: values.body,
    };

    const endpoint =
      mode === "create"
        ? "/api/admin/posts"
        : `/api/admin/posts/${originalSlug}`;

    try {
      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFieldErrors(data.fields ?? {});
        setFormError(data.error ?? `Request failed (${response.status}).`);
        setIsSaving(false);
        return;
      }

      toast.success(mode === "create" ? "Post created" : "Changes saved", {
        description: data.triggersDeploy
          ? "Pushed to GitHub. The site rebuilds automatically — live in about a minute."
          : "Written to content/posts on this machine.",
      });

      router.push("/admin");
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Check your connection.");
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="pb-16" noValidate>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/admin"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          All posts
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="status" className="text-muted-foreground text-xs">
              {values.status === "published" ? "Published" : "Draft"}
            </Label>
            <Switch
              id="status"
              checked={values.status === "published"}
              onCheckedChange={(checked) =>
                update("status", checked ? "published" : "draft")
              }
              aria-label="Publish this post"
            />
          </div>
          <Button type="submit" disabled={!canSubmit}>
            {isSaving ? (
              <>
                <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              <>
                <SaveIcon aria-hidden="true" />
                {mode === "create" ? "Create post" : "Save changes"}
              </>
            )}
          </Button>
        </div>
      </div>

      {formError ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/8 text-destructive mb-6 flex items-start gap-2 rounded-lg border p-4 text-sm"
        >
          <AlertCircleIcon
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="font-medium">Could not save</p>
            <p className="mt-1 opacity-90">{formError}</p>
          </div>
        </div>
      ) : null}

      {triggersDeploy ? (
        <p className="border-border bg-muted text-muted-foreground mb-6 rounded-lg border p-3 text-sm">
          Saving commits to GitHub, which triggers a Vercel rebuild. Changes are
          usually live within a minute.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="order-2 lg:order-1">
          <Label className="mb-2 block">Body (MDX)</Label>
          <MdxEditor
            value={values.body}
            onChange={(body) => update("body", body)}
            toolbarExtra={
              <ImageUpload
                slug={values.slug}
                label="Insert image"
                onUploaded={(path) =>
                  setValues((current) => ({
                    ...current,
                    body: `${current.body.trimEnd()}\n\n![Describe this image](${path})\n`,
                  }))
                }
              />
            }
          />
          <FieldError message={errors["body"]} />
        </div>

        <aside className="order-1 grid gap-5 lg:order-2">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={values.title}
              onChange={(event) => handleTitleChange(event.target.value)}
              aria-invalid={Boolean(errors["frontmatter.title"])}
              maxLength={140}
              required
            />
            <FieldError message={errors["frontmatter.title"]} />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="slug">Slug</Label>
              {!slugLocked ? (
                <span className="text-muted-foreground text-xs">
                  auto from title
                </span>
              ) : null}
            </div>
            <Input
              id="slug"
              value={values.slug}
              onChange={(event) => {
                setSlugLocked(true);
                update("slug", event.target.value);
              }}
              onBlur={(event) => update("slug", slugify(event.target.value))}
              aria-invalid={Boolean(errors["frontmatter.slug"])}
              aria-describedby="slug-help"
              className="font-mono text-xs"
              required
            />
            <p id="slug-help" className="text-muted-foreground text-xs">
              /blog/{values.slug || "…"}
              {mode === "edit" && values.slug !== originalSlug
                ? " — renaming moves the file and breaks existing links"
                : ""}
            </p>
            <FieldError message={errors["frontmatter.slug"]} />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Description</Label>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  descriptionOk ? "text-muted-foreground" : "text-destructive",
                )}
              >
                {descriptionLength}/{DESCRIPTION_MAX}
              </span>
            </div>
            <Textarea
              id="description"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
              rows={4}
              aria-invalid={Boolean(errors["frontmatter.description"])}
              aria-describedby="description-help"
              required
            />
            <p id="description-help" className="text-muted-foreground text-xs">
              Used as the meta description and the summary in search, RSS and
              llms.txt. {DESCRIPTION_MIN}–{DESCRIPTION_MAX} characters.
            </p>
            <FieldError message={errors["frontmatter.description"]} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="date">Publish date</Label>
            <Input
              id="date"
              type="datetime-local"
              value={toDateTimeLocal(values.date)}
              onChange={(event) =>
                update("date", fromDateTimeLocal(event.target.value))
              }
              required
            />
            <FieldError message={errors["frontmatter.date"]} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={values.category}
              onChange={(event) => update("category", event.target.value)}
              placeholder="Architecture"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={values.tags}
              onChange={(event) => update("tags", event.target.value)}
              placeholder="nextjs, mdx, seo"
              aria-describedby="tags-help"
            />
            <p id="tags-help" className="text-muted-foreground text-xs">
              Comma separated, 12 maximum.
            </p>
            <FieldError message={errors["frontmatter.tags"]} />
          </div>

          <fieldset className="border-border grid gap-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Cover image</legend>

            <div className="grid gap-2">
              <Label htmlFor="cover-src" className="text-xs">
                Path
              </Label>
              <Input
                id="cover-src"
                value={values.coverImageSrc}
                onChange={(event) =>
                  update("coverImageSrc", event.target.value)
                }
                placeholder="/images/my-post/cover.png"
                className="font-mono text-xs"
              />
              <FieldError message={errors["frontmatter.coverImage.src"]} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cover-alt" className="text-xs">
                Alt text
              </Label>
              <Input
                id="cover-alt"
                value={values.coverImageAlt}
                onChange={(event) =>
                  update("coverImageAlt", event.target.value)
                }
                placeholder="Describe the image for screen readers"
                aria-invalid={Boolean(errors["frontmatter.coverImage.alt"])}
                disabled={!values.coverImageSrc}
              />
              <FieldError message={errors["frontmatter.coverImage.alt"]} />
            </div>

            <ImageUpload
              slug={values.slug}
              label="Upload cover"
              onUploaded={(path) =>
                setValues((current) => ({ ...current, coverImageSrc: path }))
              }
            />
          </fieldset>

          <div className="border-border flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="featured" className="cursor-pointer">
                Featured
              </Label>
              <p className="text-muted-foreground text-xs">
                Pinned to the top of the home page.
              </p>
            </div>
            <Switch
              id="featured"
              checked={values.featured}
              onCheckedChange={(checked) => update("featured", checked)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="status-select">Status</Label>
            <Select
              id="status-select"
              value={values.status}
              onChange={(event) =>
                update("status", event.target.value as PostStatus)
              }
            >
              <option value="draft">Draft — hidden from the public site</option>
              <option value="published">Published — visible to everyone</option>
            </Select>
          </div>
        </aside>
      </div>
    </form>
  );
}
