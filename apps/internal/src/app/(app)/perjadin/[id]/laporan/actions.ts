"use server";

import { requirePerson } from "-/lib/person";
import { mintReceiptUpload, readReceiptFacts, type ReceiptUploadTarget } from "-/lib/receipt-media";
import { staffSurface } from "-/lib/staff-surface";
import {
  attachTransactionEvidence,
  filePerjadinReport,
  markReceiptsSettled,
  perjadinAcquittal,
  recordTransaction,
  type FilePerjadinReportResult,
  type MarkReceiptsSettledResult,
  type NewEvidence,
  type NewTransaction,
  type RecordTransactionResult,
} from "@sugt/db/queries";
import { revalidatePath } from "next/cache";

import {
  MAX_RECEIPT_BATCH,
  type FinalizeReceiptsResult,
  type ReceiptToFinalize,
} from "./action-types";

/**
 * **The Perjadin Report's writes.**
 *
 * Each lives beside the page that offers it, which keeps `revalidatePath` honest — every one of
 * them rewrites the payload of the screen the user is looking at, so every one revalidates that
 * screen and nothing else.
 *
 * None opens a transaction and none re-checks a role. The boundary is the query layer's fifth
 * convention and lives in `@sugt/db`; `requireStaff` inside each query is what actually closes the
 * path, since a layout does not run before a Server Action. Every refusal comes back as a value.
 */

/** Record one line item against the Advance. */
export async function recordTransactionAction(
  input: NewTransaction,
): Promise<RecordTransactionResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => recordTransaction(person, input));
  if (result.outcome === "recorded") revalidatePath(`/perjadin/${input.perjadinId}/laporan`);
  return result;
}

/**
 * Mint upload URLs for `count` receipts.
 *
 * **Gated on Staff and on the Perjadin existing**, by a Staff-checked read before any URL is
 * minted: an upload URL is a write credential for the private `receipts` bucket, so it is not
 * handed out against a trip nobody can file for or that is not there.
 */
export async function mintReceiptUploadsAction(
  perjadinId: string,
  count: number,
): Promise<ReceiptUploadTarget[]> {
  const person = await requirePerson();

  const acquittal = await staffSurface(() => perjadinAcquittal(person, perjadinId));
  if (!acquittal) throw new Error(`No Perjadin ${perjadinId} to attach receipts to.`);

  const wanted = Math.min(Math.max(0, Math.trunc(count)), MAX_RECEIPT_BATCH);
  return Promise.all(Array.from({ length: wanted }, () => mintReceiptUpload()));
}

/**
 * Record the receipts whose bytes have landed.
 *
 * For each, the real content type and size are read back from Storage — the server never saw the
 * bytes — and one whose read-back fails is a PUT that never landed: it is dropped and counted, not
 * written with guessed columns. Partial success is a real state and is reported rather than
 * swallowed.
 *
 * **The Staff check runs before Storage is touched, and that order is load-bearing.** The read-back
 * uses the service-role key, which bypasses every policy on a private bucket, so doing it first
 * would tell a Teaching Team caller whether an object exists and how big it is — and, when every
 * read-back failed, would return normally without `requireStaff` having run at all. The guard is
 * therefore a Staff-checked read of the Perjadin, ahead of the loop, exactly as the mint above does
 * it.
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

  const acquittal = await staffSurface(() => perjadinAcquittal(person, perjadinId));
  if (!acquittal) return { outcome: "no-such-perjadin" };

  const facts = await Promise.all(
    landed.map(async (item): Promise<NewEvidence | null> => {
      const read = await readReceiptFacts(item.path);
      if (!read) return null;
      return { storagePath: item.path, contentType: read.contentType, byteSize: read.byteSize };
    }),
  );
  const ready = facts.filter((file): file is NewEvidence => file !== null);
  const failed = landed.length - ready.length;

  if (ready.length === 0) return { outcome: "attached", attached: 0, failed };

  // The write's own refusal is returned rather than discarded. `no-such-transaction` is a stale
  // screen and therefore reachable, and swallowing it would tell the PIC that receipts attached
  // when none did — the worst answer available on a screen whose point is that evidence is
  // attached to the line it belongs to.
  const result = await staffSurface(() =>
    attachTransactionEvidence(person, perjadinId, transactionId, ready),
  );
  if (result.outcome === "no-such-transaction") return result;

  revalidatePath(`/perjadin/${perjadinId}/laporan`);
  return { outcome: "attached", attached: result.count, failed };
}

/** Tick or untick one Group member on the receipts checklist. */
export async function markReceiptsSettledAction(
  perjadinId: string,
  personId: string,
  settled: boolean,
): Promise<MarkReceiptsSettledResult> {
  const person = await requirePerson();

  const result = await staffSurface(() =>
    markReceiptsSettled(person, perjadinId, personId, settled),
  );
  if (result.outcome === "marked") revalidatePath(`/perjadin/${perjadinId}/laporan`);
  return result;
}

/**
 * File the Report.
 *
 * The evidence rule — every transaction carries at least one receipt — is checked inside
 * `filePerjadinReport` and nowhere else, because a receipt may be attached later and checking it
 * when a transaction is entered would refuse a PIC logging a fare on the pavement.
 */
export async function filePerjadinReportAction(
  perjadinId: string,
): Promise<FilePerjadinReportResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => filePerjadinReport(person, perjadinId));
  if (result.outcome === "filed") revalidatePath(`/perjadin/${perjadinId}/laporan`);
  return result;
}
