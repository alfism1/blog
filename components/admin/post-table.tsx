"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLinkIcon, EyeIcon, PencilIcon, StarIcon } from "lucide-react";

import { DeletePostDialog } from "@/components/admin/delete-post-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button";
import type { PostMeta } from "@/lib/content/types";
import { cn, formatShortDate, toDateAttribute } from "@/lib/utils";

type StatusFilter = "all" | "published" | "draft";

export function PostTable({ posts }: { posts: PostMeta[] }) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");

  const visible = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (status !== "all" && post.frontmatter.status !== status) return false;
      if (!term) return true;
      return (
        post.frontmatter.title.toLowerCase().includes(term) ||
        post.frontmatter.slug.includes(term) ||
        post.frontmatter.tags.some((tag) => tag.toLowerCase().includes(term)) ||
        (post.frontmatter.category ?? "").toLowerCase().includes(term)
      );
    });
  }, [posts, query, status]);

  if (posts.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-xl border border-dashed p-12 text-center">
        <p className="font-medium">No posts yet</p>
        <p className="mt-1 text-sm">
          Create your first post to get the blog started.
        </p>
        <Link
          href="/admin/posts/new"
          className={cn(buttonVariants({ variant: "outline" }), "mt-5")}
        >
          New post
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="post-filter" className="sr-only">
            Filter posts
          </label>
          <Input
            id="post-filter"
            type="search"
            placeholder="Filter by title, slug, tag or category…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="sm:w-44">
          <label htmlFor="status-filter" className="sr-only">
            Filter by status
          </label>
          <Select
            id="status-filter"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </Select>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
          No posts match that filter.
        </div>
      ) : (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[42rem] text-sm">
            <caption className="sr-only">
              All posts, newest first, with edit and delete actions
            </caption>
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left font-medium">
                  Title
                </th>
                <th scope="col" className="px-4 py-2.5 text-left font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-2.5 text-left font-medium">
                  Date
                </th>
                <th scope="col" className="px-4 py-2.5 text-left font-medium">
                  Tags
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {visible.map((post) => {
                const { frontmatter } = post;
                const isPublished = frontmatter.status === "published";

                return (
                  <tr key={frontmatter.slug} className="hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {frontmatter.featured ? (
                          <StarIcon
                            className="mt-0.5 size-3.5 shrink-0 fill-amber-400 text-amber-400"
                            aria-label="Featured"
                          />
                        ) : null}
                        <div className="min-w-0">
                          <Link
                            href={`/admin/posts/${frontmatter.slug}/edit`}
                            className="font-medium hover:underline"
                          >
                            {frontmatter.title}
                          </Link>
                          <p className="text-muted-foreground truncate text-xs">
                            /blog/{frontmatter.slug}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={isPublished ? "success" : "warning"}>
                        {isPublished ? "Published" : "Draft"}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                      <time dateTime={toDateAttribute(frontmatter.date)}>
                        {formatShortDate(frontmatter.date)}
                      </time>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {frontmatter.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                        {frontmatter.tags.length > 3 ? (
                          <span className="text-muted-foreground text-xs">
                            +{frontmatter.tags.length - 3}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isPublished ? (
                          <Link
                            href={`/blog/${frontmatter.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(
                              buttonVariants({
                                variant: "ghost",
                                size: "icon",
                              }),
                            )}
                            aria-label={`View ${frontmatter.title} on the site`}
                          >
                            <ExternalLinkIcon aria-hidden="true" />
                          </Link>
                        ) : (
                          <Link
                            href={`/admin/preview/${frontmatter.slug}`}
                            className={cn(
                              buttonVariants({
                                variant: "ghost",
                                size: "icon",
                              }),
                            )}
                            aria-label={`Preview draft ${frontmatter.title}`}
                          >
                            <EyeIcon aria-hidden="true" />
                          </Link>
                        )}
                        <Link
                          href={`/admin/posts/${frontmatter.slug}/edit`}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "icon" }),
                          )}
                          aria-label={`Edit ${frontmatter.title}`}
                        >
                          <PencilIcon aria-hidden="true" />
                        </Link>
                        <DeletePostDialog
                          slug={frontmatter.slug}
                          title={frontmatter.title}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
