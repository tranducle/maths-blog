# Phase 5 Landed: Admin Editor, and the TOC Anchor Bug That Almost Slipped

**Date**: 2026-07-07 06:17
**Severity**: Low
**Component**: Admin panel / Markdown rendering pipeline
**Status**: Resolved

## Milestone

Phase 5 is done. The admin panel now has login, a dashboard, a split-pane
Markdown editor, the write APIs (`/api/posts` POST/PUT/DELETE, `/api/upload`),
and image upload. Phases 1 through 5 are complete (26/33 checkboxes, 79%).
Build, typecheck, and lint are green across 12 routes, and the Drizzle
migration is generated. `code-reviewer` returned SHIP: 12/12 Red Team
constraints verified, 0 Critical/High. This was a calm session, not a
firefight, which is worth noting because the rendering pipeline had every
opportunity to become one.

## Decisions

- **RT-16 — gated TikZ, live KaTeX.** The editor renders TikZ diagrams only on
  an explicit "Render diagrams" action, and that state resets the moment the
  body is edited. KaTeX preview stays live per keystroke. The reason is blunt:
  TikZJax recompiles multi-MB WASM on every render, and doing that per keystroke
  would turn the editor into a space heater. Math is cheap, diagrams are not, so
  they get different triggers.
- **RT-08 — upload sniffs magic bytes, not extensions.** 5MB cap, raster
  allowlist, SVG rejected outright as a stored-XSS vector. Trusting a `.png`
  suffix is how you end up serving a script.
- **RT-01 — defense in depth on writes.** Every state-changing route calls
  `getSession()` in-route on top of the middleware check. Middleware is not a
  fence you bet the whole admin surface on.
- **RT-09 — strict same-origin** enforced on all state-changing requests.
- **User decision:** `publishedAt` keeps its original date across an
  unpublish → republish cycle. Republishing is not a new publish.

## The Fix (M1)

TOC anchors broke on any heading containing inline math. Root cause, stated
plainly: `rehype-slug` ran *after* `rehype-katex`, so it was slugging the
rendered KaTeX `<span>` soup instead of the source text. The generated `id`
had nothing to do with the words a reader (or the TOC) saw, so clicking a
contents link jumped nowhere.

Fix: a custom `rehype-heading-slugs` plugin that assigns ids from the source
heading text *before* KaTeX runs, sharing one slug function with the TOC
extractor so the ids agree by construction rather than by luck. Verified
empirically that TOC ids equal DOM ids on both math-bearing and duplicate
headings. `rehype-slug` is retired. The lesson: plugin *order* in a rehype
pipeline is a correctness contract, not a formality — transform-then-slug and
slug-then-transform are different programs.

## Next

Phase 6 (deploy) is credential-gated and blocked on the user. It needs Vercel
Postgres (`POSTGRES_URL` + `POSTGRES_URL_NON_POOLING`), an admin password hash
via `npm run hash-password`, `SESSION_SECRET` (≥32B), `BLOB_READ_WRITE_TOKEN`,
optional Upstash, and self-hosted TikZJax assets in `public/tikzjax/`. The git
commit is deferred because the repo is not initialized yet. No outstanding
questions.

Status: DONE.
