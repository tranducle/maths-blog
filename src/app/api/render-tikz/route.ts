import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { renderTikz } from "@/lib/tikz-render";

// Proxy endpoint: the editor preview (client-side) calls this to render a TikZ
// snippet via the LaTeX render service. The render service's RENDER_API_KEY
// stays server-side (never exposed to the browser). Public pages use the cached
// SVG path instead, so this is only for live editor previews.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Admin + CSRF (same-origin) — the editor is a same-origin browser client.
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await assertSameOrigin())) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  let body: { source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const source = (body.source ?? "").trim();
  if (!source) {
    return NextResponse.json({ error: "source is required" }, { status: 400 });
  }
  try {
    const svg = await renderTikz(source);
    return NextResponse.json({ svg });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message.slice(0, 200) },
      { status: 502 },
    );
  }
}
