import type { TransactionCategory } from "@sugt/domain";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "../client";
import { perjadin, transaction, transactionEvidence } from "../schema/travel";
import type { Person } from "./caller";
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

/** One Drive-backed receipt on the line, as the reconcile names and moves it. */
export type ReconcileEvidence = { id: string; driveFileId: string; contentType: string };

/** Everything the reconcile needs to put one transaction in place. */
export type ReconcileTarget = {
  transactionId: string;
  spentOn: string;
  category: TransactionCategory;
  driveFolderId: string | null;
  perjadinId: string;
  destination: string;
  startsOn: string;
  perjadinDriveFolderId: string | null;
  evidence: ReconcileEvidence[];
};

/** The transaction, its Perjadin and its Drive-backed receipts. `null` when there is no such line. */
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
      perjadinId: perjadin.id,
      destination: perjadin.destination,
      startsOn: perjadin.startsOn,
      perjadinDriveFolderId: perjadin.driveFolderId,
    })
    .from(transaction)
    .innerJoin(perjadin, eq(perjadin.id, transaction.perjadinId))
    .where(eq(transaction.id, transactionId));
  if (!line) return null;

  const rows = await db
    .select({
      id: transactionEvidence.id,
      driveFileId: transactionEvidence.driveFileId,
      contentType: transactionEvidence.contentType,
    })
    .from(transactionEvidence)
    .where(
      and(
        eq(transactionEvidence.transactionId, transactionId),
        isNotNull(transactionEvidence.driveFileId),
      ),
    )
    .orderBy(asc(transactionEvidence.uploadedAt), asc(transactionEvidence.id));
  // Legacy receipts in the Supabase bucket are not the reconcile's; the filter above dropped them.
  const evidence = rows.flatMap((row) =>
    row.driveFileId ? [{ ...row, driveFileId: row.driveFileId }] : [],
  );

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

/** The reconcile finished this line: folder in place, files named and inside it, folder shared. */
export async function markTransactionSynced(caller: Person, transactionId: string): Promise<void> {
  requireStaff(caller);

  await db
    .update(transaction)
    .set({ driveSyncedAt: sql`now()` })
    .where(eq(transaction.id, transactionId));
}
