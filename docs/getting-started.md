# Getting Started — Proof & Practice

Local setup for the "Proof & Practice" maths teaching blog: a full-stack Next.js 15
(App Router) app with KaTeX math, TikZJax diagrams, and a single-admin editor.

Status: Phases 1–5 complete (scaffold, data layer, auth/security, public site,
admin panel). Phase 6 (deploy & verify) is credential-gated and deferred — see
[Deployment](#deployment).

## Prerequisites

- Node.js 20+ and npm
- A Postgres database (Vercel Postgres / Neon in production; any Postgres works locally)
- Optional: a Vercel Blob store (image uploads) and an Upstash Redis store (login rate-limit)

## Install

```bash
npm install
```

## Environment

Copy `.env.example` to `.env.local` and fill the values. The scripts and runtime
read `.env.local`. Reference by name only — never commit real secrets.

| Variable | Purpose | Required |
|----------|---------|----------|
| `ADMIN_USERNAME` | Admin login name (default `troisrivers`) | Yes |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of the admin password. Never the plaintext. Generate with `npm run hash-password` | Yes |
| `SESSION_SECRET` | JWT signing secret, must be ≥ 32 characters. e.g. `openssl rand -base64 48` | Yes |
| `POSTGRES_URL` | Pooled connection used by the app at runtime | Yes |
| `POSTGRES_URL_NON_POOLING` | Direct (non-pooled) connection. Required for `db:migrate` | Yes (migrations) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for image uploads. If unset, uploads return 503 | For uploads |
| `UPSTASH_REDIS_REST_URL` | Upstash/Vercel KV REST URL for login rate-limiting | Optional |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash/Vercel KV REST token | Optional |

Notes:

- The admin password only ever exists in env as a bcrypt hash (RT-06). The
  plaintext is entered at the `hash-password` prompt and never written to any file.
- If Upstash vars are unset, login rate-limiting is skipped (dev convenience only).
- The session cookie is `secure` only in production, so `http://localhost` dev works (RT-11).

## Generate the admin password hash

```bash
npm run hash-password
```

Enter a password (≥ 12 chars) at the prompt. Paste the printed
`ADMIN_PASSWORD_HASH=...` line into `.env.local` (and later into your Vercel env).

## Database

```bash
npm run db:generate   # regenerate Drizzle SQL migration from src/db/schema.ts
npm run db:migrate    # apply migrations (uses POSTGRES_URL_NON_POOLING)
npm run db:seed       # optional: insert 3 demo posts (idempotent, ON CONFLICT DO NOTHING)
```

`db:migrate` needs `POSTGRES_URL_NON_POOLING` — the pooled endpoint cannot run
migrations. `db:seed` needs `POSTGRES_URL` and is a manual one-off; it never runs
in the build.

## Run

```bash
npm run dev     # http://localhost:3000
```

- Public site: `/` (published posts, tag/category filter, search)
- Article: `/posts/[slug]` (published only)
- Admin login: `/admin/login` → dashboard at `/admin`, editor at `/admin/editor`

## Quality gates

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # next build
```

All three are green as of Phase 5 (12 routes, all dynamic, no build-time DB access).

## Deployment

Phase 6 (deploy & verify on Vercel) is pending and credential-gated. It requires:

- Vercel Postgres (`POSTGRES_URL` + `POSTGRES_URL_NON_POOLING`)
- `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` (via `npm run hash-password`)
- `SESSION_SECRET` (≥ 32 bytes)
- `BLOB_READ_WRITE_TOKEN` for image uploads
- Optional Upstash Redis for login rate-limiting
- Self-hosted TikZJax assets placed under `public/tikzjax/` (`tikzjax.js`, `fonts.css`, `.wasm`)

## More

- Architecture, rendering pipeline, and conventions: [system-architecture.md](./system-architecture.md)
