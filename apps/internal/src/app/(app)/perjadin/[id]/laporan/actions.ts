"use server";

import { requirePerson, type Person } from "-/lib/person";
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
 * None opens a transaction. The boundary is the query layer's fifth convention and lives in
 * `@sugt/db`; `requireStaff` inside each query is what closes the path, since a layout does not run
 * before a Server Action. The three that touch Storage — minting, and the two that read receipts
 * back — also call it themselves, first, through `staffOnTrip`, because Storage is reached before
 * any query runs. Every refusal comes back as a value.
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
 * Record one line item against the Advance, **with the receipts the dialog has already uploaded**
 * (ADR-0039).
 *
 * The browser PUTs every staged file first and calls this only once all of them landed. Each is
 * then read back from Storage — the server never saw the bytes — and if **any** read-back fails,
 * nothing is recorded: a line is written with all its evidence or not at all, so a partial success
 * is refused rather than recorded short. The objects that did land stay in the bucket unreferenced,
 * the way ADR-0018 already leaves orphans; the keys are opaque and the bucket private.
 *
 * **The Staff check and the Perjadin read run before Storage is touched** (`staffOnTrip`). A batch
 * over `MAX_RECEIPTS_PER_TRANSACTION` is refused before the read-back too, so a caller cannot make
 * this read back an unbounded list; `recordTransaction` refuses the count again, and that is the
 * rule's real home — this early return only saves the Storage calls.
 */
export async function recordTransactionAction(
  input: TransactionToRecord,
): Promise<RecordTransactionActionResult> {
  const person = await requirePerson();

  if (!(await staffOnTrip(person, input.perjadinId))) return { outcome: "no-such-perjadin" };

  const { receipts, ...line } = input;
  if (receipts.length > MAX_RECEIPTS_PER_TRANSACTION) {
    return {
      outcome: "too-many-receipts",
      limit: MAX_RECEIPTS_PER_TRANSACTION,
      count: receipts.length,
    };
  }

  const { ready, failed } = await readBack(receipts);
  if (failed > 0) return { outcome: "receipts-not-landed", failed };

  const result = await staffSurface(() => recordTransaction(person, { ...line, evidence: ready }));
  if (result.outcome === "recorded") revalidatePath(`/perjadin/${input.perjadinId}/laporan`);
  return result;
}

/**
 * Mint upload URLs for `count` receipts — never more than one line may carry
 * (`MAX_RECEIPTS_PER_TRANSACTION`), whichever path is asking.
 *
 * **Gated on Staff and on the Perjadin existing** (`staffOnTrip`), both before any URL is minted:
 * an upload URL is a write credential, so it is not handed out against a trip nobody can file for or
 * that is not there. Minting is a money WRITE with no query of its own to hold the guard, which is
 * why the explicit check has been load-bearing here since #180.
 */
export async function mintReceiptUploadsAction(
  perjadinId: string,
  count: number,
): Promise<ReceiptUploadTarget[]> {
  const person = await requirePerson();

  if (!(await staffOnTrip(person, perjadinId))) {
    throw new Error(`No Perjadin ${perjadinId} to attach receipts to.`);
  }

  const wanted = Math.min(Math.max(0, Math.trunc(count)), MAX_RECEIPTS_PER_TRANSACTION);
  return Promise.all(Array.from({ length: wanted }, () => mintReceiptUpload()));
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
