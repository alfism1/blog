import { MDXRemote } from "next-mdx-remote/rsc";

import { mdxComponents } from "@/lib/mdx/mdx-components";
import { mdxOptions } from "@/lib/mdx/options";

/**
 * Renders MDX on the server.
 *
 * `next-mdx-remote/rsc` (rather than `@next/mdx`) is required because content
 * lives outside `/app` and — in production — is fetched from the GitHub API at
 * build time rather than imported from disk.
 */
export function MdxContent({ source }: { source: string }) {
  return (
    <MDXRemote
      source={source}
      options={mdxOptions}
      components={mdxComponents}
    />
  );
}
