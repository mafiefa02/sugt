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
 * **Migration 0036 refuses unmigrated receipts** (#379, ADR-0040). It drops `storage_path`, so a row
 * still holding only that — a receipt `drive:migrate-receipts` never moved — would lose the only
 * pointer to its bytes. The migration must raise instead, and drop nothing.
 *
 * The suite's own database is already past 0036, so each test makes a scratch database beside it on
 * the same cluster, migrates it to 0035, seeds `transaction_evidence` as it stood then, and applies
 * the rest. The seed skips the foreign keys (`session_replication_role = replica`): the guard reads
 * this one table, and a real chain of person, cluster, sub-cluster, Perjadin and transaction rows
 * would be written in a schema the app no longer has types for.
 */

const LAST_BEFORE = "0035_drive_sync_failed_at";

let scratchUrl: string;
let maintenanceUrl: string;
let scratchName: string;
let throughLastBefore: string;

/** A copy of the migrations folder whose journal stops at `LAST_BEFORE`. */
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

/** Receipts as they stood at 0035: a Drive id, a Supabase key, or — never, by CHECK — both. */
async function seed(rows: { storagePath?: string; driveFileId?: string }[]) {
  const ids = rows.map(() => randomUUID());
  await withClient(scratchUrl, async (sql) => {
    await sql.begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      for (const [index, row] of rows.entries()) {
        await tx`
          insert into transaction_evidence
            (id, transaction_id, storage_path, drive_file_id, content_type, byte_size,
             uploaded_by_person_id)
          values
            (${ids[index]!}, ${randomUUID()}, ${row.storagePath ?? null}, ${row.driveFileId ?? null},
             'image/jpeg', 1000, ${randomUUID()})`;
      }
    });
  });
  return ids;
}

const applyTheRest = () =>
  withClient(scratchUrl, (sql) => migrate(drizzle(sql), { migrationsFolder }));

const columnsOfEvidence = () =>
  withClient(scratchUrl, async (sql) => {
    const rows = await sql<{ column_name: string; is_nullable: string }[]>`
      select column_name, is_nullable from information_schema.columns
       where table_schema = 'public' and table_name = 'transaction_evidence'`;
    return Object.fromEntries(rows.map((row) => [row.column_name, row.is_nullable]));
  });

beforeEach(async () => {
  const testUrl = new URL(process.env.DATABASE_URL!);
  scratchName = `${decodeURIComponent(testUrl.pathname.slice(1))}_0036_${randomUUID().slice(0, 8)}`;
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
});

afterEach(async () => {
  await withClient(maintenanceUrl, (sql) =>
    sql.unsafe(`drop database if exists "${scratchName}" with (force)`),
  );
  await rm(throughLastBefore, { recursive: true, force: true });
});

describe("0036_receipts_drive_only", () => {
  it("refuses a receipt still only in Supabase, naming it, and drops nothing", async () => {
    const [moved, unmoved] = await seed([
      { driveFileId: "drive-file-1" },
      { storagePath: "9f2c1e00-0000-4000-8000-000000000001" },
    ]);

    const refusal = await applyTheRest().catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(Error);
    const message = String((refusal as { cause?: unknown }).cause ?? refusal);
    expect(message).toContain("0036_receipts_drive_only");
    expect(message).toContain(unmoved);
    expect(message).not.toContain(moved);
    await expect(columnsOfEvidence()).resolves.toMatchObject({
      storage_path: "YES",
      drive_file_id: "YES",
    });
    await expect(
      withClient(scratchUrl, (sql) => sql`select storage_path from transaction_evidence`),
    ).resolves.toEqual(
      expect.arrayContaining([{ storage_path: "9f2c1e00-0000-4000-8000-000000000001" }]),
    );
  });

  it("applies on a fully migrated database, keeping every receipt", async () => {
    const ids = await seed([{ driveFileId: "drive-file-1" }, { driveFileId: "drive-file-2" }]);

    await applyTheRest();

    const columns = await columnsOfEvidence();
    expect(columns).not.toHaveProperty("storage_path");
    expect(columns.drive_file_id).toBe("NO");
    const kept = await withClient(
      scratchUrl,
      (sql) => sql<{ id: string }[]>`select id from transaction_evidence`,
    );
    expect(kept.map((row) => row.id).sort()).toEqual([...ids].sort());
  });
});
