import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangleIcon, PlusIcon } from "lucide-react";

import { AdminShell } from "@/components/admin/admin-shell";
import { PostTable } from "@/components/admin/post-table";
import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { getContentAdapter, resolveAdapterName } from "@/lib/content/adapter";
import type { InvalidPost, PostMeta } from "@/lib/content/types";
import { pluralize } from "@/lib/utils";

/** The dashboard must always show the repository's current state. */
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  // Re-verify server-side; `proxy.ts` is the outer gate, not the only one.
  const session = await auth();
  if (!session?.user) redirect("/admin/login?callbackUrl=%2Fadmin");

  const adapterName = resolveAdapterName();

  let posts: PostMeta[] = [];
  let invalid: InvalidPost[] = [];
  let loadError: string | null = null;

  try {
    const result = await getContentAdapter().list();
    posts = result.posts.sort(
      (a, b) => Date.parse(b.frontmatter.date) - Date.parse(a.frontmatter.date),
    );
    invalid = result.invalid;
  } catch (error) {
    loadError = (error as Error).message;
  }

  const published = posts.filter((p) => p.frontmatter.status === "published");
  const drafts = posts.filter((p) => p.frontmatter.status === "draft");

  return (
    <AdminShell adapterName={adapterName}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Posts</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {published.length} published · {drafts.length}{" "}
            {pluralize(drafts.length, "draft")}
          </p>
        </div>
        <Link href="/admin/posts/new" className={buttonVariants()}>
          <PlusIcon aria-hidden="true" />
          New post
        </Link>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/8 text-destructive mb-6 flex items-start gap-2 rounded-lg border p-4 text-sm"
        >
          <AlertTriangleIcon
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="font-medium">Could not load posts</p>
            <p className="mt-1 opacity-90">{loadError}</p>
          </div>
        </div>
      ) : null}

      {invalid.length > 0 ? (
        <div
          role="alert"
          className="border-border bg-muted mb-6 rounded-lg border p-4 text-sm"
        >
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangleIcon className="size-4" aria-hidden="true" />
            {invalid.length} {pluralize(invalid.length, "file")} skipped —
            invalid frontmatter
          </p>
          <ul className="text-muted-foreground mt-2 space-y-1">
            {invalid.map((entry) => (
              <li key={entry.path}>
                <code className="text-xs">{entry.path}</code> — {entry.error}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <PostTable posts={posts} />
    </AdminShell>
  );
}
