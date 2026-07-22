import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

// Populate posts.tikz_renders with INLINE SVG (rendered via the LaTeX render
// service) directly from a local machine, where we can warm the service and
// retry. This makes public pages render reliably from the DB cache without
// depending on a cold-starting render service at request time.

const RENDER_URL = process.env.RENDER_SERVICE_URL?.replace(/\/$/, "");
const RENDER_KEY = process.env.RENDER_API_KEY;
const DB = process.env.POSTGRES_URL;

if (!RENDER_URL || !RENDER_KEY || !DB) {
  console.error("Missing RENDER_SERVICE_URL / RENDER_API_KEY / POSTGRES_URL");
  process.exit(1);
}

// djb2 — must match src/lib/tikz-render.ts hashKey + markdown-renderer.tsx.
function hashKey(source) {
  let h = 5381;
  for (let i = 0; i < source.length; i++) h = (h * 33) ^ source.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function extractTikzBlocks(md) {
  const blocks = [];
  const re = /```tikz[ \t]*\r?\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(md)) !== null) {
    const source = m[1].replace(/\n$/, "");
    blocks.push({ hash: hashKey(source), source });
  }
  return blocks;
}

async function renderOnce(source) {
  const res = await fetch(`${RENDER_URL}/convert`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": RENDER_KEY },
    body: JSON.stringify({ latexInput: source, outputFormat: "SVG", scale: 2 }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`render ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data = await res.json();
  if (data.error) throw new Error(`render: ${data.error}`);
  if (!data.svg) throw new Error("no svg");
  return data.svg;
}

async function renderWithRetry(source, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await renderOnce(source);
    } catch (err) {
      lastErr = err;
      console.log(`    retry ${i + 1}/${tries} (${err.message})`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw lastErr;
}

async function main() {
  const sql = postgres(DB, { prepare: false });
  try {
    // Warm the service first.
    console.log("Warming render service...");
    try {
      await fetch(`${RENDER_URL}/health`, { signal: AbortSignal.timeout(60_000) });
    } catch {}

    const posts = await sql`
      SELECT id, slug, body_markdown, tikz_renders
      FROM posts
      WHERE body_markdown LIKE '%\`\`\`tikz%'
      ORDER BY slug
    `;
    console.log(`Found ${posts.length} post(s) with tikz blocks.\n`);

    for (const post of posts) {
      const blocks = extractTikzBlocks(post.body_markdown);
      const renders = {};
      let ok = 0;
      for (const block of blocks) {
        try {
          renders[block.hash] = await renderWithRetry(block.source);
          ok++;
        } catch (err) {
          console.log(`  ${post.slug} block ${block.hash}: FAILED ${err.message}`);
        }
      }
      if (ok > 0) {
        await sql`
          UPDATE posts SET tikz_renders = ${JSON.stringify(renders)}
          WHERE id = ${post.id}
        `;
      }
      console.log(`  ${post.slug}: cached ${ok}/${blocks.length} blocks`);
    }
    console.log("\nDone.");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
