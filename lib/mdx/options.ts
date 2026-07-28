import type { Options as PrettyCodeOptions } from "rehype-pretty-code";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

const prettyCodeOptions: PrettyCodeOptions = {
  // Dual theme: shiki emits both palettes as CSS variables and globals.css
  // swaps them under `.dark`, so highlighting follows the theme with zero JS.
  theme: { light: "github-light", dark: "github-dark-dimmed" },
  keepBackground: false,
  defaultLang: { block: "text", inline: "text" },
};

/**
 * Shared remark/rehype pipeline for every MDX render (post pages and the admin
 * live preview) so what an author previews is exactly what ships.
 */
export const mdxOptions = {
  mdxOptions: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      [rehypePrettyCode, prettyCodeOptions],
      [
        rehypeAutolinkHeadings,
        {
          behavior: "append",
          properties: {
            className: ["heading-anchor"],
            ariaHidden: "true",
            tabIndex: -1,
          },
          content: { type: "text", value: "#" },
        },
      ],
    ],
  },
  // Frontmatter is parsed by gray-matter upstream; the body handed to MDX has
  // none left, so parsing it again would be wasted work.
  parseFrontmatter: false,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- next-mdx-remote types plugin tuples loosely
} as any;
