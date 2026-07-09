import { slugify } from "@/lib/slug";
import type { NewPost } from "@/db/schema";

// Shared request/input shape + validation for the cookie-based admin routes
// (/api/posts) and the agent API (/api/agent/posts). Keeps the two surfaces in
// lockstep so a post created either way validates identically.

export type PostInput = {
  title?: string;
  slug?: string;
  deck?: string;
  category?: string;
  tags?: unknown;
  author?: string;
  bodyMarkdown?: string;
  status?: string;
};

/** Tags must be a string array; coerce + trim + drop empties. */
export function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter(Boolean);
}

export type ValidatedPost = {
  ok: true;
  input: NewPost;
  slug: string;
};
export type RejectedPost = { ok: false; error: string; status: number };

/**
 * Validate + normalize a create payload. `title` is required; `slug` is derived
 * from the title when absent. Returns a discriminated union so callers can
 * branch cleanly into a JSON error or a DB insert.
 */
export function validateCreate(body: PostInput): ValidatedPost | RejectedPost {
  const title = (body.title ?? "").trim();
  if (!title) return { ok: false, error: "Title is required", status: 400 };

  const slug = slugify(body.slug?.trim() || title);
  if (!slug)
    return { ok: false, error: "Could not derive a slug", status: 400 };

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
  return { ok: true, input, slug };
}
