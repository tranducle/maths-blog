# TikZ render service

Compiles TikZ snippets to SVG using a real LaTeX toolchain (`latex` + `dvisvgm`)
so diagrams render exactly as they would in Overleaf — unlike client-side
TikZJax (DVI→HTML, lower fidelity).

Deployed to Render.com (free tier; sleeps after 15 min idle → ~30s cold start).
The Next.js app calls it from `src/lib/tikz-render.ts` when a post with a
```` ```tikz ```` block is saved.

## Local dev

```bash
cd render-service
docker build -t tikz-render .
docker run -p 3001:3000 -e RENDER_API_KEY=devsecret tikz-render

# test
curl -X POST http://localhost:3001/convert \
  -H "content-type: application/json" \
  -H "x-api-key: devsecret" \
  -d '{"latexInput":"\\begin{tikzpicture}\\draw[thick,fill=blue!20] (0,0)--(3,0)--(0,2)--cycle;\\end{tikzpicture}","outputFormat":"SVG"}'
# → { "svg": "<svg ...>" }
```

## API

`POST /convert`
- Header `x-api-key: <RENDER_API_KEY>` (required if `RENDER_API_KEY` is set)
- Body: `{ latexInput, outputFormat: "SVG", scale?: 0.5–5 }`
- 200: `{ svg: "<svg ...>" }`
- 400/401/500: `{ error }`

`GET /health` → `{ ok, inflight }`

## Safety

- Client may only send the `tikzpicture` body — `documentclass`/`usepackage`
  are fixed by the service.
- `latex -no-shell-escape` + a blocklist (`\input`, `\write18`, …).
- Per-request temp dir, removed after. 30s compile timeout.
- Concurrency cap (`MAX_CONCURRENT`) so one slow render can't exhaust memory.
