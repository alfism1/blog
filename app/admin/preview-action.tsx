"use server";

import type { ReactNode } from "react";
import { compileMDX } from "next-mdx-remote/rsc";

import { auth } from "@/lib/auth";
import { mdxOptions } from "@/lib/mdx/options";
import { previewMdxComponents } from "@/lib/mdx/mdx-components";

export interface PreviewResult {
  ok: boolean;
  /** Rendered MDX, streamed to the client as an RSC payload. */
  content?: ReactNode;
  error?: string;
}

/**
 * Compile MDX on the server and hand the rendered tree back to the editor.
 *
 * Uses the same plugin pipeline and component map as the public post page, so
 * the preview cannot diverge from what actually ships. `compileMDX` is awaited
 * here (rather than rendering `<MDXRemote>` lazily) so a syntax error surfaces
 * as a message in the preview pane instead of a broken RSC stream.
 */
export async function renderMdxPreview(body: string): Promise<PreviewResult> {
  // Server Actions are public HTTP endpoints; authorise every one of them.
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Not signed in." };
  }

  if (body.trim().length === 0) {
    return { ok: true, content: null };
  }

  try {
    const { content } = await compileMDX({
      source: body,
      options: mdxOptions,
      components: previewMdxComponents,
    });
    return { ok: true, content };
  } catch (error) {
    return {
      ok: false,
      error: (error as Error).message || "MDX failed to compile.",
    };
  }
}
