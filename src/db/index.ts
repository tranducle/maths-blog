import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Runtime client bound to the pooled Postgres connection (POSTGRES_URL).
// Uses `postgres` (postgres-js) over plain TCP — works with Supabase, Neon
// (non-serverless), and any standard Postgres. (The earlier @vercel/postgres
// driver only accepted Neon-specific connection strings.) Migrations use the
// direct connection via drizzle.config.ts (POSTGRES_URL_NON_POOLING).
const client = postgres(process.env.POSTGRES_URL!, { prepare: false });
export const db = drizzle(client, { schema });
