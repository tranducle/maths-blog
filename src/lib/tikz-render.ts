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
 * - Skips blocks already present in `existing` (by hash) so edits that don't
 *   touch a diagram don't re-render it.
 * - If BLOB_READ_WRITE_TOKEN is unset, returns `existing` unchanged (cache
 *   disabled — public pages fall back to client-side TikZJax).
 * - Never throws: on any per-block failure, that block is left uncached and the
 *   rest still proceeds. The caller's response is not blocked by render errors.
 */
export async function renderAndCacheTikz(
  md: string,
  existing: TikzRenders | null,
): Promise<TikzRenders | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // Caching disabled (no Blob token). Leave renders untouched.
    return existing ?? null;
  }

  const blocks = extractTikzBlocks(md);
  if (blocks.length === 0) return existing ?? null;

  const renders: TikzRenders = { ...(existing ?? {}) };

  for (const block of blocks) {
    // Already rendered & cached for this exact source — skip.
    if (renders[block.hash]) continue;
    try {
      const svg = await renderTikz(block.source);
      const blob = await put(
        `tikz/${block.hash}.svg`,
        svg,
        { access: "public", contentType: "image/svg+xml" },
      );
      renders[block.hash] = blob.url;
    } catch (err) {
      // Don't fail the whole save; this diagram falls back to TikZJax.
      console.warn(`[tikz] render failed for ${block.hash}:`, (err as Error).message);
    }
  }

  return renders;
}
