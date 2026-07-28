import { NextResponse } from "next/server";

import { apiError, handleApiError, requireAdmin } from "@/lib/api/guard";
import { getContentAdapter } from "@/lib/content/adapter";
import { slugify, uploadSchema } from "@/lib/content/schema";

export const dynamic = "force-dynamic";

/**
 * 4 MB. Vercel's serverless request body limit is 4.5 MB, and GitHub's contents
 * API base64-encodes the payload (~33% overhead), so this is the practical
 * ceiling for a single upload.
 */
const MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED_TYPES = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
  ["image/gif", "gif"],
  ["image/svg+xml", "svg"],
]);

/** Normalise an uploaded filename to `kebab-name-<timestamp>.<ext>`. */
function safeFilename(original: string, mimeType: string): string {
  const extension = ALLOWED_TYPES.get(mimeType)!;
  const base =
    slugify(original.replace(/\.[^./\\]+$/, "")).slice(0, 60) || "image";
  // The timestamp makes uploads immutable, so images can be cached hard and a
  // re-upload never has to bust a CDN entry.
  return `${base}-${Date.now().toString(36)}.${extension}`;
}

/** POST /api/admin/upload — multipart form with `file` and `slug`. */
export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const slugValue = formData.get("slug");

    if (!(file instanceof File)) {
      return apiError("No file was uploaded.", 400);
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return apiError(
        `Unsupported file type "${file.type || "unknown"}". Allowed: PNG, JPEG, WebP, AVIF, GIF, SVG.`,
        415,
      );
    }

    if (file.size === 0) return apiError("The uploaded file is empty.", 400);

    if (file.size > MAX_BYTES) {
      return apiError(
        `File is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_BYTES / 1024 / 1024} MB — compress it first.`,
        413,
      );
    }

    const parsed = uploadSchema.safeParse({
      slug: typeof slugValue === "string" ? slugValue : "",
      filename: safeFilename(file.name, file.type),
    });
    if (!parsed.success) return handleApiError(parsed.error);

    const data = Buffer.from(await file.arrayBuffer());

    const result = await getContentAdapter().uploadImage({
      slug: parsed.data.slug,
      filename: parsed.data.filename,
      data,
    });

    return NextResponse.json(
      {
        path: result.path,
        commitSha: result.commitSha,
        triggersDeploy: result.triggersDeploy,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
