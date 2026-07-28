import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

/** Images authored as `![alt](/images/…)` have no intrinsic size in markdown. */
const FALLBACK_IMAGE_WIDTH = 1600;
const FALLBACK_IMAGE_HEIGHT = 900;

function MdxLink({ href = "", ...props }: ComponentPropsWithoutRef<"a">) {
  if (href.startsWith("/")) {
    return <Link href={href} {...props} />;
  }
  if (href.startsWith("#")) {
    return <a href={href} {...props} />;
  }
  return <a href={href} target="_blank" rel="noopener noreferrer" {...props} />;
}

function MdxImage({
  src,
  alt,
  width,
  height,
  title,
}: ComponentPropsWithoutRef<"img">) {
  if (typeof src !== "string" || src.length === 0) return null;

  // Alt text is an accessibility and SEO requirement — surface the omission
  // loudly in development instead of shipping a silently unlabelled image.
  if (process.env.NODE_ENV !== "production" && !alt) {
    console.warn(`[mdx] image is missing alt text: ${src}`);
  }

  const image = (
    <Image
      src={src}
      alt={alt ?? ""}
      width={Number(width) || FALLBACK_IMAGE_WIDTH}
      height={Number(height) || FALLBACK_IMAGE_HEIGHT}
      sizes="(max-width: 768px) 100vw, 720px"
      className="h-auto w-full"
      // Remote images need a configured loader; everything under /images is local.
      unoptimized={/^https?:\/\//.test(src)}
    />
  );

  if (!title) return image;

  return (
    <figure>
      {image}
      <figcaption>{title}</figcaption>
    </figure>
  );
}

/** Wide tables scroll inside their own container, never the page. */
function MdxTable(props: ComponentPropsWithoutRef<"table">) {
  return (
    <div className="table-wrapper">
      <table {...props} />
    </div>
  );
}

type CalloutVariant = "note" | "tip" | "warning";

const calloutStyles: Record<CalloutVariant, string> = {
  note: "border-l-ring bg-muted",
  tip: "border-l-[var(--success)] bg-muted",
  warning: "border-l-destructive bg-destructive/5",
};

const calloutLabels: Record<CalloutVariant, string> = {
  note: "Note",
  tip: "Tip",
  warning: "Warning",
};

/** `<Callout type="warning">…</Callout>` — usable directly inside MDX. */
function Callout({
  type = "note",
  title,
  children,
}: {
  type?: CalloutVariant;
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside
      className={cn(
        "my-6 rounded-r-lg border-l-4 px-4 py-3 text-[0.95rem]",
        calloutStyles[type],
      )}
      role="note"
      aria-label={title ?? calloutLabels[type]}
    >
      <p className="mb-1 text-xs font-semibold tracking-wide uppercase opacity-70">
        {title ?? calloutLabels[type]}
      </p>
      <div className="[&>*+*]:mt-2 [&>p]:m-0">{children}</div>
    </aside>
  );
}

/** Explicitly sized figure for MDX authors who know the image dimensions. */
function Figure({
  src,
  alt,
  caption,
  width = FALLBACK_IMAGE_WIDTH,
  height = FALLBACK_IMAGE_HEIGHT,
}: {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}) {
  return (
    <figure>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes="(max-width: 768px) 100vw, 720px"
        className="h-auto w-full"
        unoptimized={/^https?:\/\//.test(src)}
      />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

/**
 * A short definition block. Placing one near the top of a long post measurably
 * improves both human skimmability and how cleanly AI answer engines can
 * extract and attribute the claim (see the GEO notes in the README).
 */
function KeyTakeaway({ children }: { children: ReactNode }) {
  return (
    <aside
      className="border-border bg-muted my-6 rounded-lg border p-4"
      aria-label="Key takeaway"
    >
      <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
        Key takeaway
      </p>
      <div className="[&>*+*]:mt-2 [&>p]:m-0">{children}</div>
    </aside>
  );
}

export const mdxComponents = {
  a: MdxLink,
  img: MdxImage,
  table: MdxTable,
  Callout,
  Figure,
  KeyTakeaway,
};

function PreviewImage({
  src,
  alt,
  width,
  height,
  title,
}: ComponentPropsWithoutRef<"img">) {
  if (typeof src !== "string" || src.length === 0) return null;

  if (process.env.NODE_ENV !== "production" && !alt) {
    console.warn(`[mdx] image is missing alt text: ${src}`);
  }

  return (
    <img
      src={src}
      alt={alt ?? ""}
      width={Number(width) || FALLBACK_IMAGE_WIDTH}
      height={Number(height) || FALLBACK_IMAGE_HEIGHT}
      className="h-auto w-full"
    />
  );
}

function PreviewFigure({
  src,
  alt,
  caption,
  width = FALLBACK_IMAGE_WIDTH,
  height = FALLBACK_IMAGE_HEIGHT,
}: {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}) {
  return (
    <figure>
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="h-auto w-full"
      />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

export const previewMdxComponents = {
  a: MdxLink,
  img: PreviewImage,
  table: MdxTable,
  Callout,
  Figure: PreviewFigure,
  KeyTakeaway,
};
