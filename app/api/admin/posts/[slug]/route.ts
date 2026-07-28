import { NextResponse } from "next/server";

import {
  apiError,
  handleApiError,
  requireAdmin,
  revalidatePostRoutes,
} from "@/lib/api/guard";
import { getContentAdapter } from "@/lib/content/adapter";
import { postUpdateSchema, slugSchema } from "@/lib/content/schema";

export const dynamic = "force-dynamic";

/** GET /api/admin/posts/[slug] — one post with its body, drafts included. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const { slug } = await params;
    const parsedSlug = slugSchema.safeParse(slug);
    if (!parsedSlug.success) return apiError("Invalid slug.", 400);

    const post = await getContentAdapter().get(parsedSlug.data);
    if (!post) return apiError("Post not found.", 404);

    return NextResponse.json({ post });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PUT /api/admin/posts/[slug] — update, including a slug rename. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const { slug } = await params;
    const payload = await request.json();

    const parsed = postUpdateSchema.safeParse({
      ...payload,
      // The URL is authoritative for which post is being edited.
      previousSlug: slug,
    });
    if (!parsed.success) return handleApiError(parsed.error);

    const adapter = getContentAdapter();
    const { frontmatter, body, previousSlug } = parsed.data;

    if (frontmatter.slug !== previousSlug) {
      const { posts } = await adapter.list();
      if (posts.some((post) => post.frontmatter.slug === frontmatter.slug)) {
        return apiError("That slug is already in use.", 409, {
          "frontmatter.slug": "A post with this slug already exists.",
        });
      }
    }

    const result = await adapter.update(previousSlug, { frontmatter, body });

    revalidatePostRoutes({
      slug: result.slug,
      previousSlug,
      category: frontmatter.category,
      tags: frontmatter.tags,
    });

    return NextResponse.json({
      slug: result.slug,
      commitSha: result.commitSha,
      triggersDeploy: result.triggersDeploy,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/admin/posts/[slug] — remove a post.
 * Pass `?deleteImages=true` to remove `public/images/[slug]/` in the same commit.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const { slug } = await params;
    const parsedSlug = slugSchema.safeParse(slug);
    if (!parsedSlug.success) return apiError("Invalid slug.", 400);

    const deleteImages =
      new URL(request.url).searchParams.get("deleteImages") === "true";

    const result = await getContentAdapter().remove(parsedSlug.data, {
      deleteImages,
    });

    revalidatePostRoutes({ slug: result.slug });

    return NextResponse.json({
      slug: result.slug,
      commitSha: result.commitSha,
      triggersDeploy: result.triggersDeploy,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
