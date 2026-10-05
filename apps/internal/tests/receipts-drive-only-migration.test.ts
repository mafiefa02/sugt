import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  applyRemainingMigrations,
  scratchDatabaseThrough,
  withClient,
} from "./support/scratch-database";

/**
 * **Migration 0036 refuses unmigrated receipts** (#379, ADR-0040). It drops `storage_path`, so a row
 * still holding only that — a receipt the `drive:migrate-receipts` script (#377, removed here) never
 * moved — would lose the only pointer to its bytes. The migration must raise instead, naming each
 * such row, and drop nothing.
 *
 * The suite's own database is already past 0036, so each test makes a scratch database beside it on
 * the same cluster, migrates it to 0035 (`scratchDatabaseThrough`), seeds `transaction_evidence`
 * as it stood then, and applies the rest. The seed skips the foreign keys
 * (`session_replication_role = replica`): the guard reads this one table, and a real chain of
 * person, cluster, sub-cluster, Perjadin and transaction rows would be written in a schema the app
 * no longer has types for.
 */

const scratch = scratchDatabaseThrough("0035_drive_sync_failed_at");

/** Receipts as they stood at 0035: a Drive id, a Supabase key, or — never, by CHECK — both. */
async function seed(rows: { storagePath?: string; driveFileId?: string }[]) {
  const ids = rows.map(() => randomUUID());
  await withClient(scratch.url, async (sql) => {
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

const applyTheRest = () => applyRemainingMigrations(scratch.url);

const columnsOfEvidence = () =>
  withClient(scratch.url, async (sql) => {
    const rows = await sql<{ column_name: string; is_nullable: string }[]>`
      select column_name, is_nullable from information_schema.columns
       where table_schema = 'public' and table_name = 'transaction_evidence'`;
    return Object.fromEntries(rows.map((row) => [row.column_name, row.is_nullable]));
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
      withClient(scratch.url, (sql) => sql`select storage_path from transaction_evidence`),
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
      scratch.url,
      (sql) => sql<{ id: string }[]>`select id from transaction_evidence`,
    );
    expect(kept.map((row) => row.id).sort()).toEqual([...ids].sort());
  });
});
