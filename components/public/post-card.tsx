import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { PostMeta } from "@/lib/content/types";
import { taxonomyKey } from "@/lib/content/posts";
import { cn, formatDate, toDateAttribute } from "@/lib/utils";

interface PostCardProps {
  post: PostMeta;
  /** Larger treatment with a cover image, used for the featured slot. */
  featured?: boolean;
  /** `true` for the first card above the fold so its image is not lazy-loaded. */
  priority?: boolean;
}

export function PostCard({ post, featured = false, priority }: PostCardProps) {
  const { frontmatter, readingTimeMinutes } = post;
  const href = `/blog/${frontmatter.slug}`;

  return (
    <article
      className={cn(
        "group border-border relative rounded-xl border p-5 transition-colors",
        "hover:border-foreground/25 hover:bg-accent/40",
        featured && "sm:p-6",
      )}
    >
      {featured && frontmatter.coverImage ? (
        <div className="border-border mb-5 overflow-hidden rounded-lg border">
          <Image
            src={frontmatter.coverImage.src}
            alt={frontmatter.coverImage.alt}
            width={1200}
            height={630}
            priority={priority}
            sizes="(max-width: 768px) 100vw, 800px"
            className="aspect-[1200/630] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        </div>
      ) : null}

      <div className="text-muted-foreground mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <time dateTime={toDateAttribute(frontmatter.date)}>
          {formatDate(frontmatter.date)}
        </time>
        <span aria-hidden="true">·</span>
        <span>{readingTimeMinutes} min read</span>
        {frontmatter.category ? (
          <>
            <span aria-hidden="true">·</span>
            {/* Relative z-index lifts this above the card's stretched link. */}
            <Link
              href={`/category/${taxonomyKey(frontmatter.category)}`}
              className="hover:text-foreground relative z-10 transition-colors"
            >
              {frontmatter.category}
            </Link>
          </>
        ) : null}
      </div>

      <h2
        className={cn(
          "font-semibold tracking-tight",
          featured ? "text-2xl sm:text-3xl" : "text-lg",
        )}
      >
        <Link href={href} className="after:absolute after:inset-0">
          {frontmatter.title}
        </Link>
      </h2>

      <p
        className={cn(
          "text-muted-foreground mt-2 leading-relaxed",
          featured ? "text-base" : "text-sm",
        )}
      >
        {frontmatter.description}
      </p>

      {frontmatter.tags.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {frontmatter.tags.slice(0, 4).map((tag) => (
            <li key={tag}>
              <Link
                href={`/tag/${taxonomyKey(tag)}`}
                className="relative z-10"
                aria-label={`Posts tagged ${tag}`}
              >
                <Badge
                  variant="outline"
                  className="hover:border-foreground/30 hover:text-foreground transition-colors"
                >
                  {tag}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function PostList({
  posts,
  emptyMessage = "No posts yet — check back soon.",
}: {
  posts: PostMeta[];
  emptyMessage?: string;
}) {
  if (posts.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-xl border border-dashed p-10 text-center">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {posts.map((post) => (
        <PostCard key={post.frontmatter.slug} post={post} />
      ))}
    </div>
  );
}
