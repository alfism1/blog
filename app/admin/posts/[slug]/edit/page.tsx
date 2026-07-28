import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EyeIcon } from "lucide-react";

import { AdminShell } from "@/components/admin/admin-shell";
import { PostForm } from "@/components/admin/post-form";
import type { PostFormValues } from "@/lib/content/post-defaults";
import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import {
  getContentAdapter,
  resolveAdapterName,
  writesTriggerDeploy,
} from "@/lib/content/adapter";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Edit ${slug}`, robots: { index: false, follow: false } };
}

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect(
      `/admin/login?callbackUrl=${encodeURIComponent(`/admin/posts/${slug}/edit`)}`,
    );
  }

  const adapter = getContentAdapter();
  const [post, { posts }] = await Promise.all([
    adapter.get(slug),
    adapter.list(),
  ]);
  if (!post) notFound();

  const { frontmatter } = post;

  const initialValues: PostFormValues = {
    title: frontmatter.title,
    slug: frontmatter.slug,
    description: frontmatter.description,
    date: frontmatter.date,
    updatedAt: frontmatter.updatedAt,
    tags: frontmatter.tags.join(", "),
    category: frontmatter.category ?? "",
    coverImageSrc: frontmatter.coverImage?.src ?? "",
    coverImageAlt: frontmatter.coverImage?.alt ?? "",
    status: frontmatter.status,
    featured: frontmatter.featured,
    body: post.body,
  };

  return (
    <AdminShell adapterName={resolveAdapterName()}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Edit post</h1>
        <Link
          href={
            frontmatter.status === "published"
              ? `/blog/${frontmatter.slug}`
              : `/admin/preview/${frontmatter.slug}`
          }
          target={frontmatter.status === "published" ? "_blank" : undefined}
          rel={frontmatter.status === "published" ? "noreferrer" : undefined}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <EyeIcon aria-hidden="true" />
          {frontmatter.status === "published" ? "View live" : "Preview draft"}
        </Link>
      </div>

      <PostForm
        mode="edit"
        initialValues={initialValues}
        existingSlugs={posts.map((entry) => entry.frontmatter.slug)}
        triggersDeploy={writesTriggerDeploy()}
      />
    </AdminShell>
  );
}
