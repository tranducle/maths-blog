// LaTeX/TikZ → SVG render service. Compiles a tikzpicture snippet with a real
// LaTeX toolchain (latex + dvisvgm) inside the Docker image, returns the SVG
// inline as JSON. Designed to run on Render.com (free tier).
//
//   POST /convert
//   Headers: x-api-key: <RENDER_API_KEY>   (optional shared secret)
//   Body:    { "latexInput": "\\begin{tikzpicture}...\\end{tikzpicture}",
//              "outputFormat": "SVG", "scale": 2 }
//   200:     { "svg": "<svg ...>" }
//   400/500: { "error": "message" }
//
// Robustness:
//   - per-request temp dir, cleaned up after
//   - 30s hard timeout on the latex compile (kills runaway inputs)
//   - blocklist of unsafe primitives (\\input, \\write18, \\immediate)
//   - queue depth limit so one slow render can't exhaust memory
import express from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const execFileAsync = promisify(execFile);
const app = express();
app.use(express.json({ limit: "256kb" }));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.RENDER_API_KEY; // optional; if set, clients must send it.
const COMPILE_TIMEOUT_MS = 30_000;
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT || 3);

let inflight = 0;

// Primitives that read/write the filesystem or shell out — blocked to keep the
// sandbox safe even though we also pass -no-shell-escape to latex.
const BLOCKED = [
  /\\input\b/,
  /\\include\b/,
  /\\write18\b/,
  /\\immediate\b/,
  /\\shell-escape/,
  /\\jobname/,
];

// Wrap the user's snippet in a minimal standalone document. We intentionally do
// NOT accept a full \\documentclass from the client — only the tikzpicture body
// — so the toolchain + packages stay under our control.
function latexTemplate(body, scale) {
  // xelatex compiles Unicode (incl. Vietnamese, accent marks, CJK) natively —
  // no inputenc needed, no "Unicode character not set up" errors. We target
  // XDV (not PDF) so dvisvgm can convert to SVG.
  return [
    "\\documentclass[border=2pt]{standalone}",
    "\\usepackage{tikz}",
    "\\usetikzlibrary{arrows.meta,calc,decorations.pathreplacing,positioning,shapes.geometric}",
    "\\begin{document}",
    body.trim(),
    "\\end{document}",
  ].join("\n");
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, inflight });
});

app.post("/convert", async (req, res) => {
  // Auth (only enforced when a key is configured).
  if (API_KEY) {
    const sent = req.headers["x-api-key"];
    if (sent !== API_KEY) return res.status(401).json({ error: "Unauthorized" });
  }

  if (inflight >= MAX_CONCURRENT) {
    return res.status(503).json({ error: "Server busy, retry later." });
  }

  const { latexInput, outputFormat = "SVG", scale = 2 } = req.body || {};
  if (!latexInput || typeof latexInput !== "string") {
    return res.status(400).json({ error: "latexInput is required." });
  }
  if (outputFormat !== "SVG") {
    return res.status(400).json({ error: "Only outputFormat=SVG is supported." });
  }
  const blocked = BLOCKED.find((re) => re.test(latexInput));
  if (blocked) {
    return res.status(400).json({ error: `Blocked primitive: ${blocked}` });
  }
  const scaleNum = Math.min(Math.max(Number(scale) || 1, 0.5), 5);

  inflight++;
  const id = randomBytes(8).toString("hex");
  const dir = await mkdtemp(join(tmpdir(), `tikz-${id}-`));
  try {
    await writeFile(join(dir, "equation.tex"), latexTemplate(latexInput, scaleNum));

    // xelatex → XDV (Unicode-safe), then dvisvgm → SVG. xelatex handles
    // Vietnamese/accented/CJK text without inputenc. -no-shell-escape prevents
    // \\write18. timeout kills a stuck compile so one bad input can't hang us.
    await execFileAsync(
      "timeout",
      [
        `${COMPILE_TIMEOUT_MS / 1000}`,
        "xelatex",
        "-no-shell-escape",
        "-interaction=nonstopmode",
        "-halt-on-error",
        "-no-pdf", // emit .xdv for dvisvgm instead of .pdf
        "-output-directory",
        dir,
        join(dir, "equation.tex"),
      ],
      { cwd: dir, maxBuffer: 4 * 1024 * 1024, timeout: COMPILE_TIMEOUT_MS + 5000 },
    );

    const svgScale = scaleNum.toFixed(2);
    await execFileAsync(
      "dvisvgm",
      [
        "--no-fonts",
        `--scale=${svgScale}`,
        "--exact",
        "-o",
        join(dir, "out.svg"),
        join(dir, "equation.xdv"),
      ],
      { cwd: dir, maxBuffer: 8 * 1024 * 1024, timeout: 15_000 },
    );

    const svg = await readFile(join(dir, "out.svg"), "utf8");
    res.json({ svg });
  } catch (err) {
    const stderr = err.stderr?.toString() || "";
    // First line starting with "!" is the LaTeX error; fall back to "Missing"
    // or any "Error" line, then the generic message.
    const line =
      stderr.split("\n").find((l) => /^!/.test(l)) ||
      stderr.split("\n").find((l) => /Missing|Error|Undefined|not loadable/i.test(l)) ||
      "Compile failed.";
    res.status(500).json({ error: line.slice(0, 300) });
  } finally {
    inflight--;
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

app.listen(PORT, () => {
  console.log(`tikz-render listening on :${PORT} (concurrency ${MAX_CONCURRENT})`);
});
