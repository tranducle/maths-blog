import { and, arrayContains, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "./index";
import { posts, type NewPost, type Post } from "./schema";

export type PublicFilters = {
  tag?: string;
  category?: string;
  q?: string;
};

/** Published posts only (public homepage). Optional tag/category/search filters. */
export async function listPublished(filters: PublicFilters = {}): Promise<Post[]> {
  const conds = [eq(posts.status, "published")];

  if (filters.category) conds.push(eq(posts.category, filters.category));
  // RT-12: proven Drizzle array operator for text[] tag filtering (@>).
  if (filters.tag) conds.push(arrayContains(posts.tags, [filters.tag]));
  if (filters.q) {
    const needle = `%${filters.q}%`;
    // RT-15: inline ILIKE over title/deck/body — no FTS.
    const search = or(
      ilike(posts.title, needle),
      ilike(posts.deck, needle),
      ilike(posts.bodyMarkdown, needle),
    );
    if (search) conds.push(search);
  }

  return db
    .select()
    .from(posts)
    .where(and(...conds))
    .orderBy(desc(posts.publishedAt), desc(posts.createdAt));
}

/** Public article route: status-scoped so drafts are never reachable by slug (RT-02). */
export async function getPublishedBySlug(slug: string): Promise<Post | null> {
  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.slug, slug), eq(posts.status, "published")))
    .limit(1);
  return rows[0] ?? null;
}

/** Admin-only: fetch any post regardless of status (preview/edit). */
export async function getBySlug(slug: string): Promise<Post | null> {
  const rows = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getById(id: string): Promise<Post | null> {
  const rows = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Admin dashboard: all posts, drafts included. */
export async function listAll(): Promise<Post[]> {
  return db.select().from(posts).orderBy(desc(posts.updatedAt));
}

/** Distinct published categories for filter pills. */
export async function listCategories(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: posts.category })
    .from(posts)
    .where(eq(posts.status, "published"));
  return rows.map((r) => r.category).sort();
}

export async function createPost(input: NewPost): Promise<Post> {
  const publishedAt =
    input.status === "published" ? (input.publishedAt ?? new Date()) : null;
  const rows = await db
    .insert(posts)
    .values({ ...input, publishedAt })
    .returning();
  return rows[0];
}

export async function updatePost(
  id: string,
  input: Partial<NewPost>,
): Promise<Post | null> {
  const patch: Partial<NewPost> = { ...input, updatedAt: new Date() };
  // Stamp publishedAt the first time a post flips to published. By design it is
  // never cleared on unpublish, so unpublish→republish keeps the ORIGINAL date
  // (decision: original publish date is the canonical one).
  if (input.status === "published") {
    const existing = await getById(id);
    if (existing && existing.status !== "published" && !existing.publishedAt) {
      patch.publishedAt = new Date();
    }
  }
  const rows = await db
    .update(posts)
    .set(patch)
    .where(eq(posts.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deletePost(id: string): Promise<boolean> {
  const rows = await db.delete(posts).where(eq(posts.id, id)).returning({ id: posts.id });
  return rows.length > 0;
}

export async function slugExists(slug: string, excludeId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: posts.id })
    .from(posts)
    .where(
      excludeId
        ? and(eq(posts.slug, slug), sql`${posts.id} <> ${excludeId}`)
        : eq(posts.slug, slug),
    )
    .limit(1);
  return rows.length > 0;
}
