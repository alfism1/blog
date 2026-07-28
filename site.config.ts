/**
 * Central, edit-me-first configuration for the blog.
 * Everything here is safe to expose to the client bundle.
 */

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export const siteConfig = {
  name: "alfism",
  title: "alfism — Notes on software, systems and craft",
  description:
    "A personal blog about software architecture, engineering practice and the craft of building things that last.",
  /** Canonical origin. Falls back to localhost so dev never emits broken absolute URLs. */
  url: normalizeUrl(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  locale: "en_US",
  language: "en",
  author: {
    name: "Alfi Samudro",
    email: "alfialfarisi@gmail.com",
    url: normalizeUrl(
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    ),
  },
  /** Shown in the footer + used for the RSS feed copyright line. */
  copyright: `© ${new Date().getFullYear()} Alfi Samudro`,
  social: {
    github: "https://github.com/",
    x: "https://x.com/",
  },
  /** Posts per page on paginated listings. */
  postsPerPage: 10,
  /** Headings render a table of contents only past this word count. */
  tocMinWords: 400,
  nav: [
    { href: "/", label: "Home" },
    { href: "/topics", label: "Topics" },
    { href: "/search", label: "Search" },
  ],
} as const;

export type SiteConfig = typeof siteConfig;

/** Absolute URL helper — always returns a fully-qualified URL. */
export function absoluteUrl(path = "/"): string {
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}
