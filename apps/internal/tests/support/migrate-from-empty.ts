import { migrationsFolder } from "@sugt/db/migrations";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Drop the test database, create it, and apply every migration in order.
 *
 * This runs once per `vitest` invocation and it is not only setup. **It is the check
 * that the migrations apply from empty in one pass**, which is the acceptance
 * condition for the schema half of this feature and the thing with the sharpest
 * failure mode: get the ordering wrong and it keeps working on the machine that has
 * already run the earlier version, while failing on every new environment.
 *
 * Dropping rather than truncating is deliberate for the same reason. A database that
 * survived between runs would stop proving anything about ordering after the first.
 */
export default async function setup() {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL is not set. vitest.config.mts sets a default.");
  }

  // You cannot drop a database you are connected to, so the drop runs on the
  // maintenance database of the same cluster.
  const maintenance = new URL(testDatabaseUrl);
  const database = decodeURIComponent(maintenance.pathname.slice(1));
  if (!database) throw new Error(`TEST_DATABASE_URL names no database: ${testDatabaseUrl}`);
  maintenance.pathname = "/postgres";

  const admin = postgres(maintenance.toString(), { prepare: false, max: 1 });
  try {
    await admin.unsafe(`drop database if exists "${database}" with (force)`);
    await admin.unsafe(`create database "${database}"`);
  } finally {
    await admin.end();
  }

  const client = postgres(testDatabaseUrl, { prepare: false, max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end();
  }
}
