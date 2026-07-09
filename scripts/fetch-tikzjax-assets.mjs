// Self-host TikZJax assets under public/tikzjax/ so the app is fully self-contained.
//
// Background (RT-05): the `tikzjax` npm package was UNPUBLISHED (2025-01), so we
// fetch the runtime from the official CDN instead. Two gotchas the script fixes:
//   1. tikzjax.js HARDCODES its wasm/.gz fetch base to
//      `https://s3.us-east-2.amazonaws.com/tikzjax.com` — a plain copy would still
//      pull wasm from the third-party S3 bucket. We patch that constant to "/tikzjax"
//      so the runtime fetches everything from our own origin.
//   2. fonts.css references fonts via `url('../bakoma/...')`; we rewrite to
//      `url('bakoma/...')` so it resolves next to /tikzjax/fonts.css.
//
// Idempotent: skips files already present. Re-run any time.
//
//   node scripts/fetch-tikzjax-assets.mjs
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "public", "tikzjax");

const CDN = "https://tikzjax.com";
const S3 = "https://s3.us-east-2.amazonaws.com/tikzjax.com";

// wasm + .gz companion — referenced by tikzjax.js via the (patched) base.
const WASM = "3f69afb974a1e83f66a36f7618f88a38c254034b.wasm";
const GZ = "b565ab0b474e8e557d954694b7379a57db669ac9.gz";

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

async function ensure(path, loader) {
  if (existsSync(path)) {
    console.log(`  exists: ${path.slice(ROOT.length + 1)}`);
    return null;
  }
  await mkdir(dirname(path), { recursive: true });
  const data = await loader();
  await writeFile(path, data);
  console.log(
    `  wrote:  ${path.slice(ROOT.length + 1)} (${(data.length / 1024).toFixed(1)} KB)`,
  );
  return data;
}

async function main() {
  console.log("Fetching TikZJax assets into public/tikzjax/ ...\n");

  // 1. tikzjax.js — patch the hardcoded S3 base to our local origin.
  const js = await ensure(join(OUT, "tikzjax.js"), async () => {
    let src = await fetchText(`${CDN}/v1/tikzjax.js`);
    const before = S3;
    const after = "/tikzjax";
    if (!src.includes(before)) {
      throw new Error(
        `Patch target not found in tikzjax.js ("${before}"). The upstream build may have changed — inspect it before re-running.`,
      );
    }
    src = src.replace(before, after);
    return src;
  }) ?? (await readFile(join(OUT, "tikzjax.js"), "utf8"));

  if (js.includes(S3)) {
    throw new Error(`tikzjax.js still references ${S3} — patch failed.`);
  }
  console.log("  ✓ no third-party (S3) references remain in tikzjax.js");

  // 2. wasm + .gz companion from S3 (the URLs the runtime actually fetches).
  await ensure(join(OUT, WASM), () => fetchBuffer(`${S3}/${WASM}`));
  await ensure(join(OUT, GZ), () => fetchBuffer(`${S3}/${GZ}`));

  // 3. fonts.css — rewrite ../bakoma/ paths to local bakoma/.
  const fontsCss = await ensure(join(OUT, "fonts.css"), async () => {
    let css = await fetchText(`${CDN}/v1/fonts.css`);
    return css.replace(/url\(\s*['"]?\.\.\/bakoma\//g, "url('bakoma/");
  });

  // 4. Every font referenced by fonts.css -> bakoma/ttf/.
  const fontFiles = [
    ...fontsCss.matchAll(/bakoma\/ttf\/([a-z0-9]+\.ttf)/gi),
  ].map((m) => m[1]);
  const unique = [...new Set(fontFiles)];
  console.log(`\n  fonts referenced: ${unique.length}`);
  for (const f of unique) {
    await ensure(join(OUT, "bakoma", "ttf", f), () =>
      fetchBuffer(`${CDN}/bakoma/ttf/${f}`),
    );
  }

  console.log("\n✓ TikZJax assets ready under public/tikzjax/");
}

main().catch((err) => {
  console.error("\n✗ Failed:", err.message);
  process.exit(1);
});
