import { NextResponse } from "next/server";
import { assertAgentAuth } from "@/lib/agent-auth";
import { checkAgentRateLimit } from "@/lib/rate-limit";
import { validateCreate } from "@/lib/api-input";
import { createPost, slugExists, listAll, listPublished } from "@/db/queries";

// External AI agents authenticate with a bearer API key (AGENT_API_KEY), NOT the
// admin cookie session. This namespace is fully separate from /api/posts.
export const runtime = "nodejs";

function rateKey(req: Request): string {
  // Bucket by client IP. On Vercel, `x-forwarded-for` is set by the platform
  // (not the client), so it's trustworthy. If absent, fall back to the bearer
  // token tail — all legit agent traffic is ONE principal, so this still
  // collapses to a single bucket rather than letting an attacker fan out.
  // Never use a shared constant ("unknown"), which would let attackers share
  // one bucket and either crowd out the real agent or dodge per-IP limits.
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  return req.headers.get("authorization")?.slice(-16) ?? "no-auth";
}

/** GET /api/agent/posts — list/search posts. */
export async function GET(req: Request) {
  if (!assertAgentAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await checkAgentRateLimit(rateKey(req)))) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 },
    );
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "published";
  const q = url.searchParams.get("q") ?? undefined;
  const tag = url.searchParams.get("tag") ?? undefined;
  const category = url.searchParams.get("category") ?? undefined;
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? "50") || 50,
    100,
  );

  let rows;
  if (status === "all") {
    // Authed clients may see drafts too.
    rows = await listAll();
  } else if (status === "draft") {
    rows = (await listAll()).filter((p) => p.status === "draft");
  } else {
    rows = await listPublished({ q, tag, category });
  }

  // For listAll paths we still apply optional q/tag/category filters in-memory.
  if (status !== "published") {
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.title.toLowerCase().includes(needle) ||
          p.deck.toLowerCase().includes(needle) ||
          p.bodyMarkdown.toLowerCase().includes(needle),
      );
    }
    if (tag) rows = rows.filter((p) => p.tags.includes(tag));
    if (category) rows = rows.filter((p) => p.category === category);
  }

  const out = rows.slice(0, limit).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    deck: p.deck,
    category: p.category,
    tags: p.tags,
    author: p.author,
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    publishedAt: p.publishedAt,
  }));

  return NextResponse.json({ posts: out, count: out.length });
}

/** POST /api/agent/posts — create a draft or published post. */
export async function POST(req: Request) {
  if (!assertAgentAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await checkAgentRateLimit(rateKey(req)))) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 },
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = validateCreate(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (await slugExists(result.slug)) {
    return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
  }

  const post = await createPost(result.input);
  return NextResponse.json({ post }, { status: 201 });
}
