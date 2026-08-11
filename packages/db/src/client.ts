import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * The connection. Two URLs, because Supabase gives you two and they are not
 * interchangeable:
 *
 *   DATABASE_URL — Supavisor **transaction** mode, port 6543. What Vercel functions
 *                  use. Prepared statements are unavailable in this mode, hence
 *                  `prepare: false` below.
 *   DIRECT_URL   — Supavisor **session** mode, port 5432. Migrations and psql only.
 *
 * Both resolve to IPv4.
 *
 * `prepare: false` is not optional and its absence does not fail loudly: postgres-js
 * defaults to prepared statements, and under a transaction pooler those break
 * intermittently, under load, with errors that point nowhere near this line.
 */
declare const process: { env: Record<string, string | undefined> };

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Note turbo runs with envMode: strict — a variable " +
      "missing from the consuming task's `env` in turbo.json is invisible here even " +
      "when it is set in the shell.",
  );
}

const client = postgres(url, { prepare: false });

export const db = drizzle(client, { schema });
export type Db = typeof db;
