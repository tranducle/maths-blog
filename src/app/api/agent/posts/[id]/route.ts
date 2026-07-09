import { NextResponse } from "next/server";
import { assertAgentAuth } from "@/lib/agent-auth";
import { checkAgentRateLimit } from "@/lib/rate-limit";
import { normalizeTags } from "@/lib/api-input";
import { updatePost, deletePost, getById, slugExists } from "@/db/queries";
import { slugify } from "@/lib/slug";
import type { NewPost } from "@/db/schema";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

function rateKey(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("authorization")?.slice(-12) ||
    "unknown"
  );
}

type PatchInput = {
  title?: string;
  slug?: string;
  deck?: string;
  category?: string;
  tags?: unknown;
  author?: string;
  bodyMarkdown?: string;
  status?: string;
};

/** PUT /api/agent/posts/[id] — update a post (partial). */
export async function PUT(req: Request, { params }: { params: Params }) {
  if (!assertAgentAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await checkAgentRateLimit(rateKey(req)))) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 },
    );
  }

  const { id } = await params;
  const existing = await getById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: PatchInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Partial<NewPost> = {};

  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title)
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    patch.title = title;
  }

  if (body.slug !== undefined) {
    const slug = slugify(body.slug.trim());
    if (!slug)
      return NextResponse.json({ error: "Could not derive a slug" }, { status: 400 });
    if (slug !== existing.slug && (await slugExists(slug, id))) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
    }
    patch.slug = slug;
  }

  if (body.deck !== undefined) patch.deck = body.deck.trim();
  if (body.category !== undefined)
    patch.category = body.category.trim() || "General";
  if (body.tags !== undefined) patch.tags = normalizeTags(body.tags);
  if (body.author !== undefined)
    patch.author = body.author.trim() || "Anonymous";
  if (body.bodyMarkdown !== undefined) patch.bodyMarkdown = body.bodyMarkdown;
  if (body.status !== undefined)
    patch.status = body.status === "published" ? "published" : "draft";

  const updated = await updatePost(id, patch);
  return NextResponse.json({ post: updated });
}

/** DELETE /api/agent/posts/[id] — delete a post. */
export async function DELETE(req: Request, { params }: { params: Params }) {
  if (!assertAgentAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await checkAgentRateLimit(rateKey(req)))) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 },
    );
  }

  const { id } = await params;
  const ok = await deletePost(id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
