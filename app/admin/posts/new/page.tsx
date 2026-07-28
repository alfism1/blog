import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { PostForm } from "@/components/admin/post-form";
import { auth } from "@/lib/auth";
import { emptyPostValues } from "@/lib/content/post-defaults";
import {
  getContentAdapter,
  resolveAdapterName,
  writesTriggerDeploy,
} from "@/lib/content/adapter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New post",
  robots: { index: false, follow: false },
};

export default async function NewPostPage() {
  const session = await auth();
  if (!session?.user)
    redirect("/admin/login?callbackUrl=%2Fadmin%2Fposts%2Fnew");

  // Fetched so the form can flag a duplicate slug before the round trip.
  const { posts } = await getContentAdapter().list();

  return (
    <AdminShell adapterName={resolveAdapterName()}>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">New post</h1>
      <PostForm
        mode="create"
        initialValues={emptyPostValues()}
        existingSlugs={posts.map((post) => post.frontmatter.slug)}
        triggersDeploy={writesTriggerDeploy()}
      />
    </AdminShell>
  );
}
