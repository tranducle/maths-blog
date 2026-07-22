import { put } from "@vercel/blob";

// Server-side TikZ rendering: when a post is saved, extract ```tikz fenced
// blocks, compile each to SVG via the LaTeX render service, upload to Vercel
// Blob, and return a {hash -> blobUrl} map stored alongside the post. Public
// rendering then shows the cached SVG (LaTeX-quality) instead of falling back
// to client-side TikZJax.

// Map key (content hash) -> blob URL of a rendered SVG. Stored as JSON text in
// the posts.tikz_renders column. The SAME hash function is duplicated in
// markdown-renderer.tsx (djb2, no crypto) so client + server agree on keys.
export type TikzRenders = Record<string, string>;

export type TikzBlock = { hash: string; source: string };

/** djb2 hash — matches the client-side hash in markdown-renderer.tsx. */
export function hashKey(source: string): string {
  let h = 5381;
  for (let i = 0; i < source.length; i++) h = (h * 33) ^ source.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/** Result of rendering a post's TikZ blocks server-side. */
export type TikzRenderResult = {
  svgs: TikzRenders;
  /** Blocks that failed to render (cold-start, compile error). Keyed by hash. */
  errors: Record<string, string>;
};

/**
 * Render every TikZ block in `md` to SVG on the server. Returns a {hash → svg}
 * map plus a {hash → error} map for any blocks that failed (so the page can
 * show a placeholder instead of rendering nothing). Used by the public article
 * page so diagrams render server-side without needing the client <Tikz>
 * fallback or a cached blob URL.
 *
 * If `cached` (the stored tikzRenders blob-URL map) has an entry for a block,
 * that block is skipped — the cached blob URL is preferred. This function is
 * for the no-blob-token case.
 */
export async function renderTikzBlocks(
  md: string,
  cached: TikzRenders | null = null,
): Promise<TikzRenderResult> {
  const blocks = extractTikzBlocks(md);
  const svgs: TikzRenders = {};
  const errors: Record<string, string> = {};
  for (const block of blocks) {
    if (cached?.[block.hash]) continue;
    try {
      svgs[block.hash] = await renderTikz(block.source);
    } catch (err) {
      const msg = (err as Error).message;
      console.warn(`[tikz] server render failed for ${block.hash}:`, msg);
      errors[block.hash] = msg;
    }
  }
  return { svgs, errors };
}

/** Extract ```tikz fenced blocks from markdown. Returns [] if none. */
export function extractTikzBlocks(md: string): TikzBlock[] {
  const blocks: TikzBlock[] = [];
  // Match fenced code blocks with the tikz language tag.
  const re = /```tikz[ \t]*\r?\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const source = m[1].replace(/\n$/, "");
    blocks.push({ hash: hashKey(source), source });
  }
  return blocks;
}

/**
 * Compile one TikZ source to SVG via the render service.
 * Returns the SVG string (no XML wrapper fetch needed — service returns inline).
 * Throws on non-200, compile error, or missing service URL.
 */
export async function renderTikz(source: string): Promise<string> {
  const url = process.env.RENDER_SERVICE_URL;
  const apiKey = process.env.RENDER_API_KEY;
  if (!url) throw new Error("RENDER_SERVICE_URL is not set");

  const res = await fetch(`${url.replace(/\/$/, "")}/convert`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
    body: JSON.stringify({
      latexInput: source,
      outputFormat: "SVG",
      scale: 2,
    }),
    // Render service may be cold-starting (Render free tier sleeps); allow time.
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`render service ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { svg?: string; error?: string };
  if (data.error) throw new Error(`render service: ${data.error}`);
  if (!data.svg) throw new Error("render service returned no svg");
  return data.svg;
}

/**
 * Render + cache all tikz blocks in a markdown body.
 *
 * Caching strategy: the SVG is stored INLINE as a string in posts.tikz_renders
 * (keyed by source hash), so a cold render service never blanks public pages.
 * If BLOB_READ_WRITE_TOKEN is also set, the SVG is additionally uploaded to
 * Vercel Blob and the Blob URL is stored instead (cheaper to serve than a big
 * inline string) — but the inline-string fallback is the default and needs no
 * extra credentials.
 *
 * - Skips blocks already present in `existing` (by hash).
 * - Never throws: on per-block failure the block is omitted; the save still
 *   succeeds. The public page will retry render on view and fill the cache.
 */
export async function renderAndCacheTikz(
  md: string,
  existing: TikzRenders | null,
): Promise<TikzRenders | null> {
  const blocks = extractTikzBlocks(md);
  if (blocks.length === 0) return existing ?? null;

  const renders: TikzRenders = { ...(existing ?? {}) };
  const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

  for (const block of blocks) {
    if (renders[block.hash]) continue;
    try {
      const svg = await renderTikz(block.source);
      if (hasBlob) {
        const blob = await put(
          `tikz/${block.hash}.svg`,
          svg,
          { access: "public", contentType: "image/svg+xml" },
        );
        renders[block.hash] = blob.url;
      } else {
        // Inline-string cache (default, no Blob token needed). The public page
        // treats the stored value as either a URL or an inline SVG.
        renders[block.hash] = svg;
      }
    } catch (err) {
      console.warn(`[tikz] render failed for ${block.hash}:`, (err as Error).message);
    }
  }

  return renders;
}
