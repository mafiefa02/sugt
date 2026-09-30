import type {
  AcquittalEvidence,
  AcquittalTransaction,
  NewTransaction,
  RecordTransactionResult,
} from "@sugt/db/queries";

/**
 * The shapes the Perjadin Report's Server Actions pass to and from the client. They live here
 * rather than in `actions.ts` because that file is `"use server"`: every one of its exports is a
 * callable Server Action, and a type is not one.
 */

/** One receipt the browser has PUT to Storage, waiting to be recorded as a `transaction_evidence` row. */
export type ReceiptToFinalize = {
  /** The opaque object key returned when its upload URL was minted. */
  path: string;
};

/**
 * What the Catat transaksi dialog sends once every staged receipt has landed: the line's fields,
 * and the object keys its receipts were PUT to. The action reads each one's facts back from Storage
 * and hands the line and its evidence to `recordTransaction` together (ADR-0039).
 */
export type TransactionToRecord = Omit<NewTransaction, "evidence"> & {
  receipts: ReceiptToFinalize[];
};

/**
 * What `recordTransactionAction` did. The query's own outcomes, plus the one only the action can
 * see: `failed` of the named receipts are not in Storage, so **nothing was recorded** — a line is
 * written with all its evidence or not at all.
 */
export type RecordTransactionActionResult =
  | RecordTransactionResult
  | { outcome: "receipts-not-landed"; failed: number };

/**
 * What `finalizeReceiptsAction` recorded.
 *
 * `failed` is the count whose bytes never landed — a real partial-success state, since the browser
 * uploads several files independently and one PUT can fail while the rest succeed. The successes
 * are still attached; the failures are reported, not discarded silently.
 *
 * The refusals are the query layer's own, passed through rather than swallowed. The two stale
 * screens are reachable, and so is a batch that would take the line past five receipts (ADR-0039)
 * — a second tab, or a line grandfathered with more — so all come back as values by the rule the
 * query layer settled.
 */
export type FinalizeReceiptsResult =
  | { outcome: "attached"; attached: number; failed: number }
  | { outcome: "no-such-transaction" }
  | { outcome: "no-such-perjadin" }
  /** The batch would take the line past `limit` receipts, or is larger than one line may carry. */
  | { outcome: "too-many-receipts"; limit: number };

/**
 * One receipt as the screen renders it: the row, minus the object key, plus a short-lived signed
 * URL that resolves it.
 *
 * **The `storagePath` is dropped on purpose.** The row's key is of no use to a browser — the bucket
 * is private — and the URL below is what renders it, so sending the key too would put it in the
 * page's serialised payload for nothing.
 *
 * The URL is minted server-side, on the Laporan page — an open money read now (ADR-0026, #180), so
 * any signed-in Person who reads the acquittal renders its receipts. Better Auth means storage
 * policies cannot see who is asking, so this signed link is the only way a receipt renders. Reading
 * is open; the money *writes* on this surface (attaching a receipt, filing) stay Staff-only in their
 * own Server Actions.
 */
export type ViewableEvidence = Omit<AcquittalEvidence, "storagePath" | "uploadedAt"> & {
  url: string | null;
};

/** One line item as the screen renders it. */
export type ViewableTransaction = Omit<AcquittalTransaction, "evidence"> & {
  evidence: ViewableEvidence[];
};
