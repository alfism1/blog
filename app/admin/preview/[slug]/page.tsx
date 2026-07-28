import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PencilIcon } from "lucide-react";

import { AdminShell } from "@/components/admin/admin-shell";
import { MdxContent } from "@/components/mdx-content";
import { TableOfContents } from "@/components/public/table-of-contents";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { getContentAdapter, resolveAdapterName } from "@/lib/content/adapter";
import { buildToc } from "@/lib/mdx/toc";
import { formatDate, toDateAttribute } from "@/lib/utils";
import { siteConfig } from "@/site.config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Authenticated draft preview.
 *
 * Drafts are excluded from `/blog/[slug]`, the sitemap, RSS and the search index
 * (§7), so this is the only way to see one rendered. It lives under `/admin` so
 * `proxy.ts` gates it, and the session is re-checked here regardless.
 */
export default async function PreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect(
      `/admin/login?callbackUrl=${encodeURIComponent(`/admin/preview/${slug}`)}`,
    );
  }

  const post = await getContentAdapter().get(slug);
  if (!post) notFound();

  const { frontmatter } = post;
  const toc = buildToc(post.body);
  const showToc = post.wordCount >= siteConfig.tocMinWords && toc.length >= 2;

  return (
    <AdminShell adapterName={resolveAdapterName()}>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge
            variant={frontmatter.status === "published" ? "success" : "warning"}
          >
            {frontmatter.status === "published" ? "Published" : "Draft preview"}
          </Badge>
          <p className="text-muted-foreground text-sm">
            Not visible to the public
          </p>
        </div>
        <Link
          href={`/admin/posts/${frontmatter.slug}/edit`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <PencilIcon aria-hidden="true" />
          Edit
        </Link>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-12">
        <article className="min-w-0">
          <header className="mb-8">
            <div className="text-muted-foreground mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <time dateTime={toDateAttribute(frontmatter.date)}>
                {formatDate(frontmatter.date)}
              </time>
              <span aria-hidden="true">·</span>
              <span>{post.readingTimeMinutes} min read</span>
              {frontmatter.category ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{frontmatter.category}</span>
                </>
              ) : null}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {frontmatter.title}
            </h1>
            <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
              {frontmatter.description}
            </p>
          </header>

          {frontmatter.coverImage ? (
            <Image
              src={frontmatter.coverImage.src}
              alt={frontmatter.coverImage.alt}
              width={1200}
              height={630}
              sizes="(max-width: 1024px) 100vw, 720px"
              className="border-border mb-10 aspect-[1200/630] w-full rounded-xl border object-cover"
            />
          ) : null}

          <div className="prose">
            <MdxContent source={post.body} />
          </div>

          {frontmatter.tags.length > 0 ? (
            <footer className="border-border mt-12 border-t pt-6">
              <ul className="flex flex-wrap gap-2">
                {frontmatter.tags.map((tag) => (
                  <li key={tag}>
                    <Badge variant="outline">{tag}</Badge>
                  </li>
                ))}
              </ul>
            </footer>
          ) : null}
        </article>

        {showToc ? (
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <TableOfContents entries={toc} />
            </div>
          </aside>
        ) : null}
      </div>
    </AdminShell>
  );
}
