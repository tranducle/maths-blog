import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const postStatus = pgEnum("post_status", ["draft", "published"]);

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  deck: text("deck").notNull().default(""),
  category: text("category").notNull().default("General"),
  tags: text("tags")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  author: text("author").notNull().default("Anonymous"),
  bodyMarkdown: text("body_markdown").notNull().default(""),
  // JSON (string) mapping tikz source-hash → cached SVG blob URL. Populated by
  // renderAndCacheTikz() when a post is saved. null = not yet rendered → public
  // pages fall back to client-side TikZJax.
  tikzRenders: text("tikz_renders"),
  status: postStatus("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
