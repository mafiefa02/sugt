import type { AcquittalTransaction } from "@sugt/db/queries";

/**
 * The shapes the Perjadin Report's Server Actions pass to and from the client. They live here
 * rather than in `actions.ts` because that file is `"use server"`: every one of its exports is a
 * callable Server Action, and a type is not one.
 */

/**
 * How many receipts one upload batch may stage and mint URLs for. Shared by the client (which caps
 * a file selection) and the mint action (which caps the array it hands out), so the two cannot
 * drift — a guard on the array size, not a product rule.
 */
export const MAX_RECEIPT_BATCH = 10;

/** One receipt the browser has PUT to Storage, waiting to be recorded as a `transaction_evidence` row. */
export type ReceiptToFinalize = {
  /** The opaque object key returned when its upload URL was minted. */
  path: string;
};

/**
 * What `finalizeReceiptsAction` recorded. `failed` is the count whose bytes never landed — a real
 * partial-success state, since the browser uploads several files independently and one PUT can fail
 * while the rest succeed. The successes are still attached; the failures are reported, not
 * discarded silently.
 */
export type FinalizeReceiptsResult = { attached: number; failed: number };

/**
 * One line item as the screen renders it: the row, plus a short-lived signed URL per receipt.
 *
 * The URL is minted server-side, after `perjadinAcquittal` has already refused a non-Staff caller.
 * The `receipts` bucket is private and Better Auth means storage policies cannot see who is asking,
 * so this signed link is the only way a receipt renders — and the Staff check that precedes it is
 * the only thing standing between Teaching Team and one.
 */
export type ViewableTransaction = Omit<AcquittalTransaction, "evidence"> & {
  evidence: { id: string; contentType: string; byteSize: number; url: string | null }[];
};
