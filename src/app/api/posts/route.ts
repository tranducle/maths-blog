import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { renderAndCacheTikz } from "@/lib/tikz-render";
import { createPost, slugExists } from "@/db/queries";
import { slugify } from "@/lib/slug";
import type { NewPost } from "@/db/schema";

// DB access → Node runtime.
export const runtime = "nodejs";

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

export async function POST(req: Request) {
  // RT-01/upload parity: self-guard, don't rely on middleware alone.
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await assertSameOrigin())) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
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
  if (await slugExists(slug)) {
    return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
  }

  const status = body.status === "published" ? "published" : "draft";
  const input: NewPost = {
    slug,
    title,
    deck: (body.deck ?? "").trim(),
    category: (body.category ?? "").trim() || "General",
    tags: normalizeTags(body.tags),
    author: (body.author ?? "").trim() || "Anonymous",
    bodyMarkdown: body.bodyMarkdown ?? "",
    status,
  };

  // Render ```tikz blocks to LaTeX-quality SVG and cache. Never throws.
  const tikzRenders = await renderAndCacheTikz(input.bodyMarkdown ?? "", null);
  input.tikzRenders = tikzRenders ? JSON.stringify(tikzRenders) : null;

  const created = await createPost(input);
  return NextResponse.json({ post: created }, { status: 201 });
}
