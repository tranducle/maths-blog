import { defineConfig } from "drizzle-kit";

// RT-01: migrations must use the DIRECT (non-pooled) connection.
// The @vercel/postgres pooled endpoint cannot run drizzle-kit migrate.
const migrationUrl =
  process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL ?? "";

// Standard Drizzle + Postgres config. `dialect: "postgresql"` makes drizzle-kit
// use the `postgres` (postgres-js) driver over plain TCP — the correct transport
// for Supabase / raw Postgres. (The @vercel/postgres websocket driver is only
// for the runtime serverless client in src/db/index.ts, not for migrations.)
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: migrationUrl },
  strict: true,
  verbose: true,
});
