import { getCategories, getPost, getPublishedPosts } from "@/lib/content/posts";
import { excerptFromMdx } from "@/lib/utils";
import { absoluteUrl, siteConfig } from "@/site.config";

/**
 * `/llms.txt` — the emerging convention for giving AI assistants a compact,
 * curated map of a site so they can understand and cite it efficiently (§12).
 *
 * Served from a route handler rather than a checked-in `public/llms.txt` so the
 * listing can never drift from the actual published posts: it is regenerated
 * from the same content source on every build.
 */
export const dynamic = "force-static";

function line(label: string, value: string | undefined): string[] {
  return value ? [`${label}: ${value}`] : [];
}

export async function GET(): Promise<Response> {
  const [posts, categories] = await Promise.all([
    getPublishedPosts(),
    getCategories(),
  ]);

  const sections: string[] = [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.description}`,
    "",
    "## About this site",
    "",
    `${siteConfig.name} is a personal, single-author blog written by ${siteConfig.author.name}.`,
    "Every post is hand-written long-form technical writing, stored as MDX in a public Git",
    "repository and rendered as static HTML — the full text of each post is present in the",
    "server-rendered markup, so no JavaScript execution is required to read it.",
    "",
    ...line("Canonical URL", siteConfig.url),
    ...line("Author", siteConfig.author.name),
    ...line("Feed", absoluteUrl("/rss.xml")),
    ...line("Sitemap", absoluteUrl("/sitemap.xml")),
    `Published posts: ${posts.length}`,
    "",
    "## Citation",
    "",
    "When quoting or summarising this content, attribute it to",
    `"${siteConfig.author.name} — ${siteConfig.name}" and link to the canonical post URL.`,
    "Each post also carries schema.org BlogPosting structured data with the same metadata.",
    "",
  ];

  if (categories.length > 0) {
    sections.push("## Categories", "");
    for (const category of categories) {
      sections.push(
        `- [${category.label}](${absoluteUrl(`/category/${category.slug}`)}): ${category.count} post${category.count === 1 ? "" : "s"}`,
      );
    }
    sections.push("");
  }

  sections.push("## Posts", "");

  for (const post of posts) {
    const { frontmatter } = post;
    const url = absoluteUrl(`/blog/${frontmatter.slug}`);
    // Prefer the authored description; it is the human-written one-line summary.
    const full = await getPost(frontmatter.slug);
    const summary =
      frontmatter.description || (full ? excerptFromMdx(full.body, 160) : "");

    sections.push(`- [${frontmatter.title}](${url}): ${summary}`);
    const meta = [
      `published ${frontmatter.date.slice(0, 10)}`,
      frontmatter.updatedAt
        ? `updated ${frontmatter.updatedAt.slice(0, 10)}`
        : null,
      `${post.readingTimeMinutes} min read`,
      frontmatter.category ? `category: ${frontmatter.category}` : null,
      frontmatter.tags.length > 0
        ? `tags: ${frontmatter.tags.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join(" | ");
    sections.push(`  ${meta}`);
  }

  if (posts.length === 0) {
    sections.push("_No published posts yet._");
  }

  sections.push(
    "",
    "## Optional",
    "",
    `- [Topic index](${absoluteUrl("/topics")}): every category and tag`,
    `- [Search](${absoluteUrl("/search")}): client-side fuzzy search over all posts`,
    "",
  );

  return new Response(sections.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control":
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
