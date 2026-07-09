import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { updatePost, deletePost, slugExists, getById } from "@/db/queries";
import { slugify } from "@/lib/slug";
import type { NewPost } from "@/db/schema";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

type PostInput = {
  title?: string;
  slug?: string;
  deck?: string;
  category?: string;
  tags?: unknown;
  author?: string;
  bodyMarkdown?: string;
  status?: string;
};

function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter(Boolean);
}

export async function PUT(req: Request, { params }: Params) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await assertSameOrigin())) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await getById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: PostInput;
  try {
    body = (await req.json()) as PostInput;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const slug = slugify(body.slug?.trim() || title);
  if (!slug) {
    return NextResponse.json({ error: "Could not derive a slug" }, { status: 400 });
  }
  if (await slugExists(slug, id)) {
    return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
  }

  const status = body.status === "published" ? "published" : "draft";
  const patch: Partial<NewPost> = {
    slug,
    title,
    deck: (body.deck ?? "").trim(),
    category: (body.category ?? "").trim() || "General",
    tags: normalizeTags(body.tags),
    author: (body.author ?? "").trim() || "Anonymous",
    bodyMarkdown: body.bodyMarkdown ?? "",
    status,
  };

  const updated = await updatePost(id, patch);
  return NextResponse.json({ post: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await assertSameOrigin())) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  const { id } = await params;
  const ok = await deletePost(id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
