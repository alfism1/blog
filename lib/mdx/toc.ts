import GithubSlugger from "github-slugger";

export interface TocEntry {
  id: string;
  text: string;
  depth: 2 | 3;
}

/**
 * Extract h2/h3 headings from raw MDX to build a table of contents.
 *
 * Parsing the source directly (rather than walking the compiled tree) keeps the
 * ToC available on the *server* before MDX rendering, so it ships as static HTML
 * with no client JS. `GithubSlugger` is the same algorithm `rehype-slug` uses,
 * so the generated ids match the anchors in the rendered document.
 */
export function buildToc(body: string): TocEntry[] {
  const slugger = new GithubSlugger();
  // Strip fenced code blocks first: `# comment` inside a bash sample is not a heading.
  const withoutCode = body.replace(/```[\s\S]*?```/g, "");

  const entries: TocEntry[] = [];
  const headingPattern = /^(#{2,3})\s+(.+?)\s*#*\s*$/gm;

  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(withoutCode)) !== null) {
    const depth = match[1].length as 2 | 3;
    const text = match[2]
      .replace(/`([^`]*)`/g, "$1")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_]/g, "")
      .trim();
    if (!text) continue;
    entries.push({ id: slugger.slug(text), text, depth });
  }

  return entries;
}
