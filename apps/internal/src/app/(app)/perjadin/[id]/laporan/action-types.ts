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
 * One file the Catat transaksi dialog is about to upload to Drive (ADR-0040): its size and type
 * **after** the browser compressed it. The server opens a session that declares exactly this size,
 * so Drive refuses anything longer, and re-checks both on the file Drive ends up holding.
 */
export type ReceiptToOpen = { size: number; contentType: string };

/** Why receipts cannot go to Drive right now. Each is a returned value with its own sentence. */
export type DriveRefusal =
  | { outcome: "drive-disconnected" }
  | { outcome: "drive-folders-unresolved" }
  | { outcome: "drive-unreachable" };

/** What `openReceiptSessionsAction` did: a session URI per file, in order, or why none. */
export type OpenReceiptSessionsResult =
  | { outcome: "ready"; sessionUris: string[] }
  | { outcome: "no-such-perjadin" }
  | { outcome: "evidence-missing" }
  | { outcome: "too-many-receipts"; limit: number; count: number }
  | { outcome: "too-large"; limit: number }
  | { outcome: "unsupported-type" }
  | DriveRefusal;

/**
 * What the Catat transaksi dialog sends once every receipt has landed in Drive: the line's fields,
 * and the Drive file id each upload came back with. The action verifies each file in Drive and hands
 * the line and its evidence to `recordTransaction` together (ADR-0039, ADR-0040).
 */
export type TransactionToRecord = Omit<
  NewTransaction,
  "evidence" | "transactionId" | "driveFolderId"
> & {
  receipts: { driveFileId: string }[];
};

/**
 * What `recordTransactionAction` did. The query's refusals, plus the ones only the action can see:
 * a receipt that is not what it claims (`receipt-unverified`: not this Perjadin's, not in `_staging`,
 * trashed, over the cap; `unsupported-type`: its first bytes are no PDF or image) and Drive itself
 * being unusable. **Every one of those records nothing.**
 *
 * `recorded` carries `synced`: false when the line and its receipts are written but the reconcile
 * could not finish putting them in place — never an error, since the line stands.
 */
export type RecordTransactionActionResult =
  | { outcome: "recorded"; transactionId: string; synced: boolean }
  | Exclude<RecordTransactionResult, { outcome: "recorded" }>
  | { outcome: "receipt-unverified"; failed: number }
  | { outcome: "unsupported-type" }
  | DriveRefusal;

/** The row's own Unggah bukti, refused because receipts cannot be uploaded right now (ADR-0040). */
export type UploadsClosed = { outcome: "uploads-closed"; reason: string };

/** What `mintReceiptUploadsAction` answers: an upload target per file, or why there are none. */
export type MintReceiptUploadsResult =
  | { outcome: "minted"; targets: { path: string; signedUrl: string }[] }
  | UploadsClosed;

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
  | { outcome: "too-many-receipts"; limit: number }
  | UploadsClosed;

/**
 * One receipt as the screen renders it: the row, minus where it is stored, plus the link that opens
 * it.
 *
 * - **A Drive receipt** (ADR-0040) links to Drive itself, in a new tab; the app renders nothing of
 *   the file. The link opens for anyone once its transaction folder is shared.
 * - **A legacy receipt** in the private Supabase bucket links through a short-lived signed URL
 *   minted on the page, and `url` is `null` when its object is gone. The `storagePath` is dropped
 *   on purpose — of no use to a browser, and the URL is what renders it.
 *
 * The acquittal is an open money read (ADR-0026, #180), so any signed-in Person who reads it gets
 * these links. Reading is open; the money *writes* on this surface stay Staff-only in their own
 * Server Actions.
 */
export type ViewableEvidence = Omit<
  AcquittalEvidence,
  "storagePath" | "driveFileId" | "uploadedAt"
> & {
  url: string | null;
};

/** One line item as the screen renders it, with its Drive folder as a link when it has one. */
export type ViewableTransaction = Omit<AcquittalTransaction, "evidence" | "driveFolderId"> & {
  evidence: ViewableEvidence[];
  folderUrl: string | null;
};
