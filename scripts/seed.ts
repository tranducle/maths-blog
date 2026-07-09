import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";
import { seedPosts } from "./seed-data";

// RT-03: idempotent one-off seed. Fixed slugs + ON CONFLICT DO NOTHING.
// Run manually via `npm run db:seed`. NEVER in the build step.
async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not set. Add it to .env.local first.");
  }

  const client = postgres(process.env.POSTGRES_URL, { prepare: false });
  const db = drizzle(client, { schema });

  const inserted = await db
    .insert(schema.posts)
    .values(seedPosts)
    .onConflictDoNothing({ target: schema.posts.slug })
    .returning({ slug: schema.posts.slug });

  console.log(
    `Seed complete. Inserted ${inserted.length} new post(s): ` +
      (inserted.map((r) => r.slug).join(", ") || "(none — already seeded)"),
  );

  const total = await db.select({ slug: schema.posts.slug }).from(schema.posts);
  console.log(`Total posts in DB: ${total.length}`);
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
