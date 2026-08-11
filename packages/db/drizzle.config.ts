import { defineConfig } from "drizzle-kit";

declare const process: { env: Record<string, string | undefined> };

/**
 * Migrations run against DIRECT_URL — Supavisor session mode, port 5432. The
 * transaction pooler on 6543 cannot run them.
 */
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
