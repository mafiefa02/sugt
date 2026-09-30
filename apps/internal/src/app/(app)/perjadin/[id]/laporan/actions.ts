"use server";

import { requirePerson } from "-/lib/person";
import { mintReceiptUpload, readReceiptFacts, type ReceiptUploadTarget } from "-/lib/receipt-media";
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
import { MAX_RECEIPTS_PER_TRANSACTION } from "@sugt/domain";
import { revalidatePath } from "next/cache";

import type {
  FinalizeReceiptsResult,
  ReceiptToFinalize,
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
 * None opens a transaction and none re-checks a role. The boundary is the query layer's fifth
 * convention and lives in `@sugt/db`; `requireStaff` inside each query is what actually closes the
 * path, since a layout does not run before a Server Action. Every refusal comes back as a value.
 */

/**
 * Record one line item against the Advance, **with the receipts the dialog has already uploaded**
 * (ADR-0039).
 *
 * The browser PUTs every staged file first and calls this only once all of them landed. Each is
 * then read back from Storage — the server never saw the bytes — and if **any** read-back fails,
 * nothing is recorded: a line is written with all its evidence or not at all, so a partial success
 * is refused rather than recorded short. The objects that did land stay in the bucket unreferenced,
 * the way ADR-0018 already leaves orphans; the keys are opaque and the bucket private.
 *
 * **The Staff check and the Perjadin read run before Storage is touched**, for the reason
 * `finalizeReceiptsAction` gives below: the read-back uses the service-role key. A batch over
 * `MAX_RECEIPTS_PER_TRANSACTION` is refused before the read-back too, so a caller cannot make this
 * read back an unbounded list; `recordTransaction` refuses the count again, and that is the rule's
 * real home — this early return only saves the Storage calls.
 */
export async function recordTransactionAction(
  input: TransactionToRecord,
): Promise<RecordTransactionActionResult> {
  const person = await requirePerson();

  const acquittal = await staffSurface(() => {
    requireStaff(person);
    return perjadinAcquittal(person, input.perjadinId);
  });
  if (!acquittal) return { outcome: "no-such-perjadin" };

  const { receipts, ...line } = input;
  if (receipts.length > MAX_RECEIPTS_PER_TRANSACTION) {
    return {
      outcome: "too-many-receipts",
      limit: MAX_RECEIPTS_PER_TRANSACTION,
      count: receipts.length,
    };
  }

  const facts = await Promise.all(
    receipts.map(async (item): Promise<NewEvidence | null> => {
      const read = await readReceiptFacts(item.path);
      if (!read) return null;
      return { storagePath: item.path, contentType: read.contentType, byteSize: read.byteSize };
    }),
  );
  const evidence = facts.filter((file): file is NewEvidence => file !== null);
  if (evidence.length < receipts.length) {
    return { outcome: "receipts-not-landed", failed: receipts.length - evidence.length };
  }

  const result = await staffSurface(() => recordTransaction(person, { ...line, evidence }));
  if (result.outcome === "recorded") revalidatePath(`/perjadin/${input.perjadinId}/laporan`);
  return result;
}

/**
 * Mint upload URLs for `count` receipts — never more than one line may carry
 * (`MAX_RECEIPTS_PER_TRANSACTION`), whichever path is asking.
 *
 * **Gated on Staff and on the Perjadin existing**, by an explicit `requireStaff` ahead of a read,
 * both before any URL is minted: an upload URL is a write credential for the private `receipts`
 * bucket, so it is not handed out against a trip nobody can file for or that is not there.
 *
 * The `requireStaff` is load-bearing here in a way it was not before #180. Minting is a money WRITE
 * and has no guard of its own; it used to lean on `perjadinAcquittal`'s `requireStaff`, but that
 * read is open to any signed-in Person now (money reads are open — ADR-0026), so opening it would
 * have handed a Pimpinan an upload credential. The explicit check refuses a non-Staff caller before
 * a URL is minted.
 */
export async function mintReceiptUploadsAction(
  perjadinId: string,
  count: number,
): Promise<ReceiptUploadTarget[]> {
  const person = await requirePerson();

  const acquittal = await staffSurface(() => {
    requireStaff(person);
    return perjadinAcquittal(person, perjadinId);
  });
  if (!acquittal) throw new Error(`No Perjadin ${perjadinId} to attach receipts to.`);

  const wanted = Math.min(Math.max(0, Math.trunc(count)), MAX_RECEIPTS_PER_TRANSACTION);
  return Promise.all(Array.from({ length: wanted }, () => mintReceiptUpload()));
}

/**
 * Record the receipts whose bytes have landed, against a line that already exists — its row's own
 * "Unggah bukti".
 *
 * For each, the real content type and size are read back from Storage — the server never saw the
 * bytes — and one whose read-back fails is a PUT that never landed: it is dropped and counted, not
 * written with guessed columns. Partial success is a real state here and is reported rather than
 * swallowed: the line already stands, so a receipt that did land is worth keeping. (Recording a new
 * line is the opposite — `recordTransactionAction` refuses on any miss.)
 *
 * **The Staff check runs before Storage is touched, and that order is load-bearing.** The read-back
 * uses the service-role key, which bypasses every policy on a private bucket, so doing it first
 * would tell a non-Staff caller whether an object exists and how big it is — and, when every
 * read-back failed, would return normally without any Staff check having run at all. The guard is
 * therefore an explicit `requireStaff` plus a read of the Perjadin, ahead of `readReceiptFacts`,
 * exactly as the mint above does it. The `requireStaff` is what closes this now: `perjadinAcquittal`
 * is an open money read since #180 (ADR-0026), so the read alone no longer refuses a Pimpinan.
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

  const acquittal = await staffSurface(() => {
    requireStaff(person);
    return perjadinAcquittal(person, perjadinId);
  });
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

  // The write's own refusals are returned rather than discarded. `no-such-transaction` is a stale
  // screen and `too-many-receipts` a line that would pass five; both are reachable, and swallowing
  // either would tell the PIC that receipts attached when none did — the worst answer available on
  // a screen whose point is that evidence is attached to the line it belongs to.
  const result = await staffSurface(() =>
    attachTransactionEvidence(person, perjadinId, transactionId, ready),
  );
  if (result.outcome !== "attached") return result;

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
