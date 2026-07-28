# alfism — MDX blog with a Git-based CMS

A personal blog with two strictly separated surfaces:

- **Public site** (`/`, `/blog/*`, …) — statically generated, unauthenticated,
  no client-side auth state and no admin code in its bundle.
- **Admin panel** (`/admin/*`) — single-user, session-protected CRUD over the
  posts.

Content lives as MDX files in this Git repository. There is no database.

**Recurring cost: the domain name.** Everything else runs on free tiers.

---

## How writing works without a database

Vercel's serverless filesystem is **read-only and ephemeral**. Writing to
`content/posts/*.mdx` from an API route appears to work in `next dev` and then
silently loses the file on the next cold start.

So the admin panel does not write files. It commits them:

```text
Admin submits form
  → server re-verifies the session
  → zod validates frontmatter + slug uniqueness
  → GitHub API commits the .mdx file to this repo
  → GitHub push triggers Vercel's Git integration
  → Vercel rebuilds; the post is live in ~60s
```

`revalidatePath` also runs immediately after a successful write, so the
_currently deployed_ instance stops serving stale HTML without waiting for the
rebuild. Post and taxonomy routes keep `dynamicParams: true`, which means a
newly published post is reachable the moment the write succeeds — the redeploy
then bakes it into static HTML.

Every admin action is exactly **one commit**, built through the Git Data API
(`getRef` → `createTree` → `createCommit` → `updateRef`). A slug rename writes
the new file and deletes the old one in that single commit, so it produces one
deploy rather than two.

### Two adapters, one interface

`lib/content/adapter.ts` picks a backend:

| Environment | Adapter              | Behaviour                                          |
| ----------- | -------------------- | -------------------------------------------------- |
| `next dev`  | `local-fs-adapter`   | reads/writes `content/posts/` on disk              |
| production  | `github-api-adapter` | reads/writes through the GitHub REST + GraphQL API |

Override with `CONTENT_SOURCE=local|github` to exercise the production write
path locally.

Listing posts uses a **single GraphQL query** that returns every filename _and_
file body at once. The REST equivalent is one request per post, which would burn
through the rate limit during a build. A REST fallback covers tokens that cannot
use GraphQL.

---

## Getting started

```bash
npm install
cp .env.example .env.local
npm run hash-password     # generates ADMIN_PASSWORD_HASH
npx auth secret           # generates AUTH_SECRET
npm run dev
```

Then open <http://localhost:3000> and <http://localhost:3000/admin>.

> [!IMPORTANT]
> **Escape the `$` in `ADMIN_PASSWORD_HASH` inside `.env.local`.**
> Next.js runs dotenv _variable expansion_ over `.env` files, so an unescaped
> `$2b$12$…` is read as three empty `$VAR` references and silently mangled —
> quoting does not help. Write `ADMIN_PASSWORD_HASH=\$2b\$12\$…` instead.
> `npm run hash-password` prints both the escaped form (for `.env.local`) and
> the raw form (for the Vercel dashboard, which is not dotenv-parsed).
> If you get it wrong, the app fails fast with an explicit message rather than
> reporting "wrong password".

### Scripts

| Command                 | What it does                                       |
| ----------------------- | -------------------------------------------------- |
| `npm run dev`           | Dev server                                         |
| `npm run build`         | Production build                                   |
| `npm run check`         | typecheck + lint + format check                    |
| `npm run hash-password` | bcrypt hash for the admin password (hidden prompt) |
| `npm run format`        | Prettier write                                     |

---

## Content model

Frontmatter is validated by zod (`lib/content/schema.ts`) on read _and_ on
write. Invalid files are skipped and surfaced in the admin dashboard rather than
crashing the build.

```yaml
---
title: "Post title" # required, ≤140 chars
slug: "post-title" # required, kebab-case, unique
description: "…" # required, 120–160 chars (meta description)
date: "2026-07-28T09:00:00.000Z" # required, ISO
updatedAt: "2026-07-29T10:00:00.000Z" # optional, stamped automatically on edit
tags: ["nextjs", "mdx"] # optional, ≤12
category: "Architecture" # optional
coverImage: # optional
  src: "/images/post-title/cover.png"
  alt: "Descriptive alt text" # REQUIRED whenever src is set
status: "published" # "draft" | "published", default "draft"
featured: false # optional
---
```

`coverImage` is an object rather than a bare string specifically so alt text can
be **required** whenever an image exists. A bare string is still accepted when
reading hand-written files, for backwards compatibility.

### Drafts

A `status: draft` post is excluded from the home page, archive, category and tag
pages, `generateStaticParams`, the sitemap, the RSS feed, `llms.txt`, and the
search index. It remains viewable at `/admin/preview/[slug]` while signed in.

### Components available inside MDX

```mdx
<KeyTakeaway>One self-contained, quotable claim.</KeyTakeaway>
<Callout type="warning" title="Optional">
  Body
</Callout>
<Figure
  src="/images/post/x.png"
  alt="…"
  caption="…"
  width={1200}
  height={630}
/>
```

Fenced code blocks are highlighted at build time by `rehype-pretty-code` /
Shiki with a dual light+dark theme, so highlighting follows the site theme with
zero client JavaScript.

---

## SEO

- Per-page `generateMetadata`: title, description, canonical, Open Graph
  (`og:type=article` on posts), Twitter `summary_large_image`.
- Per-post Open Graph images generated by `next/og` and **prerendered** at build
  time (`app/(public)/blog/[slug]/opengraph-image.tsx`) — no external service.
- JSON-LD: `BlogPosting` on posts, `BreadcrumbList` on posts and taxonomy pages,
  `WebSite` + `SearchAction` on the home page, `CollectionPage` + `ItemList` on
  listings.
- `app/(public)/sitemap.ts` and `app/robots.ts`, both generated from published
  content.
- Semantic HTML: one `<h1>` per page, `<article>`, `<time dateTime>`, alt text
  enforced by the schema.
- `next/font` (self-hosted, size-adjusted → no CLS) and `next/image` throughout.

> `robots.ts` must live at `app/robots.ts`, **not** inside the `(public)` route
> group — Next.js does not pick it up from a route group. `sitemap.ts` works in
> either location and is kept beside the other public routes.

## AI / generative-engine optimisation

- **`/llms.txt`** is generated by a route handler
  (`app/(public)/llms.txt/route.ts`) rather than checked in as a static file, so
  the listing cannot drift from the published posts.
- Known AI crawlers (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`,
  …) are explicitly allowed in `app/robots.ts`. The list is a single commented
  array — move a user agent to `BLOCKED_AI_CRAWLERS` to opt out.
- Posts are server-rendered static HTML, so the full text is present without
  JavaScript execution.

---

## Security

- Single admin identity from `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH`. **No
  signup, password-reset, or account-creation flow exists anywhere.**
- Auth.js v5, Credentials provider, JWT sessions (7 days). No database adapter.
- `proxy.ts` (Next 16's rename of `middleware.ts`, now Node.js runtime by
  default) gates `/admin/*`.
- **Every admin page and API route re-verifies the session server-side.** The
  proxy is the outer gate, never the only one. Server Actions are authorised
  too, since they are public HTTP endpoints.
- Failed logins are throttled per IP (5 per 10 min, then a 15 min lockout).
  In-memory and per-instance — adequate precisely because there is one user and
  the only threat is password guessing. It needs no Redis, preserving the
  zero-cost constraint.
- Username comparison is constant-time and the bcrypt compare always runs, so a
  wrong username and a wrong password take the same time.
- Uploads are restricted by MIME type and size (4 MB), filenames are
  slugified + timestamped, and slugs are schema-validated, so `../` cannot
  escape the target directory.
- `GITHUB_TOKEN`, `ADMIN_PASSWORD_HASH` and `AUTH_SECRET` are read only in
  `server-only` modules and never prefixed `NEXT_PUBLIC_`.

---

## Deployment

1. Push this repo to GitHub.
2. Create a Vercel project from it (framework preset: Next.js).
3. Add the environment variables from `.env.example` in the Vercel dashboard.
   Paste `ADMIN_PASSWORD_HASH` **raw** here — no escaping.
4. Create a **fine-grained** GitHub PAT scoped to _only this repository_ with
   **Contents: Read and write**. Nothing broader is required.
5. Point the custom domain at the Vercel project.
6. Smoke test: publish a post from `/admin`, confirm a commit appears in the
   repo and the post goes live.

`NEXT_PUBLIC_SITE_URL` must be the canonical origin with no trailing slash —
canonical tags, OG URLs, the sitemap, RSS and `llms.txt` are all built from it.

---

## Project layout

```text
app/
  (public)/            home, blog/[slug], category, tag, topics, search,
                       page/[page], sitemap.ts, rss.xml, llms.txt
  admin/               dashboard, login, posts/new, posts/[slug]/edit,
                       preview/[slug]
  api/admin/           posts (GET/POST), posts/[slug] (GET/PUT/DELETE), upload
  api/auth/            Auth.js handler
  robots.ts            must be at the app root, not in a route group
components/
  public/ admin/ ui/   presentation, split by surface
lib/
  content/             adapter interface, local-fs + github-api impls, zod
                       schema, serialisation, query layer
  mdx/                 plugin pipeline, custom components, table of contents
  seo/                 JSON-LD builders
  auth.ts rate-limit.ts search-index.ts
content/posts/*.mdx    the content
proxy.ts               /admin/* route protection
site.config.ts         name, description, author, pagination — edit this first
```

## Known trade-offs

- **Publishing is a build, not an instant write.** In exchange every edit is a
  reviewable commit and rolling back is `git revert`.
- **The login throttle is per-instance.** A scaled-out deployment weakens it
  proportionally. Deliberate: a shared store would add a paid dependency for a
  single-user blog.
- **No CSP header.** `next/font` and the theme-flash-prevention script both
  inline styles; a permissive CSP is worse than an honest absence. The other
  standard security headers are set in `next.config.ts`.
- **Images uploaded under `next start` + the local adapter 404 until restart.**
  The production server indexes `public/` at boot, so a file written afterwards
  is not served. This combination does not occur in practice: `next dev` serves
  `public/` dynamically, and real production uses the GitHub adapter, where an
  upload is committed and the redeploy bakes it into `public/` at build time.
