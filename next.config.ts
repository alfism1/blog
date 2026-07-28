import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack does not guess from a parent lockfile.
  turbopack: { root: path.resolve(import.meta.dirname) },

  // `typedRoutes` is deliberately off: most hrefs here are built at runtime from
  // content (post slugs, taxonomy slugs, links authored inside MDX), which the
  // route type union cannot express without casting every one of them.
  typedRoutes: false,

  images: {
    // Every image lives in `public/images/` and is committed to the repo, so no
    // remote patterns are needed. Adding one would also be the only way a
    // third-party host could bill against the image optimizer.
    formats: ["image/avif", "image/webp"],
    // Next 16 defaults to `[75]`; the extra step lets cover art be sharper.
    qualities: [75, 90],
  },

  // MDX content is read from disk at build time and, with CONTENT_SOURCE=local,
  // at runtime too. Tracing keeps `content/` in the serverless bundle.
  outputFileTracingIncludes: {
    "/**": ["./content/**/*"],
  },

  // Shiki ships a large grammar/theme set; bundling it server-side keeps cold
  // starts predictable rather than resolving it from node_modules at runtime.
  serverExternalPackages: [],

  async headers() {
    return [
      {
        // Defence-in-depth headers for every route. Content-Security-Policy is
        // intentionally omitted: `next/font` and the theme script both inline
        // styles, and a permissive CSP is worse than an honest absence.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        // Uploaded images are immutable: a new image gets a new filename.
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
