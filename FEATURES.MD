# Next.js 16 MDX-Powered Blog — Full Implementation Prompt

## 1. Project Overview

Build a complete, production-ready personal blog application with two clearly separated surfaces:

1. **Admin Panel** (`/admin/*`) — private, authenticated area where the site owner can Create, Read, Update, and Delete blog posts.
2. **Public Blog** (`/`, `/blog/*`, etc.) — public-facing, read-only pages for visitors. No login, no registration, no comments, no multi-author system.

Content is stored as MDX files inside the Git repository — there is **no traditional database**. The Git repo itself is the source of truth for all content.

## 2. Hard Constraints

- **Zero recurring cost.** Only expense allowed is the domain name. Every service/library used must be on a free tier that comfortably covers a personal blog's traffic.
- **Deployment target:** Vercel (Hobby/free plan).
- **Framework:** Next.js 16, App Router, TypeScript (strict mode), React Server Components by default.
- **Content storage:** MDX files committed to the Git repository. No MongoDB, Postgres, Supabase, etc.
- **No comments system. No multi-author system. No public user accounts.**
- **Single admin user only.**
- Public pages must require **zero authentication** and must not expose any admin functionality or routes in their bundle.

## 3. Critical Architecture Decision: How CRUD Works Without a Database

Vercel Serverless/Edge Functions run on an **ephemeral, read-only filesystem** in production. Writing directly to `content/posts/*.mdx` from an API route will silently fail to persist (it may appear to "work" in local dev but will not survive a new deployment or even the next cold start).

**Required solution — Git-based CMS pattern:**

- All admin write operations (create/update/delete post, upload image) must go through the **GitHub REST API** (use `octokit`/`@octokit/rest`) using a **fine-scoped GitHub Personal Access Token** stored as a server-only environment variable.
- Flow: Admin submits a form → server action / API route authenticates the request → calls GitHub API to create/update/delete the corresponding `.mdx` file (and any uploaded image) directly in the repo → GitHub push triggers Vercel's existing Git integration → Vercel auto-redeploys → change goes live within ~30–60 seconds.
- Admin panel should show a "Deploying..." status by polling the Vercel Deployment API (optional, using a `VERCEL_TOKEN`) or simply inform the user "Changes pushed. Live in ~1 minute."
- Local development should still support direct filesystem read/write (via Node `fs`) for a fast dev loop, but production must always go through the GitHub API path. Abstract this behind a single content-repository interface (e.g. `lib/content/adapter.ts`) with two implementations: `localFsAdapter` and `githubApiAdapter`, selected via `process.env.NODE_ENV` or a custom flag.

## 4. Tech Stack

| Concern                    | Choice                                                                         | Notes                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Framework                  | Next.js 16 (App Router)                                                        | Server Components, Server Actions                                                                                |
| Language                   | TypeScript (strict)                                                            |                                                                                                                  |
| Styling                    | Tailwind CSS                                                                   |                                                                                                                  |
| UI Components              | shadcn/ui                                                                      | copy-in components, no runtime cost                                                                              |
| Content format             | MDX                                                                            | via `next-mdx-remote` (needed since content lives outside `/app`, is fetched dynamically via GitHub API in prod) |
| Frontmatter parsing        | `gray-matter`                                                                  |                                                                                                                  |
| Content persistence (prod) | GitHub REST API via `octokit`                                                  | commits `.mdx` files directly to repo                                                                            |
| Content persistence (dev)  | Node `fs`                                                                      | direct read/write to `content/posts/`                                                                            |
| Admin auth                 | Auth.js (NextAuth) v5, Credentials provider, JWT session strategy              | no DB adapter needed                                                                                             |
| Password storage           | `bcryptjs` hash stored in env var                                              | single admin, no user table                                                                                      |
| Image handling             | Commit to `/public/images/` via same GitHub API adapter                        | keeps everything free & git-based                                                                                |
| Search (public)            | Client-side fuzzy search with `fuse.js` over a build-time generated JSON index | no server/DB search needed                                                                                       |
| Markdown rendering         | `next-mdx-remote/rsc`                                                          | supports custom React components inside MDX                                                                      |
| Syntax highlighting        | `rehype-pretty-code` or `shiki`                                                |                                                                                                                  |
| RSS                        | `feed` package, generated at build/request time                                |                                                                                                                  |
| Deployment                 | Vercel Hobby plan                                                              | connected to GitHub repo for CI/CD                                                                               |
| Linting/formatting         | ESLint + Prettier                                                              |                                                                                                                  |

## 5. Environment Variables

```
ADMIN_USERNAME=
ADMIN_PASSWORD_HASH=          # bcrypt hash, generate offline, never store plaintext
AUTH_SECRET=                  # for Auth.js JWT signing
GITHUB_TOKEN=                 # fine-grained PAT, contents:write scope only, single repo
GITHUB_OWNER=
GITHUB_REPO=
GITHUB_BRANCH=main
NEXT_PUBLIC_SITE_URL=         # e.g. https://yourdomain.com
```

## 6. Folder Structure

```
app/
  (public)/
    page.tsx                     # home / post listing
    blog/
      [slug]/
        page.tsx                 # single post, generateStaticParams + generateMetadata
    category/[category]/page.tsx
    tag/[tag]/page.tsx
    search/page.tsx
    sitemap.ts
    robots.ts
    rss.xml/route.ts
  admin/
    layout.tsx                   # wraps all admin routes, enforces session check
    page.tsx                     # dashboard / post list
    login/page.tsx
    posts/
      new/page.tsx
      [slug]/edit/page.tsx
  api/
    auth/[...nextauth]/route.ts
    admin/
      posts/route.ts             # POST create, GET list
      posts/[slug]/route.ts      # PUT update, DELETE
      upload/route.ts            # image upload -> GitHub
content/
  posts/
    *.mdx                        # used only in local dev; source of truth is GitHub in prod
lib/
  content/
    adapter.ts                   # interface
    local-fs-adapter.ts
    github-api-adapter.ts
    schema.ts                    # zod schema for frontmatter validation
  auth.ts                        # Auth.js config
  search-index.ts                # builds fuse.js index at build time
middleware.ts                    # protects /admin/* routes
public/
  images/
  llms.txt
```

## 7. Content Model (MDX Frontmatter Schema)

Validate with `zod` on both create/update:

```yaml
---
title: string (required)
slug: string (required, unique, kebab-case, auto-generated from title but editable)
description: string (required, 120-160 chars, used for meta description)
date: ISO date string (required)
updatedAt: ISO date string (optional, set automatically on edit)
tags: string[] (optional)
category: string (optional)
coverImage: string (optional, path under /public/images/)
status: "draft" | "published" (required, default "draft")
featured: boolean (optional)
---
```

Draft posts must be excluded from: sitemap, RSS feed, `generateStaticParams`, search index, and listing pages — but still viewable by the admin via a preview link while logged in.

## 8. Feature Set — Admin Authentication

- Single hardcoded admin identity via env vars (`ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH`).
- Auth.js Credentials provider, JWT session strategy (no database adapter required).
- `middleware.ts` protects every route under `/admin/*` except `/admin/login`; redirect unauthenticated requests to `/admin/login`.
- Login form: username + password, rate-limit failed attempts (simple in-memory or edge-config based throttle is acceptable given single-user scope).
- Session expiry: reasonable default (e.g. 7 days), with manual logout button in admin layout.
- No signup flow of any kind must exist anywhere in the app.

## 9. Feature Set — Admin CRUD Panel

- **Dashboard:** table of all posts (title, status, date, tags) with edit/delete actions and a "New Post" button. Pull the list via the content adapter (GitHub API in prod).
- **Create/Edit form:**
  - Fields for all frontmatter properties (schema above).
  - MDX body editor — a simple `textarea` is acceptable, but prefer a lightweight code editor (`@uiw/react-textarea-code-editor` or CodeMirror) with a live-rendered MDX preview pane side-by-side.
  - Auto-generate `slug` from `title`, but allow manual override; validate uniqueness against existing posts before submit.
  - Image upload control: uploads to `/public/images/{slug}/...` via the GitHub API adapter, returns the path to insert into `coverImage` or inline in the MDX body.
  - Draft/Publish toggle.
  - Submit → server action calls the content adapter → commits to GitHub → shows a toast/status indicating the deployment has been triggered.
- **Delete:** confirmation dialog, then deletes the `.mdx` file (and optionally its images) via the GitHub API.
- All admin API routes must re-verify the session server-side (never trust client state alone).

## 10. Feature Set — Public Viewer Pages

- **Home page:** paginated list of published posts, newest first, featured post highlighted at top.
- **Post detail page (`/blog/[slug]`):** statically generated via `generateStaticParams` from all published posts at build time; render MDX via `next-mdx-remote/rsc`; show title, date, reading time, tags, cover image, table of contents (auto-generated from headings for longer posts).
- **Category & tag pages:** list posts filtered by category/tag, statically generated.
- **Search page:** client component using `fuse.js` against a prebuilt JSON search index (generated at build time from all published post metadata + excerpts); fully client-side, no server round trip.
- **404 page** and graceful empty states (e.g. "No posts yet").
- **RSS feed** at `/rss.xml`.
- **ISR:** use `revalidate` on listing/detail pages (e.g. every 60–300s) so newly published content (pushed via GitHub → redeploy) is reflected quickly without requiring a full rebuild trigger for every visitor request; since content changes trigger real redeploys anyway via the Git-based CMS flow, plain SSG with on-demand `revalidatePath` after a successful admin publish is the cleanest option — implement this: after a successful create/update/delete in the admin API route, call `revalidatePath` for the affected routes.
- No client-side auth state, no login UI, no admin links anywhere in the public bundle or navigation.

## 11. SEO Requirements

- Use the Next.js **Metadata API** (`generateMetadata`) per page: `title`, `description`, `canonical`, Open Graph (`og:title`, `og:description`, `og:image`, `og:type=article`), Twitter Card (`summary_large_image`).
- Auto-generate Open Graph images per post (use `next/og` `ImageResponse` for dynamic OG image generation — free, no external service).
- **JSON-LD structured data:**
  - `Article` / `BlogPosting` schema on post detail pages (headline, datePublished, dateModified, author, image).
  - `BreadcrumbList` schema for category/tag navigation.
  - `WebSite` schema with `SearchAction` on the home page.
- `app/sitemap.ts` — dynamically generated from all published posts + static routes.
- `app/robots.ts` — allow all standard crawlers, reference sitemap.
- Clean, human-readable URLs (`/blog/my-post-slug`), no query-string-based routing for core content.
- Semantic HTML: single `<h1>` per page, logical heading hierarchy, `<article>`, `<time>` with `dateTime` attribute, descriptive `alt` text on all images (enforce via zod schema requiring alt text on cover images).
- Fast Core Web Vitals by default: static generation, `next/image` for all images, `next/font` for font loading with no layout shift.

## 12. AI / Generative-Engine Optimization (GEO)

- **`public/llms.txt`** — a plain-text index listing site purpose, and links to key posts with one-line summaries, following the emerging `llms.txt` convention so AI assistants/crawlers can efficiently understand and cite the site.
- Explicitly allow known AI crawlers in `robots.ts` (e.g. `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`) unless the owner later decides otherwise — make this a clearly commented, easy-to-toggle list.
- Keep MDX content well-structured with clear headings, short paragraphs, and explicit definitions/summaries near the top of long posts — this improves both human skimmability and how well AI systems can extract and cite the content.
- Ensure structured data (`Article` schema) is complete and accurate, since AI answer engines rely heavily on it for attribution.
- Avoid content trapped behind client-side-only rendering — since posts are statically generated server-rendered HTML, they are fully crawlable by both search engines and AI crawlers by default.

## 13. Design / UX Requirements

- Mobile-first, fully responsive layout.
- Clean, readable typography optimized for long-form reading (comfortable line-length, sufficient line-height).
- Optional dark mode (system-preference based, no login-based preference needed).
- Accessible: proper color contrast, keyboard navigability, ARIA labels where needed, focus states.
- Fast perceived performance: skeleton/loading states where relevant, optimized images, minimal client JS on public pages (most of the public site should be Server Components).

## 14. Non-Functional Requirements

- TypeScript strict mode across the entire project.
- ESLint + Prettier configured and passing.
- Zod validation on every admin write operation (frontmatter + slug uniqueness) before hitting the GitHub API.
- Sensible error handling and user-facing error messages in the admin panel (e.g. GitHub API failures, rate limits).
- No secrets ever exposed to the client bundle — audit that `GITHUB_TOKEN`, `ADMIN_PASSWORD_HASH`, and `AUTH_SECRET` are server-only.

## 15. Deployment Checklist

1. Push repo to GitHub.
2. Create a Vercel project, import the GitHub repo, set the Framework Preset to Next.js.
3. Add all environment variables listed in Section 5 in the Vercel dashboard.
4. Generate `ADMIN_PASSWORD_HASH` locally with a short bcrypt script; never commit the plaintext password.
5. Create a GitHub fine-grained Personal Access Token scoped to **only this repository**, with **Contents: Read and Write** permission — nothing broader.
6. Point the custom domain (the only paid item) to the Vercel project via DNS.
7. Verify: publishing a post from `/admin` results in a real commit to the GitHub repo and a live update on the public site.

## 16. Suggested Build Order (for the implementing agent)

1. Scaffold Next.js 16 + TypeScript + Tailwind + shadcn/ui project.
2. Build the content adapter interface + local filesystem implementation; get MDX reading/rendering working end-to-end on the public side with a few hand-written sample `.mdx` files.
3. Build public pages: home, post detail, category, tag, search, RSS, sitemap, robots — fully working against local MDX files.
4. Implement SEO metadata + JSON-LD + OG image generation.
5. Implement `llms.txt` and AI crawler allowlist.
6. Implement Auth.js admin login + middleware protection.
7. Build the GitHub API content adapter (Octokit) and swap it in for production writes; keep local adapter for dev.
8. Build the admin CRUD UI (list, create, edit, delete, image upload) wired to the adapter + `revalidatePath` on success.
9. Full pass on responsive design, accessibility, and performance (Lighthouse audit).
10. Deploy to Vercel, configure env vars and GitHub token, connect custom domain, do an end-to-end smoke test of the full publish flow.
