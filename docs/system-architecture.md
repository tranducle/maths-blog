# System Architecture — Proof & Practice

Full-stack Next.js 15 (App Router) maths teaching blog. Public site renders
Markdown posts with KaTeX math and TikZJax diagrams; a single admin authors posts
through a server-authenticated editor. Data lives in Vercel Postgres (Neon) via
Drizzle ORM; images in Vercel Blob.

- Getting started / env / commands: [getting-started.md](./getting-started.md)
- Status: Phases 1–5 complete; Phase 6 (deploy) deferred, credential-gated.

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15.1 (App Router), React 19, TypeScript |
| DB | Vercel Postgres (Neon) + Drizzle ORM |
| Auth | `bcryptjs` (password hash) + `jose` (JWT in httpOnly cookie) |
| Rate limit | `@upstash/ratelimit` + `@upstash/redis` (no-op if unconfigured) |
| Markdown | `react-markdown` + `remark-math` + `remark-directive` |
| Math/code | `rehype-katex` + KaTeX, `rehype-highlight` |
| Diagrams | TikZJax (self-hosted, imperative script injection) |
| Storage | `@vercel/blob` (raster images only) |

## Directory layout

```
src/
  app/
    layout.tsx, page.tsx, globals.css   # root layout, homepage, single design system
    posts/[slug]/page.tsx, error.tsx    # public article (published-only)
    admin/page.tsx                       # dashboard (list all)
    admin/login/page.tsx                 # login form
    admin/editor/page.tsx                # new post
    admin/editor/[id]/page.tsx           # edit post
    api/auth/login/route.ts              # POST login
    api/auth/logout/route.ts             # POST logout
    api/posts/route.ts                   # POST create
    api/posts/[id]/route.ts              # PUT update, DELETE
    api/upload/route.ts                  # POST image upload
  components/                            # hero, site-header, post-card, editor, tikz, TOC, ...
  db/       index.ts, schema.ts, queries.ts
  lib/      auth.ts, csrf.ts, rate-limit.ts, slug.ts,
            article-utils.ts, rehype-heading-slugs.ts,
            remark-directive-blocks.ts, format-date.ts
  middleware.ts                          # edge auth guard
scripts/    seed.ts, seed-data.ts, hash-password.ts
drizzle/    0000_*.sql + meta/           # generated migration
public/tikzjax/                          # self-hosted TikZJax runtime (deploy-time)
```

## Rendering pipeline

Markdown is rendered by a single `MarkdownRenderer` (`src/components/markdown-renderer.tsx`),
used by both the public article and the editor preview. Plugin order matters:

```
remark:  remarkMath → remarkDirective → remarkDirectiveBlocks
rehype:  rehypeHeadingSlugs → rehypeKatex → rehypeHighlight
```

- No `rehype-raw`. Raw HTML never enters the tree. Custom blocks come only from
  `remark-directive` (`remarkDirectiveBlocks` maps `:::pullquote`, `:::figure`,
  `:::figcaption` to styled elements via `hName`/`hProperties`).
- `rehypeHeadingSlugs` runs **before** `rehypeKatex` (M1 fix). It assigns heading
  ids from the source text with inline math stripped, using the shared
  `slugifyHeading`/`dedupeId` helpers in `article-utils.ts`. The TOC (`extractToc`)
  calls the same helpers, so TOC anchors and DOM ids match by construction — even
  on headings with inline math or duplicate text. This replaced `rehype-slug`,
  which slugged rendered KaTeX spans and diverged.
- `rehypeKatex` runs with `throwOnError: false` (RT-04): a malformed `$...$`
  renders an inline error instead of 500-ing the page or the live preview.
- `` ```tikz `` fenced code blocks are intercepted by a custom `code` component
  and rendered via the client `Tikz` component. In the editor preview a
  `tikzPlaceholder` flag renders a static placeholder so the multi-MB WASM runtime
  does not recompile per keystroke (RT-16).

### TikZ diagrams

`src/components/tikz.tsx` is a client component. React never runs a
markup-injected `<script>`, and TikZJax scans for `<script type="text/tikz">`, so
the component imperatively creates a real script node, lazy-loads the self-hosted
runtime (`/tikzjax/tikzjax.js` + `/tikzjax/fonts.css`) once, and tears down on
source change. On any load/parse failure it falls back to rendering the raw source,
so the page never breaks. `next.config.ts` sets `Content-Type: application/wasm`
for `/tikzjax/*.wasm`. Assets are self-hosted (version-pinned) under
`public/tikzjax/` and are added at deploy time.

## Data layer

Single `posts` table (`src/db/schema.ts`):

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, `defaultRandom()` |
| `slug` | text | unique, not null |
| `title` | text | not null |
| `deck` | text | default `''` |
| `category` | text | default `'General'` |
| `tags` | text[] | default empty array |
| `author` | text | default `'Anonymous'` |
| `bodyMarkdown` | text | default `''` |
| `status` | enum `post_status` | `draft` \| `published`, default `draft` |
| `createdAt` / `updatedAt` | timestamptz | `defaultNow()` |
| `publishedAt` | timestamptz | nullable |

Query helpers (`src/db/queries.ts`):

- `listPublished(filters)` — published only; optional `category` (eq), `tag`
  (`arrayContains` `@>` on `text[]`, RT-12), and `q` (inline `ILIKE` over title/
  deck/body, no FTS, RT-15). Ordered by `publishedAt` then `createdAt` desc.
- `getPublishedBySlug(slug)` — status-scoped so **drafts are never reachable by
  slug** (RT-02). `getBySlug` (unscoped) is reserved for admin preview/edit.
- `createPost` / `updatePost` / `deletePost` / `slugExists` / `listAll` / `listCategories`.
- `publishedAt` is stamped the first time a post flips to `published` and is never
  cleared on unpublish, so unpublish→republish keeps the original publish date
  (L3, decided intentional).

### Connections

`src/db/index.ts` binds Drizzle to the pooled `@vercel/postgres` endpoint
(`POSTGRES_URL`) for runtime queries. Migrations use the **direct**
`POSTGRES_URL_NON_POOLING` connection via `drizzle.config.ts` (RT-13) — the pooled
endpoint cannot run `drizzle-kit migrate`. Seeding (`scripts/seed.ts`) is a manual,
idempotent one-off (fixed slugs + `ON CONFLICT DO NOTHING`) and never runs at build.

## Auth & security

- **Password**: verified with `bcryptjs` against `ADMIN_PASSWORD_HASH`. The hash is
  the only form of the password anywhere (RT-06); plaintext is entered only at the
  `hash-password` prompt. `bcryptjs` is imported lazily inside `verifyCredentials`
  so `auth.ts` stays edge-importable.
- **Session**: `jose` HS256 JWT in an httpOnly cookie (`session`), 30-day sliding
  TTL (validated). Signing secret from `SESSION_SECRET` (enforced ≥ 32 chars).
  Cookie is `sameSite=lax`, `secure` only in production (RT-11). Logout clears the
  cookie but the stateless JWT stays valid until `exp` (documented; no revocation, RT-10).
- **Edge middleware** (`src/middleware.ts`): matches `/admin/:path*`,
  `/api/posts/:path*`, `/api/upload/:path*`. Verifies the JWT (edge-safe
  `verifySessionToken`); unauthenticated API calls get 401, page requests redirect
  to `/admin/login`. The login page stays reachable; an authed user hitting it is
  redirected to `/admin`.
- **Defense in depth**: the matcher is not the only guard (RT-01). Every write
  route (`/api/posts`, `/api/posts/[id]`, `/api/upload`) also calls `getSession()`
  itself and returns 401 if absent.
- **CSRF**: beyond `sameSite=lax`, every state-changing route calls
  `assertSameOrigin()` (`src/lib/csrf.ts`) — strict same-origin check (Origin, or
  Referer fallback, host must equal request host), 403 otherwise (RT-09).
- **Login rate-limit** (RT-07): `checkLoginRateLimit` keys on `IP:username`, 5
  attempts / 10 min sliding window via Upstash. If Upstash env is unset, it returns
  allowed (dev only).
- **Uploads** (`/api/upload`, RT-08): auth + same-origin required. Raster allowlist
  only — JPEG, PNG, GIF, WebP — detected by **magic-byte sniffing**, not the
  client Content-Type or extension. **SVG is rejected** (script-bearing SVG is a
  stored-XSS vector). 5 MB cap. Missing `BLOB_READ_WRITE_TOKEN` → 503. Stored to
  Vercel Blob under `posts/<uuid>.<ext>` with `public` access.

## Conventions

- **`export const dynamic = "force-dynamic"`** on every DB-reading page (`/`,
  `/posts/[slug]`, all `/admin/*`) — no static caching of DB reads, no build-time
  DB access.
- **`export const runtime = "nodejs"`** on every route touching the DB, `bcryptjs`,
  or Blob (all `/api/*` routes here). These cannot run on the edge.
- **Single design system**: one `src/app/globals.css` (oklch palette, serif
  display) ported from the prototype; no per-component CSS files (RT-15).
- **Colocated helpers**: TOC + reading-time + slug helpers live in
  `article-utils.ts` rather than separate micro-files (RT-15).
- **Slugs**: `slugify` (`src/lib/slug.ts`) for post slugs (NFKD, diacritics
  stripped, 80-char cap); `slugifyHeading` (`article-utils.ts`) for heading anchors.
  These are deliberately distinct.

## Route summary

| Route | Method | Auth | Notes |
|-------|--------|------|-------|
| `/` | GET | public | homepage, filters + search |
| `/posts/[slug]` | GET | public | published only |
| `/admin`, `/admin/editor`, `/admin/editor/[id]` | GET | required | force-dynamic |
| `/admin/login` | GET | public | redirects to `/admin` if authed |
| `/api/auth/login` | POST | public | same-origin + rate-limit |
| `/api/auth/logout` | POST | — | clears cookie |
| `/api/posts` | POST | required | create; same-origin |
| `/api/posts/[id]` | PUT / DELETE | required | update / delete; same-origin |
| `/api/upload` | POST | required | raster-only image upload |

## Red Team traceability

Security and design decisions trace to Red Team findings RT-01..RT-16 in
`plans/260706-1747-maths-blog-fullstack/plan.md`. Key ones are cited inline above
(RT-01 upload guard, RT-02 draft scoping, RT-04 KaTeX safety, RT-08 upload
allowlist, RT-09 CSRF, RT-11 cookie secure, RT-13 migration connection split).
