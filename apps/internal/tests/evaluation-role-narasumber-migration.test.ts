import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { migrationsFolder } from "@sugt/db/migrations";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * **Migration 0038 renames the stored Perjadin Evaluation role** (#393, ADR-0024's amendment). The
 * self-declared `Pengajar` is `Narasumber` now, so an evaluation filed before the rename must read
 * `Narasumber` after it — the update sits between dropping the old CHECK and adding the new one.
 *
 * The suite's own database is already past 0038, so each test makes a scratch database beside it on
 * the same cluster, migrates it to 0037, seeds `perjadin_evaluation` as it stood then, and applies
 * the rest — the shape `receipts-drive-only-migration.test.ts` uses. The seed skips the foreign key
 * (`session_replication_role = replica`): the rename reads this one table.
 */

const LAST_BEFORE = "0037_perjadin_drops_travel_legs";

/**
 * Dropping a database forces a checkpoint, which crawls while the rest of the suite writes in
 * parallel; the default 10 s hook timeout is too tight for it under load.
 */
const DROP_TIMEOUT_MS = 30_000;

let scratchUrl: string;
let maintenanceUrl: string;
let scratchName: string;
let throughLastBefore: string;

/** A copy of the migrations folder whose journal stops at `tag`. */
async function migrationsThrough(tag: string) {
  const folder = await mkdtemp(path.join(tmpdir(), "sugt-migrations-"));
  await cp(migrationsFolder, folder, { recursive: true });
  const journalPath = path.join(folder, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
    entries: { tag: string }[];
  };
  const last = journal.entries.findIndex((entry) => entry.tag === tag);
  if (last < 0) throw new Error(`No migration ${tag} in the journal.`);
  journal.entries = journal.entries.slice(0, last + 1);
  await writeFile(journalPath, JSON.stringify(journal));
  return folder;
}

async function withClient<T>(url: string, run: (sql: postgres.Sql) => Promise<T>) {
  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => undefined });
  try {
    return await run(sql);
  } finally {
    await sql.end();
  }
}

/** One evaluation per role, as filed before 0038. */
async function seed(roles: string[]) {
  await withClient(scratchUrl, async (sql) => {
    await sql.begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      for (const role of roles) {
        await tx`
          insert into perjadin_evaluation
            (perjadin_id, filed_by_role, filed_by_name, lodging, transport, meals, punctuality)
          values (${randomUUID()}, ${role}, ${`Filer ${role}`}, 9, 9, 9, 9)`;
      }
    });
  });
}

beforeEach(async () => {
  const testUrl = new URL(process.env.DATABASE_URL!);
  scratchName = `${decodeURIComponent(testUrl.pathname.slice(1))}_0038_${randomUUID().slice(0, 8)}`;
  const maintenance = new URL(testUrl);
  maintenance.pathname = "/postgres";
  maintenanceUrl = maintenance.toString();
  const scratch = new URL(testUrl);
  scratch.pathname = `/${scratchName}`;
  scratchUrl = scratch.toString();

  await withClient(maintenanceUrl, (sql) => sql.unsafe(`create database "${scratchName}"`));
  throughLastBefore = await migrationsThrough(LAST_BEFORE);
  await withClient(scratchUrl, (sql) =>
    migrate(drizzle(sql), { migrationsFolder: throughLastBefore }),
  );
}, DROP_TIMEOUT_MS);

afterEach(async () => {
  await withClient(maintenanceUrl, (sql) =>
    sql.unsafe(`drop database if exists "${scratchName}" with (force)`),
  );
  await rm(throughLastBefore, { recursive: true, force: true });
}, DROP_TIMEOUT_MS);

describe("0038_evaluation_role_narasumber", () => {
  it("rewrites every stored 'Pengajar' to 'Narasumber' and leaves the other roles alone", async () => {
    await seed(["Pengajar", "Pengajar", "Pendamping", "Pimpinan"]);

    await withClient(scratchUrl, (sql) => migrate(drizzle(sql), { migrationsFolder }));

    const roles = await withClient(
      scratchUrl,
      (sql) => sql<{ filed_by_role: string }[]>`select filed_by_role from perjadin_evaluation`,
    );
    expect(roles.map((row) => row.filed_by_role).sort()).toEqual([
      "Narasumber",
      "Narasumber",
      "Pendamping",
      "Pimpinan",
    ]);
  });
});
