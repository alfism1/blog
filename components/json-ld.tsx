import type { JsonLd } from "@/lib/seo/jsonld";

/**
 * Emits structured data as a `<script type="application/ld+json">` tag.
 *
 * `<` is escaped so a stray `</script>` inside post content can never break out
 * of the tag — the standard XSS guard for inlined JSON.
 */
export function JsonLdScript({ data }: { data: JsonLd | JsonLd[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
