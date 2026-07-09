# Deploy Runbook — Maths Blog (Phase 6)

This runbook takes you from a clean checkout to a live, verified deployment using
the **Vercel CLI** (no GitHub repo required). All credential-gated steps are here;
the agent has already done every prep step that doesn't need your credentials.

> **Time:** ~25–40 min the first time.
> **Cost:** all resources have free tiers sufficient for a personal blog.

> **First deployment (done, 2026-07-08):** Supabase Postgres (`maths-blog-db`,
> ref `rbhhgyeoqpqvynsphamt`) + Vercel Blob (`maths-blog-blob`, public) on the
> `letranducuqtr-2979` account. Live at **https://maths-blog.vercel.app**.
> To **redeploy** after code changes: `vercel --prod --token $VERCEL_TOKEN`.
> The DB driver is `postgres` (postgres-js) — NOT `@vercel/postgres`, which only
> accepts Neon connection strings.

---

## 0. Prerequisites

- Node 18+ and npm (you already have these — the project builds locally).
- A Vercel account (sign up at vercel.com).
- The local project at `/Users/let/Downloads/maths-blog` with `public/tikzjax/` already populated by `scripts/fetch-tikzjax-assets.mjs`.

Verify prep is in place:

```bash
ls public/tikzjax/tikzjax.js          # must exist
grep -c "s3.us-east-2" public/tikzjax/tikzjax.js   # must print 0 (patched)
npm run build                          # must finish green
node scripts/check-secrets.mjs         # must print "✓ No secrets leaked"
```

---

## 1. Install & log in to Vercel

```bash
npm i -g vercel
vercel login        # follow the email/OTP or GitHub flow
```

---

## 2. Create the project + link it

From the project root:

```bash
vercel link
```

- Confirm the scope (your account/team).
- When asked "Set up and deploy?", say **Y**.
- Project name: `maths-blog` (or whatever you like).
- Framework: **Next.js** (auto-detected).
- It will deploy a preview build. **It will fail at runtime** (no DB yet) — that's expected; we fix env in the next steps.

---

## 3. Provision resources

### Postgres (via Neon Marketplace — recommended)

Vercel's first-party Postgres was retired; the supported path is **Neon** through
the Vercel dashboard:

1. Open https://vercel.com/<you>/maths-blog/stores and click **Create Database** → **Neon** (Marketplace).
2. Accept the Neon connection, pick a region close to your audience, name it `maths-blog-db`.
3. **Connect it to the `maths-blog` project.** Vercel injects two env vars automatically:
   - `POSTGRES_URL` — the **pooled** connection (runtime queries).
   - `POSTGRES_URL_NON_POOLING` — the **direct** connection (drizzle-kit migrations).

> Both must exist — migrations fail on the pooled endpoint (RT-01).

### Blob (image uploads)

1. Same **Stores** page → **Create Blob Store** → name `maths-blog-blob`.
2. Connect it to the project. This injects `BLOB_READ_WRITE_TOKEN`.

### Upstash Redis (rate-limiting — optional but recommended)

1. **Stores** → **Create Database** → **Upstash Redis** (Marketplace), name `maths-blog-rl`.
2. Connect to the project. Injects `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.

> Without this, login rate-limiting is **skipped** (dev fallback in code). For a
> public site you want it ON (RT-07).

---

## 4. Generate your secrets locally

### 4a. Admin password → bcrypt hash

Pick a password (≥12 chars; rotate from anything you've used before — RT-06):

```bash
npm run hash-password
# paste your password when prompted
```

Copy the printed line: `ADMIN_PASSWORD_HASH=$2b$12$...`

### 4b. Session secret

```bash
openssl rand -base64 48
```

Copy the output (≥32 bytes).

---

## 5. Set the remaining env vars

The storage integrations already set the DB/Blob/Redis vars. You still need:

```bash
vercel env add ADMIN_USERNAME production preview
# enter: troisrivers

vercel env add ADMIN_PASSWORD_HASH production preview
# paste: $2b$12$...   (the bcrypt hash from 4a)

vercel env add SESSION_SECRET production preview
# paste: the openssl output from 4b
```

---

## 6. Pull env vars to your machine

```bash
vercel env pull .env.local
```

This writes **all** env vars (yours + the storage ones) into `.env.local`, which
is gitignored. The migration and seed scripts read from this file.

Sanity check it has everything:

```bash
grep -E '^(ADMIN_USERNAME|ADMIN_PASSWORD_HASH|SESSION_SECRET|POSTGRES_URL|POSTGRES_URL_NON_POOLING|BLOB_READ_WRITE_TOKEN)' .env.local
```

---

## 7. Snapshot the DB, then migrate (RT-01, RT-13)

**Snapshot first** (rollback safety — RT-13). In the Neon dashboard:
`maths-blog-db` → **Branches / Restore** → create a restore point.

Then run the migration against the **direct (non-pooled)** connection:

```bash
npm run db:migrate
```

`drizzle.config.ts` reads `POSTGRES_URL_NON_POOLING` — this is the only safe
endpoint for DDL. If it errors with "cannot execute CREATE in read-only / pooled
transaction", you've got the URLs swapped.

Verify the table exists:

```bash
# from the Neon SQL editor, or:
npx vercel env pull .env.local && psql "$POSTGRES_URL_NON_POOLING" -c '\d posts'
```

---

## 8. Seed (one-off, idempotent — RT-03)

```bash
npm run db:seed
```

You should see `Inserted 4 new post(s)`. Run it again to confirm idempotency:

```bash
npm run db:seed   # expect: "(none — already seeded)", no error
```

> **Never** put the seed in the build step. It's a manual one-off only.

---

## 9. Deploy to production

```bash
vercel --prod
```

Note the production URL it prints (e.g. `https://maths-blog-xxx.vercel.app`).

---

## 10. Verify — run the smoke test

Set the smoke-test password env (your **plaintext** password, used only in this
shell — never committed):

```bash
export SMOKE_ADMIN_PASSWORD='your-plaintext-password'
node scripts/smoke-test.mjs https://maths-blog-xxx.vercel.app
```

Every line should read `✓`. If any `✗` appears, see **Troubleshooting** below.

### Manual checks the script doesn't cover

Open the live URL in a browser and confirm:

- **Homepage** shows 4 seeded posts in the prototype visual style.
- **Inline search + tag/category filters** on the homepage work.
- **Math renders** (KaTeX) on a post like `making-quadratic-functions-intuitive`.
- **TikZ diagram renders** on `drawing-diagrams-with-tikz` (an SVG appears in the
  `.tikz-figure` container). If you see the raw source instead, see RT-05 below.
- **TOC anchors** jump to the right headings (incl. headings that contain math).
- **Malformed LaTeX** (e.g. a stray `$`) on a post does **not** 500 the page —
  KaTeX shows a red error inline (RT-04).

---

## 11. Secrets re-check on the production build (RT-14)

```bash
npm run build
node scripts/check-secrets.mjs
```

Must print `✓ No secrets leaked`.

---

## Red-Team constraints to confirm live

| ID  | What to confirm |
|-----|-----------------|
| RT-01 | `/api/posts` and `/api/upload` both return 401 unauthed (smoke test covers). |
| RT-02 | A draft slug returns 404 publicly (smoke test covers). |
| RT-04 | Malformed LaTeX renders inline error, no 500 (manual). |
| RT-05 | TikZ diagrams render SVG; `.wasm` served as `application/wasm`. |
| RT-07 | After 5 wrong logins you get 429 (Upstash required). |
| RT-08 | SVG upload rejected with 415 (smoke test covers). |
| RT-09 | A write from a foreign Origin is 403 (smoke test covers). |
| RT-11 | Session cookie has `Secure` on the HTTPS prod URL; login persists. |
| RT-14 | `check-secrets.mjs` clean. |

---

## Troubleshooting

### `db:migrate` → "syntax error at or near …" / connection refused
- You're probably on the pooled URL. Confirm `POSTGRES_URL_NON_POOLING` is set in
  `.env.local` and points at the `-pooler`-less / direct Neon host.

### Smoke test: login returns 500 / "SESSION_SECRET must be set"
- `SESSION_SECRET` isn't reaching the production deployment. Re-run
  `vercel env add SESSION_SECRET production` then `vercel --prod` again.

### Smoke test: every write returns 403 "Bad origin"
- The CSRF check compares `Origin` to `Host`. If you're behind a custom domain or
  proxy, confirm the `Host` header matches your deployment URL.

### TikZ shows raw source instead of an SVG (RT-05)
- Check DevTools → Network for `/tikzjax/3f69…wasm`: status 200,
  `content-type: application/wasm`. If 404, re-run
  `node scripts/fetch-tikzjax-assets.mjs` and redeploy. If the wasm loads but
  nothing renders, look for a console error from the TikZJax runtime — common fix
  is ensuring the `\begin{tikzpicture}` block is inside a ` ```tikz ` fenced code
  block (handled by `remark-directive-blocks`).

### Login rate-limit not kicking in (no 429 after many tries)
- Upstash not connected. Confirm `UPSTASH_REDIS_REST_URL` + `_TOKEN` are in the
  production env (`vercel env ls`). Without them the limiter is a no-op.

---

## Rollback

- **Bad migration:** restore the Neon branch you snapshotted in step 7; fix the
  migration; redeploy. Prefer additive migrations to avoid needing this.
- **Bad deploy:** `vercel rollback` (or the dashboard **Deployments** → "Instant Rollback").
