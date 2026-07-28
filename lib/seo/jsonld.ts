import type { PostMeta } from "@/lib/content/types";
import { absoluteUrl, siteConfig } from "@/site.config";

/** Minimal structural type — schema.org objects are open-ended by design. */
export type JsonLd = Record<string, unknown>;

const personId = `${siteConfig.url}/#person`;
const websiteId = `${siteConfig.url}/#website`;

export function personSchema(): JsonLd {
  return {
    "@type": "Person",
    "@id": personId,
    name: siteConfig.author.name,
    url: siteConfig.author.url,
  };
}

/** `WebSite` + `SearchAction` so search engines can offer a sitelinks searchbox. */
export function websiteSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId,
    url: siteConfig.url,
    name: siteConfig.name,
    description: siteConfig.description,
    inLanguage: siteConfig.language,
    publisher: personSchema(),
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteConfig.url}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * `BlogPosting` for a post detail page.
 *
 * Completeness matters beyond classic SEO: AI answer engines lean on this block
 * for attribution, so headline/dates/author/image are all populated (§12).
 */
export function blogPostingSchema(post: PostMeta): JsonLd {
  const { frontmatter } = post;
  const url = absoluteUrl(`/blog/${frontmatter.slug}`);

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    headline: frontmatter.title,
    name: frontmatter.title,
    description: frontmatter.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: frontmatter.date,
    dateModified: frontmatter.updatedAt ?? frontmatter.date,
    author: personSchema(),
    publisher: personSchema(),
    image: [
      frontmatter.coverImage
        ? absoluteUrl(frontmatter.coverImage.src)
        : absoluteUrl(`/blog/${frontmatter.slug}/opengraph-image`),
    ],
    inLanguage: siteConfig.language,
    isPartOf: { "@id": websiteId },
    wordCount: post.wordCount,
    timeRequired: `PT${post.readingTimeMinutes}M`,
    keywords:
      frontmatter.tags.length > 0 ? frontmatter.tags.join(", ") : undefined,
    articleSection: frontmatter.category,
  };
}

export interface Crumb {
  name: string;
  /** Site-relative path. */
  path: string;
}

export function breadcrumbSchema(crumbs: Crumb[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/** `CollectionPage` + `ItemList` for tag/category/listing pages. */
export function collectionSchema(input: {
  name: string;
  description: string;
  path: string;
  posts: PostMeta[];
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    isPartOf: { "@id": websiteId },
    inLanguage: siteConfig.language,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: input.posts.length,
      itemListElement: input.posts.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/blog/${post.frontmatter.slug}`),
        name: post.frontmatter.title,
      })),
    },
  };
}
