import { and, asc, count, eq, isNotNull, isNull } from "drizzle-orm";

import { db } from "../client";
import { transaction, transactionEvidence } from "../schema/travel";
import type { Person } from "./caller";
import { requireGrant } from "./staff-only";

/**
 * **The database half of moving legacy receipts to Google Drive** (#377, ADR-0040) — the one-off,
 * local script `drive:migrate-receipts` in `@sugt/internal` drives these. An Administrator runs it,
 * so each opens with the Administrator Grant.
 *
 * A legacy receipt is an evidence row with `storage_path` set and no `drive_file_id`: an object in
 * the private Supabase `receipts` bucket. Migrating one swaps the first for the second in a single
 * update, which the exactly-one CHECK holds either side of.
 *
 * **These serve a script, not a screen** — the one bend in this layer's third convention, and the
 * module goes when the migration is done and #379 drops `storage_path`.
 */

/** One receipt still in the Supabase bucket, as the script fetches and moves it. */
export type LegacyReceipt = {
  id: string;
  transactionId: string;
  perjadinId: string;
  storagePath: string;
};

/** Every legacy receipt, oldest first — the order the script migrates them in. */
export async function legacyReceipts(caller: Person): Promise<LegacyReceipt[]> {
  requireGrant(caller, "Administrator");

  const rows = await db
    .select({
      id: transactionEvidence.id,
      transactionId: transactionEvidence.transactionId,
      perjadinId: transaction.perjadinId,
      storagePath: transactionEvidence.storagePath,
    })
    .from(transactionEvidence)
    .innerJoin(transaction, eq(transaction.id, transactionEvidence.transactionId))
    .where(and(isNotNull(transactionEvidence.storagePath), isNull(transactionEvidence.driveFileId)))
    .orderBy(asc(transactionEvidence.uploadedAt), asc(transactionEvidence.id));
  return rows.flatMap((row) => (row.storagePath ? [{ ...row, storagePath: row.storagePath }] : []));
}

/**
 * Point a legacy receipt at its new Drive file, in one write: `drive_file_id`, the type and size of
 * what was uploaded, `storage_path` cleared — the Supabase key leaves the database here, which is why
 * the script writes its report line first — and the line marked unsynced, so the reconcile that
 * follows, or a later sweep, moves the file into place. Answers false when the row had already been
 * migrated, by another run.
 */
export async function moveReceiptToDrive(
  caller: Person,
  evidenceId: string,
  file: { driveFileId: string; contentType: string; byteSize: number },
): Promise<boolean> {
  requireGrant(caller, "Administrator");

  return db.transaction(async (tx) => {
    const [moved] = await tx
      .update(transactionEvidence)
      .set({
        driveFileId: file.driveFileId,
        contentType: file.contentType,
        byteSize: file.byteSize,
        storagePath: null,
      })
      .where(and(eq(transactionEvidence.id, evidenceId), isNull(transactionEvidence.driveFileId)))
      .returning({ transactionId: transactionEvidence.transactionId });
    if (!moved) return false;

    await tx
      .update(transaction)
      .set({ driveSyncedAt: null })
      .where(eq(transaction.id, moved.transactionId));
    return true;
  });
}

/** What `--verify` checks the Drive tree against. */
export type ReceiptMigrationState = {
  /** Rows still holding a `storage_path`. Zero when the migration is done. */
  legacyRemaining: number;
  /** Every Drive-backed receipt, with the folder its line says it should be in. */
  driveReceipts: {
    id: string;
    driveFileId: string;
    byteSize: number;
    transactionId: string;
    transactionFolderId: string | null;
  }[];
  /** Every line with a Drive-backed receipt: is it synced, and where is its folder. */
  driveTransactions: { id: string; driveFolderId: string | null; driveSyncedAt: Date | null }[];
};

/**
 * The state `--verify` checks: how many legacy rows remain, every Drive receipt with its line's
 * folder, and every line that holds one. One read of each, for the whole database — a one-off check
 * run by hand, on a few hundred receipts.
 */
export async function receiptMigrationState(caller: Person): Promise<ReceiptMigrationState> {
  requireGrant(caller, "Administrator");

  const [[remaining], receipts] = await Promise.all([
    db
      .select({ legacy: count() })
      .from(transactionEvidence)
      .where(isNotNull(transactionEvidence.storagePath)),
    db
      .select({
        id: transactionEvidence.id,
        driveFileId: transactionEvidence.driveFileId,
        byteSize: transactionEvidence.byteSize,
        transactionId: transactionEvidence.transactionId,
        transactionFolderId: transaction.driveFolderId,
        driveSyncedAt: transaction.driveSyncedAt,
      })
      .from(transactionEvidence)
      .innerJoin(transaction, eq(transaction.id, transactionEvidence.transactionId))
      .where(isNotNull(transactionEvidence.driveFileId))
      .orderBy(asc(transactionEvidence.uploadedAt), asc(transactionEvidence.id)),
  ]);

  const driveTransactions = new Map<string, ReceiptMigrationState["driveTransactions"][number]>();
  for (const receipt of receipts) {
    driveTransactions.set(receipt.transactionId, {
      id: receipt.transactionId,
      driveFolderId: receipt.transactionFolderId,
      driveSyncedAt: receipt.driveSyncedAt,
    });
  }
  return {
    legacyRemaining: remaining?.legacy ?? 0,
    driveReceipts: receipts.map((receipt) => ({
      id: receipt.id,
      driveFileId: receipt.driveFileId!,
      byteSize: receipt.byteSize,
      transactionId: receipt.transactionId,
      transactionFolderId: receipt.transactionFolderId,
    })),
    driveTransactions: [...driveTransactions.values()],
  };
}
