import type { TransactionCategory } from "@sugt/domain";
import { and, asc, count, eq, exists, isNull, notExists, notInArray, sql } from "drizzle-orm";

import { db } from "../client";
import { subCluster } from "../schema/reference";
import { perjadin, transaction, transactionEvidence } from "../schema/travel";
import type { Person } from "./caller";
import { perjadinFolderNaming, type PerjadinFolderNaming } from "./perjadin-naming";
import { requireStaff } from "./staff-only";

/**
 * **What the Drive reconcile reads and writes** (ADR-0040, #373) — one transaction's place in the
 * company Drive tree. The reconcile itself talks to Google and lives in `@sugt/internal`; this module
 * is only its database half.
 *
 * Every function is Staff-only: the reconcile runs after a Staff member records or adds a receipt,
 * or when an Administrator — Staff too — sweeps what is unsynced. A Pimpinan writes nothing.
 *
 * **No row lock is held across a call to Google.** The Perjadin's and the transaction's folder ids
 * are claimed by compare-and-set instead: the update writes only where the column is still null, and
 * a caller that lost reads back the winner's id and trashes the folder it made.
 */

/** A Perjadin's Drive folders and what they are named from. */
export type PerjadinDriveFolder = {
  driveFolderId: string | null;
  /** Its folder under `Dokumen/Pelaksanaan Offline` (ADR-0042), named the same way. */
  driveDokumenFolderId: string | null;
  naming: PerjadinFolderNaming;
};

/**
 * What renaming a Perjadin's Drive folder reads (#376) — after a date correction, and again in the
 * reconcile, fresh, just before it re-asserts the name. `null` when there is no such trip.
 */
export async function perjadinDriveFolder(
  caller: Person,
  perjadinId: string,
): Promise<PerjadinDriveFolder | null> {
  requireStaff(caller);

  const [trip] = await db
    .select({
      driveFolderId: perjadin.driveFolderId,
      driveDokumenFolderId: perjadin.driveDokumenFolderId,
      naming: perjadinFolderNaming,
    })
    .from(perjadin)
    .innerJoin(subCluster, eq(subCluster.id, perjadin.subClusterId))
    .where(eq(perjadin.id, perjadinId));
  return trip ?? null;
}

/** One receipt on the line, as the reconcile names and moves it. */
export type ReconcileEvidence = { id: string; driveFileId: string; contentType: string };

/** Everything the reconcile needs to put one transaction in place. */
export type ReconcileTarget = {
  transactionId: string;
  spentOn: string;
  category: TransactionCategory;
  driveFolderId: string | null;
  /** Its Perjadin, and what that Perjadin's folder is named from. */
  perjadin: PerjadinFolderNaming;
  perjadinDriveFolderId: string | null;
  evidence: ReconcileEvidence[];
};

/** The transaction, its Perjadin and its receipts. `null` when there is no such line. */
export async function reconcileTarget(
  caller: Person,
  transactionId: string,
): Promise<ReconcileTarget | null> {
  requireStaff(caller);

  const [line] = await db
    .select({
      transactionId: transaction.id,
      spentOn: transaction.spentOn,
      category: transaction.category,
      driveFolderId: transaction.driveFolderId,
      perjadin: perjadinFolderNaming,
      perjadinDriveFolderId: perjadin.driveFolderId,
    })
    .from(transaction)
    .innerJoin(perjadin, eq(perjadin.id, transaction.perjadinId))
    .innerJoin(subCluster, eq(subCluster.id, perjadin.subClusterId))
    .where(eq(transaction.id, transactionId));
  if (!line) return null;

  const evidence = await db
    .select({
      id: transactionEvidence.id,
      driveFileId: transactionEvidence.driveFileId,
      contentType: transactionEvidence.contentType,
    })
    .from(transactionEvidence)
    .where(eq(transactionEvidence.transactionId, transactionId))
    .orderBy(asc(transactionEvidence.uploadedAt), asc(transactionEvidence.id));

  return { ...line, evidence };
}

/**
 * Claim `folderId` as the Perjadin's Drive folder, unless another caller got there first. Answers
 * the folder that won — `folderId` itself, or the earlier one, in which case the caller trashes its
 * own.
 */
export async function claimPerjadinDriveFolder(
  caller: Person,
  perjadinId: string,
  folderId: string,
): Promise<string> {
  requireStaff(caller);

  const [claimed] = await db
    .update(perjadin)
    .set({ driveFolderId: folderId })
    .where(and(eq(perjadin.id, perjadinId), isNull(perjadin.driveFolderId)))
    .returning({ id: perjadin.driveFolderId });
  if (claimed?.id) return claimed.id;

  const [winner] = await db
    .select({ id: perjadin.driveFolderId })
    .from(perjadin)
    .where(eq(perjadin.id, perjadinId));
  return winner!.id!;
}

/** The same compare-and-set, for a line's own folder — a line from before Drive has none. */
export async function claimTransactionDriveFolder(
  caller: Person,
  transactionId: string,
  folderId: string,
): Promise<string> {
  requireStaff(caller);

  const [claimed] = await db
    .update(transaction)
    .set({ driveFolderId: folderId })
    .where(and(eq(transaction.id, transactionId), isNull(transaction.driveFolderId)))
    .returning({ id: transaction.driveFolderId });
  if (claimed?.id) return claimed.id;

  const [winner] = await db
    .select({ id: transaction.driveFolderId })
    .from(transaction)
    .where(eq(transaction.id, transactionId));
  return winner!.id!;
}

/**
 * The reconcile finished this line: folder in place, files named and inside it, folder shared.
 * Answers whether the line now reads as synced.
 *
 * **Only for the receipts it actually handled.** A line gains receipts after it exists (Unggah
 * bukti), so a reconcile that read the line a moment ago can finish after a newer receipt was
 * committed — and reset the line to unsynced — while that receipt's own reconcile failed. Marking the
 * line synced then would strand the new file in `_staging` under a line that claims to be done, and
 * the sweep only visits unsynced lines. So the mark is a compare-and-set: it lands only when no
 * receipt on the line is outside `handledEvidenceIds`. If it does not land, the line is synced
 * only if some later reconcile already finished it.
 */
export async function markTransactionSynced(
  caller: Person,
  transactionId: string,
  handledEvidenceIds: string[],
): Promise<boolean> {
  requireStaff(caller);

  const unhandled = db
    .select({ id: transactionEvidence.id })
    .from(transactionEvidence)
    .where(
      and(
        eq(transactionEvidence.transactionId, transactionId),
        handledEvidenceIds.length > 0
          ? notInArray(transactionEvidence.id, handledEvidenceIds)
          : undefined,
      ),
    );
  const [marked] = await db
    .update(transaction)
    .set({ driveSyncedAt: sql`now()`, driveSyncFailedAt: null })
    .where(and(eq(transaction.id, transactionId), notExists(unhandled)))
    .returning({ id: transaction.id });
  if (marked) return true;

  const [line] = await db
    .select({ syncedAt: transaction.driveSyncedAt })
    .from(transaction)
    .where(eq(transaction.id, transactionId));
  return line?.syncedAt != null;
}

/**
 * A reconcile could not finish this line — a trashed or missing folder, or Drive failing. Recorded so
 * the sweep moves on to other lines first next time (`unsyncedTransactions`); a line that synced
 * meanwhile is left alone.
 */
export async function markTransactionSyncFailed(
  caller: Person,
  transactionId: string,
): Promise<void> {
  requireStaff(caller);

  await db
    .update(transaction)
    .set({ driveSyncFailedAt: sql`now()` })
    .where(and(eq(transaction.id, transactionId), isNull(transaction.driveSyncedAt)));
}

/** One line the sweep will reconcile, with what Periksa koneksi says about it if it fails. */
export type UnsyncedTransaction = { id: string; spentOn: string; description: string };

/**
 * **What the sweep owes**: every unsynced transaction — `drive_synced_at is null` and at least one
 * receipt; a zero-receipt line never is — at most `limit` of them, and how many
 * there are in all. Periksa koneksi and a reconnect reconcile these in turn (#375), bounded so one
 * press fits a Vercel function's time limit.
 *
 * **Oldest first, among lines that have not failed**; then lines that have, the longest-failed first.
 * Without that second key a few lines that fail every time — a folder trashed by hand, which is
 * never recreated — would fill every bounded press and the lines behind them would never be reached.
 */
export async function unsyncedTransactions(
  caller: Person,
  limit: number,
): Promise<{ total: number; lines: UnsyncedTransaction[] }> {
  requireStaff(caller);

  const unsynced = and(
    isNull(transaction.driveSyncedAt),
    exists(
      db
        .select({ id: transactionEvidence.id })
        .from(transactionEvidence)
        .where(eq(transactionEvidence.transactionId, transaction.id)),
    ),
  );
  const [lines, [counted]] = await Promise.all([
    db
      .select({
        id: transaction.id,
        spentOn: transaction.spentOn,
        description: transaction.description,
      })
      .from(transaction)
      .where(unsynced)
      .orderBy(
        sql`${transaction.driveSyncFailedAt} asc nulls first`,
        asc(transaction.createdAt),
        asc(transaction.id),
      )
      .limit(limit),
    db.select({ total: count() }).from(transaction).where(unsynced),
  ]);
  return { total: counted?.total ?? 0, lines };
}
