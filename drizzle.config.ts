import { defineConfig } from "drizzle-kit";

// RT-01: migrations must use the DIRECT (non-pooled) connection.
// The @vercel/postgres pooled endpoint cannot run drizzle-kit migrate.
const migrationUrl =
  process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL ?? "";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: migrationUrl },
  strict: true,
  verbose: true,
});
