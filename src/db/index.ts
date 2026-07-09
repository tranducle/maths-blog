import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import * as schema from "./schema";

// Runtime client bound to the pooled Vercel Postgres / Neon endpoint (POSTGRES_URL).
// Migrations use the direct connection via drizzle.config.ts (POSTGRES_URL_NON_POOLING).
export const db = drizzle(sql, { schema });
