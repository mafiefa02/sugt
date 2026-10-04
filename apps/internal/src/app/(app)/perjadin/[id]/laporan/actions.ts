"use server";

import { randomUUID } from "node:crypto";

import { driveAccessToken } from "-/lib/drive/access-token";
import { isDriveFailure, openDrive } from "-/lib/drive/google";
import {
  evidenceFileName,
  isReceiptContentType,
  receiptExtension,
  SNIFF_LENGTH,
  sniffReceiptType,
  transactionFolderName,
  type ReceiptContentType,
} from "-/lib/drive/receipt-files";
import { reconcileTransaction } from "-/lib/drive/reconcile";
import { receiptUploadGate } from "-/lib/drive/upload-gate";
import { requireEnv } from "-/lib/env";
import { requirePerson, type Person } from "-/lib/person";
import { mintReceiptUpload, readReceiptFacts } from "-/lib/receipt-media";
import { staffSurface } from "-/lib/staff-surface";
import {
  attachTransactionEvidence,
  filePerjadinReport,
  perjadinAcquittal,
  recordTransaction,
  requireStaff,
  type FilePerjadinReportResult,
  type NewEvidence,
} from "@sugt/db/queries";
import { MAX_RECEIPT_BYTES, MAX_RECEIPTS_PER_TRANSACTION } from "@sugt/domain";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import type {
  FinalizeReceiptsResult,
  MintReceiptUploadsResult,
  OpenReceiptSessionsResult,
  ReceiptToFinalize,
  ReceiptToOpen,
  RecordTransactionActionResult,
  TransactionToRecord,
} from "./action-types";

/**
 * **The Perjadin Report's writes.**
 *
 * Each lives beside the page that offers it, which keeps `revalidatePath` honest — every one of
 * them rewrites the payload of the screen the user is looking at, so every one revalidates that
 * screen and nothing else.
 *
 * None opens a transaction. The boundary is the query layer's fifth convention and lives in
 * `@sugt/db`; `requireStaff` inside each query is what closes the path, since a layout does not run
 * before a Server Action. Every one that touches Drive or Storage — opening upload sessions,
 * recording a line, minting, attaching — also calls it itself, first, through `staffOnTrip`, because
 * Google or Storage is reached before any query runs. Every refusal comes back as a value.
 */

/**
 * **The guard every receipt write runs before it touches Storage**: an explicit `requireStaff`, then
 * a read of the Perjadin. Returns whether the Perjadin exists.
 *
 * The order is load-bearing. The mint hands out a write credential for the private `receipts`
 * bucket, and the read-back uses the service-role key, which bypasses every policy on it; doing
 * either first would give a non-Staff caller an upload URL, or tell them whether an object exists and
 * how big it is. The `requireStaff` is what closes this: `perjadinAcquittal` is an open money read
 * since #180 (ADR-0026), so the read alone no longer refuses a Pimpinan.
 */
async function staffOnTrip(person: Person, perjadinId: string): Promise<boolean> {
  const acquittal = await staffSurface(() => {
    requireStaff(person);
    return perjadinAcquittal(person, perjadinId);
  });
  return acquittal !== null;
}

/**
 * Read each landed receipt's real content type and size back from Storage — the server never saw
 * the bytes — so the evidence row holds what Storage recorded, not what the browser claimed. One
 * whose read-back fails is a PUT that never landed: it is counted in `failed`, never written with
 * guessed columns. What a miss means is the caller's to decide. Run only after `staffOnTrip`.
 */
async function readBack(
  receipts: ReceiptToFinalize[],
): Promise<{ ready: NewEvidence[]; failed: number }> {
  const facts = await Promise.all(
    receipts.map(async (item): Promise<NewEvidence | null> => {
      const read = await readReceiptFacts(item.path);
      if (!read) return null;
      return { storagePath: item.path, contentType: read.contentType, byteSize: read.byteSize };
    }),
  );
  const ready = facts.filter((file): file is NewEvidence => file !== null);
  return { ready, failed: receipts.length - ready.length };
}

/**
 * Open a Drive resumable upload session per file the Catat transaksi dialog is about to send
 * (ADR-0040). The browser `PUT`s each file's bytes straight to its session, so no receipt passes
 * through Vercel and its 4.5 MB request limit never applies.
 *
 * **Every check runs before Google is asked anything**: Staff and the Perjadin (`staffOnTrip`), the
 * count, each file's type and size, and only then the connection. Each session opens in `_staging`,
 * named `{uuid}.{ext}`, carrying `sugtPerjadinId`, declaring the file's exact size — Drive refuses a
 * longer body — and the uploading page's `Origin`, without which the browser cannot read the file id
 * back (#370). The origin is the request's own, since every preview has its own URL.
 */
export async function openReceiptSessionsAction(
  perjadinId: string,
  files: ReceiptToOpen[],
): Promise<OpenReceiptSessionsResult> {
  const person = await requirePerson();

  if (!(await staffOnTrip(person, perjadinId))) return { outcome: "no-such-perjadin" };
  if (files.length === 0) return { outcome: "evidence-missing" };
  if (files.length > MAX_RECEIPTS_PER_TRANSACTION) {
    return {
      outcome: "too-many-receipts",
      limit: MAX_RECEIPTS_PER_TRANSACTION,
      count: files.length,
    };
  }
  if (files.some((file) => !isReceiptContentType(file.contentType))) {
    return { outcome: "unsupported-type" };
  }
  if (files.some((file) => !(file.size > 0) || file.size > MAX_RECEIPT_BYTES)) {
    return { outcome: "too-large", limit: MAX_RECEIPT_BYTES };
  }

  const access = await driveAccessToken(person);
  if (access.outcome !== "ok") return { outcome: access.outcome };

  const origin = (await headers()).get("origin") ?? requireEnv("BETTER_AUTH_URL");
  const drive = openDrive(access.accessToken);
  try {
    const sessions = await Promise.all(
      files.map((file) => {
        const contentType = file.contentType as ReceiptContentType;
        return drive.openResumableSession({
          name: `${randomUUID()}.${receiptExtension(contentType)}`,
          parentId: access.folders.stagingFolderId,
          mimeType: contentType,
          size: file.size,
          origin,
          appProperties: { sugtPerjadinId: perjadinId },
        });
      }),
    );
    return { outcome: "ready", sessionUris: sessions.map((session) => session.sessionUri) };
  } catch (error) {
    if (isDriveFailure(error)) return { outcome: "drive-unreachable" };
    throw error;
  }
}

/** A receipt the server has checked in Drive, with what it really is. */
type VerifiedReceipt = { driveFileId: string; contentType: ReceiptContentType; byteSize: number };

/**
 * Check one uploaded file in Drive before it is recorded — the server never saw the bytes, and the
 * browser never had to tell the truth. It must sit in `_staging`, untrashed, carry this Perjadin's
 * `sugtPerjadinId`, and be no larger than the cap; then its first bytes must be a PDF or one of the
 * three images. The type is the sniff's and the size is Drive's.
 */
async function verifyReceipt(
  drive: ReturnType<typeof openDrive>,
  stagingFolderId: string,
  perjadinId: string,
  driveFileId: string,
): Promise<VerifiedReceipt | "unverified" | "unsupported-type"> {
  const file = await drive.getFile(driveFileId);
  if (
    !file ||
    file.trashed ||
    !file.parents.includes(stagingFolderId) ||
    file.appProperties.sugtPerjadinId !== perjadinId ||
    file.size === null ||
    file.size === 0 ||
    file.size > MAX_RECEIPT_BYTES
  ) {
    return "unverified";
  }
  const contentType = sniffReceiptType(await drive.readRange(driveFileId, 0, SNIFF_LENGTH - 1));
  if (!contentType) return "unsupported-type";
  return { driveFileId, contentType, byteSize: file.size };
}

/**
 * Record one line item against the Advance, **with the receipts the dialog has already uploaded to
 * Drive** (ADR-0039, ADR-0040). The write order is the ADR's:
 *
 * 1. **Check** — Staff, the Perjadin, the count, the amount, the connection — before any Drive call.
 *    The transaction's and each receipt's uuid are generated now, because the names need them.
 * 2. **Verify** each file (`verifyReceipt`). Any failure refuses the whole record.
 * 3. **Build** the transaction folder privately **inside `_staging`**, and rename and move each
 *    receipt into it.
 * 4. **Commit** the line, its evidence rows and its folder id in one write (`recordTransaction`).
 * 5. **Reconcile** — move the folder into the Perjadin's, share it, mark it synced. If that fails the
 *    line still stands: `synced: false`, never an error.
 *
 * A refusal before the commit leaves what it made in private `_staging`, unreferenced. ADR-0040
 * accepts that rather than build a cleanup, as ADR-0039 accepted orphans in the private bucket.
 */
export async function recordTransactionAction(
  input: TransactionToRecord,
): Promise<RecordTransactionActionResult> {
  const person = await requirePerson();

  if (!(await staffOnTrip(person, input.perjadinId))) return { outcome: "no-such-perjadin" };

  const { receipts, ...line } = input;
  if (receipts.length === 0) return { outcome: "evidence-missing" };
  if (receipts.length > MAX_RECEIPTS_PER_TRANSACTION) {
    return {
      outcome: "too-many-receipts",
      limit: MAX_RECEIPTS_PER_TRANSACTION,
      count: receipts.length,
    };
  }
  // Refused here as well as in `recordTransaction`, so a zero amount never leaves a folder behind.
  if (!(line.amountIdr > 0)) return { outcome: "amount-not-positive" };

  const access = await driveAccessToken(person);
  if (access.outcome !== "ok") return { outcome: access.outcome };
  const drive = openDrive(access.accessToken);
  const staging = access.folders.stagingFolderId;

  const transactionId = randomUUID();
  let evidence: (NewEvidence & VerifiedReceipt & { id: string })[];
  let driveFolderId: string;
  try {
    const checks = await Promise.all(
      receipts.map((receipt) =>
        verifyReceipt(drive, staging, input.perjadinId, receipt.driveFileId),
      ),
    );
    const unique = new Set(receipts.map((receipt) => receipt.driveFileId)).size;
    const unverified =
      checks.filter((check) => check === "unverified").length + (receipts.length - unique);
    if (unverified > 0) return { outcome: "receipt-unverified", failed: unverified };
    if (checks.includes("unsupported-type")) return { outcome: "unsupported-type" };
    evidence = (checks as VerifiedReceipt[]).map((receipt) => ({ ...receipt, id: randomUUID() }));

    const folderName = transactionFolderName(line.spentOn, line.category, transactionId);
    driveFolderId = (
      await drive.createFolder({
        name: folderName,
        parentId: staging,
        appProperties: { sugtPerjadinId: input.perjadinId, sugtTransactionId: transactionId },
      })
    ).id;
    await Promise.all(
      evidence.map((receipt) =>
        drive.updateFile(receipt.driveFileId, {
          name: evidenceFileName(
            line.spentOn,
            line.category,
            transactionId,
            receipt.id,
            receipt.contentType,
          ),
          addParent: driveFolderId,
          removeParent: staging,
          appProperties: { sugtTransactionId: transactionId },
        }),
      ),
    );
  } catch (error) {
    if (isDriveFailure(error)) return { outcome: "drive-unreachable" };
    throw error;
  }

  const result = await staffSurface(() =>
    recordTransaction(person, { ...line, transactionId, driveFolderId, evidence }),
  );
  if (result.outcome !== "recorded") return result;

  const reconciled = await reconcileTransaction(person, drive, access.folders, transactionId);
  revalidatePath(`/perjadin/${input.perjadinId}/laporan`);
  return { outcome: "recorded", transactionId, synced: reconciled.outcome === "synced" };
}

/**
 * Mint upload URLs for `count` receipts — never more than one line may carry
 * (`MAX_RECEIPTS_PER_TRANSACTION`), whichever path is asking.
 *
 * **Gated on Staff and on the Perjadin existing** (`staffOnTrip`), both before any URL is minted:
 * an upload URL is a write credential, so it is not handed out against a trip nobody can file for or
 * that is not there. Minting is a money WRITE with no query of its own to hold the guard, which is
 * why the explicit check has been load-bearing here since #180.
 *
 * **The row's own Unggah bukti still writes to Supabase** until #374 moves it to Drive, but it is
 * closed whenever Drive is (`receiptUploadGate`, ADR-0040): one rule for both receipt controls.
 */
export async function mintReceiptUploadsAction(
  perjadinId: string,
  count: number,
): Promise<MintReceiptUploadsResult> {
  const person = await requirePerson();

  if (!(await staffOnTrip(person, perjadinId))) {
    throw new Error(`No Perjadin ${perjadinId} to attach receipts to.`);
  }
  const gate = await receiptUploadGate(person);
  if (!gate.open) return { outcome: "uploads-closed", reason: gate.reason };

  const wanted = Math.min(Math.max(0, Math.trunc(count)), MAX_RECEIPTS_PER_TRANSACTION);
  const targets = await Promise.all(Array.from({ length: wanted }, () => mintReceiptUpload()));
  return { outcome: "minted", targets };
}

/**
 * Record the receipts whose bytes have landed, against a line that already exists — its row's own
 * "Unggah bukti".
 *
 * Each is read back from Storage (`readBack`), after the Staff check (`staffOnTrip`) — without that
 * order, a caller whose every read-back failed would return normally with no Staff check having run
 * at all. A receipt whose read-back fails is dropped and counted. Partial success is a real state
 * here and is reported rather than swallowed: the line already stands, so a receipt that did land is
 * worth keeping. (Recording a new line is the opposite — `recordTransactionAction` refuses on any
 * miss.) A batch larger than one line may carry is refused before the read-back, so the Storage calls
 * stay bounded; `attachTransactionEvidence` holds the real count, against what the line has already.
 *
 * The key is opaque, so unlike Cerita there is no prefix to check; `receipt-media.ts` explains why
 * that gives nothing up here. What is checked instead is the pair the boundary actually rests on —
 * the line item belongs to this Perjadin — and `attachTransactionEvidence` does it inside its own
 * transaction.
 */
export async function finalizeReceiptsAction(
  perjadinId: string,
  transactionId: string,
  landed: ReceiptToFinalize[],
): Promise<FinalizeReceiptsResult> {
  const person = await requirePerson();

  if (!(await staffOnTrip(person, perjadinId))) return { outcome: "no-such-perjadin" };
  const gate = await receiptUploadGate(person);
  if (!gate.open) return { outcome: "uploads-closed", reason: gate.reason };
  if (landed.length > MAX_RECEIPTS_PER_TRANSACTION) {
    return { outcome: "too-many-receipts", limit: MAX_RECEIPTS_PER_TRANSACTION };
  }

  const { ready, failed } = await readBack(landed);

  if (ready.length === 0) return { outcome: "attached", attached: 0, failed };

  // The write's own refusals are returned rather than discarded. `no-such-transaction` is a stale
  // screen and `too-many-receipts` a line that would pass five; both are reachable, and swallowing
  // either would tell the PIC that receipts attached when none did — the worst answer available on
  // a screen whose point is that evidence is attached to the line it belongs to.
  const result = await staffSurface(() =>
    attachTransactionEvidence(person, perjadinId, transactionId, ready),
  );
  if (result.outcome === "no-such-transaction") return result;
  if (result.outcome === "too-many-receipts")
    return { outcome: result.outcome, limit: result.limit };

  revalidatePath(`/perjadin/${perjadinId}/laporan`);
  return { outcome: "attached", attached: result.count, failed };
}

/**
 * File the Report.
 *
 * The evidence rule — every transaction carries at least one receipt — is held at entry since
 * ADR-0039, by `recordTransaction`. `filePerjadinReport` still checks it, as the backstop for lines
 * recorded before that rule, which no migration touched.
 */
export async function filePerjadinReportAction(
  perjadinId: string,
): Promise<FilePerjadinReportResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => filePerjadinReport(person, perjadinId));
  if (result.outcome === "filed") revalidatePath(`/perjadin/${perjadinId}/laporan`);
  return result;
}
