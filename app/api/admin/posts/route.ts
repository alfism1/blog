import { NextResponse } from "next/server";

import {
  apiError,
  handleApiError,
  requireAdmin,
  revalidatePostRoutes,
} from "@/lib/api/guard";
import { getContentAdapter } from "@/lib/content/adapter";
import { postInputSchema } from "@/lib/content/schema";

/** Admin data is never cacheable — it must reflect the repo as it is now. */
export const dynamic = "force-dynamic";

/** GET /api/admin/posts — every post, drafts included. */
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const { posts, invalid } = await getContentAdapter().list();
    return NextResponse.json({
      posts: posts.sort(
        (a, b) =>
          Date.parse(b.frontmatter.date) - Date.parse(a.frontmatter.date),
      ),
      invalid,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/admin/posts — create a post. */
export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const payload = await request.json();
    const parsed = postInputSchema.safeParse(payload);
    if (!parsed.success) {
      return handleApiError(parsed.error);
    }

    const adapter = getContentAdapter();
    const { frontmatter, body } = parsed.data;

    // Uniqueness is enforced here as well as in the adapter so the admin gets a
    // field-level message rather than a bare conflict (§14).
    const { posts } = await adapter.list();
    if (posts.some((post) => post.frontmatter.slug === frontmatter.slug)) {
      return apiError("That slug is already in use.", 409, {
        "frontmatter.slug": "A post with this slug already exists.",
      });
    }

    const result = await adapter.create({ frontmatter, body });

    revalidatePostRoutes({
      slug: result.slug,
      category: frontmatter.category,
      tags: frontmatter.tags,
    });

    return NextResponse.json(
      {
        slug: result.slug,
        commitSha: result.commitSha,
        triggersDeploy: result.triggersDeploy,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
