import { randomUUID } from "node:crypto";

import {
  legacyReceipts,
  moveReceiptToDrive,
  receiptMigrationState,
  type Person,
} from "@sugt/db/queries";
import { MAX_RECEIPT_BYTES } from "@sugt/domain";

import type { ReadyFolders } from "./fixed-folders";
import type { DriveClient } from "./google";
import {
  receiptExtension,
  SNIFF_LENGTH,
  sniffReceiptType,
  type ReceiptContentType,
} from "./receipt-files";
import { reconcileTransaction, type ReconcileResult } from "./reconcile";

/**
 * **Moving the legacy receipts from Supabase Storage into the company Drive** (#377, ADR-0040) — the
 * logic of the one-off `drive:migrate-receipts` script, kept apart from it so a test drives it
 * against the real database, the in-memory `FakeDrive` and a fake download. The script supplies the
 * real Drive client, the Supabase download, `sharp` and the report file.
 *
 * It reuses the app's own pieces rather than a second copy of any: the Drive client, the sniff, the
 * naming (through the reconcile) and the reconcile itself.
 */

/** What the run reaches outside the database. */
export type MigrationDeps = {
  /** The Administrator running it — every query is theirs. */
  person: Person;
  drive: DriveClient;
  folders: ReadyFolders;
  /** A legacy object's bytes from the Supabase `receipts` bucket, or `null` when it is not there. */
  download: (storagePath: string) => Promise<Uint8Array | null>;
  /**
   * Re-encode a photograph the way the browser does (ADR-0040): JPEG, long edge at most 2400 px,
   * quality about 0.82, orientation applied, **EXIF and GPS stripped** — these are about to be
   * link-public. The script passes `sharp`.
   */
  reencodeImage: (bytes: Uint8Array) => Promise<Uint8Array>;
  /**
   * Record `evidence id, old storage_path, drive_file_id` **before** the row is written: once it is,
   * the Supabase key is gone from the database, and this report is what makes deleting the bucket
   * safe later.
   */
  appendReport: (line: {
    evidenceId: string;
    storagePath: string;
    driveFileId: string;
  }) => Promise<void>;
};

export type MigrationOptions = {
  /** List what would be migrated, the skipped types and the counts; write nothing anywhere. */
  dryRun?: boolean;
  /** A human-converted file for a receipt the sniff refused — `--replace <evidenceId>=<file>`. */
  replacements?: Map<string, Uint8Array>;
};

export type MigrationSkip = {
  evidenceId: string;
  storagePath: string;
  /**
   * `unreadable`: its first bytes say JPEG, PNG or WebP, but the image will not decode — a truncated
   * upload, say. Like an unsupported type, a `--replace` file is what moves it.
   */
  reason: "not-in-bucket" | "unsupported-type" | "unreadable" | "too-large";
};

export type MigrationReport = {
  /** Migrated — or, on a dry run, would have been. */
  migrated: { evidenceId: string; contentType: ReceiptContentType; byteSize: number }[];
  /** Left as they are, each with why; a `--replace` file is what moves an unsupported one. */
  skipped: MigrationSkip[];
  /** Written and moved, but the reconcile has not put them in place yet — a sweep will. */
  unsynced: { evidenceId: string; reason: Exclude<ReconcileResult, { outcome: "synced" }> }[];
};

/**
 * Prepare one legacy file for Drive: a PDF as it is; a JPEG, PNG or WebP re-encoded to JPEG; anything
 * else — HEIC, say — refused. The type is the sniff's, never the old row's.
 */
async function prepare(
  bytes: Uint8Array,
  reencodeImage: MigrationDeps["reencodeImage"],
): Promise<{ bytes: Uint8Array; contentType: ReceiptContentType } | MigrationSkip["reason"]> {
  const sniffed = sniffReceiptType(bytes.subarray(0, SNIFF_LENGTH));
  if (!sniffed) return "unsupported-type";
  let prepared: { bytes: Uint8Array; contentType: ReceiptContentType };
  if (sniffed === "application/pdf") prepared = { bytes, contentType: sniffed };
  else {
    // One image that will not decode is that row's problem, not a reason to stop the whole run.
    const reencoded = await reencodeImage(bytes).catch(() => null);
    if (!reencoded) return "unreadable";
    prepared = { bytes: reencoded, contentType: "image/jpeg" };
  }
  return prepared.bytes.length > MAX_RECEIPT_BYTES ? "too-large" : prepared;
}

/**
 * **Migrate every legacy receipt, oldest first.** Per row:
 *
 * 1. **Download** it from the bucket — or take its `--replace` file.
 * 2. **Sniff and prepare** it (`prepare`); an unsupported or over-cap file is skipped and listed.
 * 3. **Upload** it to `_staging`, named `{uuid}.{ext}`, with `sugtPerjadinId`.
 * 4. **Append the report line, then write the row** (`moveReceiptToDrive`): `drive_file_id`, the new
 *    type and size, `storage_path` cleared, the line unsynced.
 * 5. **Reconcile** the line: folders made if missing, the file named and moved in, the folder shared.
 *
 * **Resumable**: only rows still holding a `storage_path` are read, so a second run skips what the
 * first finished. A crash between the upload and the write leaves only an orphan in private
 * `_staging`, which ADR-0040 accepts.
 */
export async function migrateLegacyReceipts(
  deps: MigrationDeps,
  options: MigrationOptions = {},
): Promise<MigrationReport> {
  const report: MigrationReport = { migrated: [], skipped: [], unsynced: [] };

  for (const receipt of await legacyReceipts(deps.person)) {
    const skip = (reason: MigrationSkip["reason"]) =>
      report.skipped.push({ evidenceId: receipt.id, storagePath: receipt.storagePath, reason });

    const original =
      options.replacements?.get(receipt.id) ?? (await deps.download(receipt.storagePath));
    if (!original) {
      skip("not-in-bucket");
      continue;
    }
    const prepared = await prepare(original, deps.reencodeImage);
    if (typeof prepared === "string") {
      skip(prepared);
      continue;
    }

    const migrated = {
      evidenceId: receipt.id,
      contentType: prepared.contentType,
      byteSize: prepared.bytes.length,
    };
    if (options.dryRun) {
      report.migrated.push(migrated);
      continue;
    }

    const file = await deps.drive.uploadFile({
      name: `${randomUUID()}.${receiptExtension(prepared.contentType)}`,
      parentId: deps.folders.stagingFolderId,
      mimeType: prepared.contentType,
      bytes: prepared.bytes,
      appProperties: { sugtPerjadinId: receipt.perjadinId },
    });
    await deps.appendReport({
      evidenceId: receipt.id,
      storagePath: receipt.storagePath,
      driveFileId: file.id,
    });
    const moved = await moveReceiptToDrive(deps.person, receipt.id, {
      driveFileId: file.id,
      contentType: prepared.contentType,
      byteSize: prepared.bytes.length,
    });
    // Another run got there first: what this one uploaded is an orphan in `_staging`, accepted.
    if (!moved) continue;
    report.migrated.push(migrated);

    const reconciled = await reconcileTransaction(
      deps.person,
      deps.drive,
      deps.folders,
      receipt.transactionId,
    );
    if (reconciled.outcome !== "synced") {
      report.unsynced.push({ evidenceId: receipt.id, reason: reconciled });
    }
  }
  return report;
}

/** One thing `--verify` found wrong. */
export type VerifyProblem =
  | { problem: "legacy-remaining"; count: number }
  | {
      problem: "file-missing" | "file-trashed" | "file-misplaced" | "size-mismatch";
      evidenceId: string;
    }
  | { problem: "unsynced" | "not-shared"; transactionId: string }
  | { problem: "bucket-count-mismatch"; bucketObjects: number; reportLines: number };

/**
 * **`--verify`**: the migration is done only when all of these hold —
 *
 * - no row still has a `storage_path`;
 * - every Drive receipt exists in Drive, untrashed, inside its own line's folder, at its recorded
 *   size;
 * - every line with a Drive receipt is synced, and its folder carries the anyone/reader permission;
 * - the bucket holds exactly as many objects as the report has lines, when both are given.
 *
 * An empty list is a pass.
 */
export async function verifyMigration(
  deps: Pick<MigrationDeps, "person" | "drive">,
  counts: { bucketObjects?: number; reportLines?: number } = {},
): Promise<VerifyProblem[]> {
  const state = await receiptMigrationState(deps.person);
  const problems: VerifyProblem[] = [];

  if (state.legacyRemaining > 0) {
    problems.push({ problem: "legacy-remaining", count: state.legacyRemaining });
  }
  for (const receipt of state.driveReceipts) {
    const file = await deps.drive.getFile(receipt.driveFileId);
    const fault = !file
      ? "file-missing"
      : file.trashed
        ? "file-trashed"
        : !receipt.transactionFolderId || !file.parents.includes(receipt.transactionFolderId)
          ? "file-misplaced"
          : file.size !== receipt.byteSize
            ? "size-mismatch"
            : null;
    if (fault) problems.push({ problem: fault, evidenceId: receipt.id });
  }
  for (const line of state.driveTransactions) {
    if (!line.driveSyncedAt) problems.push({ problem: "unsynced", transactionId: line.id });
    const shared =
      line.driveFolderId !== null &&
      (await deps.drive.listPermissions(line.driveFolderId)).some(
        (permission) =>
          !permission.inherited && permission.type === "anyone" && permission.role === "reader",
      );
    if (!shared) problems.push({ problem: "not-shared", transactionId: line.id });
  }
  if (
    counts.bucketObjects !== undefined &&
    counts.reportLines !== undefined &&
    counts.bucketObjects !== counts.reportLines
  ) {
    problems.push({
      problem: "bucket-count-mismatch",
      bucketObjects: counts.bucketObjects,
      reportLines: counts.reportLines,
    });
  }
  return problems;
}
