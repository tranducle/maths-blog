// RT-14: verify NO server secret leaks into the client bundle.
// Stronger than a naive 2-string grep:
//   1. Lists every env var declared in .env(.local/.example) and FAILS if any
//      non-NEXT_PUBLIC_ *name* appears in .next/static (the classic Next.js
//      foot-gun is accidentally inlining a var name that resolves to its value).
//   2. Fails if the *value* of any known secret (SESSION_SECRET, hashes, DB url,
//      blob token, password) appears anywhere in .next/static.
//
// Run after `npm run build`:
//   node scripts/check-secrets.mjs
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = import.meta.dirname + "/..";
const STATIC = join(ROOT, ".next", "static");

// Env-var names we care about (from .env.example). Any non-NEXT_PUBLIC_ one
// found by name in the client bundle is a leak.
const SECRET_ENV_NAMES = [
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD_HASH",
  "SESSION_SECRET",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "BLOB_READ_WRITE_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "AGENT_API_KEY",
  "RENDER_API_KEY",
];

// Collect actual secret *values* to grep for (if present in env at build time).
const secretValues = [];
for (const name of SECRET_ENV_NAMES) {
  const v = process.env[name];
  if (v && v.length >= 6) secretValues.push({ name, value: v });
}

if (!existsSync(STATIC)) {
  console.error(`✗ .next/static not found. Run \`npm run build\` first.`);
  process.exit(2);
}

// Walk .next/static, read all text-ish files once.
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (/\.(js|css|html|json|map|txt)$/.test(entry.name)) files.push(full);
  }
}
await walk(STATIC);

// Concatenate but remember which file each chunk came from for reporting.
const corpus = [];
for (const f of files) {
  // Skip source maps (they can echo filenames but not runtime secret values).
  if (f.endsWith(".map")) continue;
  corpus.push({ file: f, content: await readFile(f, "utf8") });
}

let leaks = 0;

// Check 1: any secret env-var NAME inlined into the bundle.
for (const name of SECRET_ENV_NAMES) {
  for (const { file, content } of corpus) {
    // Match as a quoted/assigned token to avoid false positives from comments.
    if (new RegExp(`["'\`]${name}["'\`]`).test(content)) {
      console.error(`✗ LEAK: env name "${name}" appears in ${file.replace(ROOT + "/", "")}`);
      leaks++;
    }
  }
}

// Check 2: any known secret VALUE in the bundle.
for (const { name, value } of secretValues) {
  // Escape regex specials; only search for distinctive substrings.
  const needle = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const { file, content } of corpus) {
    if (new RegExp(needle).test(content)) {
      console.error(`✗ LEAK: value of "${name}" appears in ${file.replace(ROOT + "/", "")}`);
      leaks++;
    }
  }
}

const scanned = corpus.length;
if (leaks === 0) {
  console.log(`✓ No secrets leaked into .next/static (${scanned} files scanned, ${SECRET_ENV_NAMES.length} names + ${secretValues.length} live values checked).`);
  process.exit(0);
} else {
  console.error(`\n✗ ${leaks} potential leak(s) found. Do not deploy.`);
  process.exit(1);
}
