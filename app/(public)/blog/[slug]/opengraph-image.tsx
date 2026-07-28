import { ImageResponse } from "next/og";

import { getPublishedPost, getPublishedPosts } from "@/lib/content/posts";
import { formatDate } from "@/lib/utils";
import { siteConfig } from "@/site.config";

export const alt = "Post preview card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Prerender one card per published post instead of rendering on request. */
export async function generateStaticParams() {
  const posts = await getPublishedPosts();
  return posts.map((post) => ({ slug: post.frontmatter.slug }));
}

/**
 * Per-post Open Graph card, rendered with `next/og` at build time.
 *
 * Free and self-contained — no external screenshot service, no recurring cost.
 * Only system-safe layout primitives are used because Satori supports a narrow
 * flexbox-only subset of CSS.
 */
export default async function OpengraphImage({
  params,
}: {
  // Next 16: `params` is a Promise in image generation functions too.
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);

  const title = post?.frontmatter.title ?? siteConfig.name;
  const description = post?.frontmatter.description ?? siteConfig.description;
  const date = post ? formatDate(post.frontmatter.date) : null;
  const readingTime = post ? `${post.readingTimeMinutes} min read` : null;
  const tags = post?.frontmatter.tags.slice(0, 3) ?? [];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        background: "linear-gradient(135deg, #0d1017 0%, #1a2130 100%)",
        color: "#f2f5f9",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div
          style={{
            width: "14px",
            height: "44px",
            borderRadius: "999px",
            background: "#7aa2f7",
          }}
        />
        <div
          style={{
            fontSize: "28px",
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          {siteConfig.name}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div
          style={{
            fontSize: title.length > 68 ? "56px" : "68px",
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: "-0.03em",
            // Satori has no line-clamp; the font-size step above keeps long
            // titles inside the card.
            display: "flex",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: "28px",
            lineHeight: 1.4,
            color: "#a9b6cc",
            display: "flex",
          }}
        >
          {description.length > 150
            ? `${description.slice(0, 150)}…`
            : description}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "24px",
          color: "#8494ad",
        }}
      >
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          {date ? <span>{date}</span> : null}
          {date && readingTime ? <span>·</span> : null}
          {readingTime ? <span>{readingTime}</span> : null}
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          {tags.map((tag) => (
            <div
              key={tag}
              style={{
                display: "flex",
                padding: "6px 18px",
                borderRadius: "999px",
                border: "1px solid #3a4557",
                fontSize: "20px",
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    </div>,
    size,
  );
}
