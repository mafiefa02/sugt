import {
  REPORT_DEADLINE_DAYS_AFTER_RETURN,
  type Role,
  type TransactionCategory,
} from "@sugt/domain";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "../client";
import { person } from "../schema/people";
import { groupMember, perjadin, transaction, transactionEvidence } from "../schema/travel";
import type { Person } from "./caller";
import { requireStaff } from "./staff-only";

/**
 * **Perjadin Report** — the acquittal of one Perjadin. Staff-only, at every level, and the
 * one surface the choke point exists for (ADR-0004).
 *
 * There is no `perjadin_report` table: a Perjadin yields exactly one Report, always, so the
 * acquittal is the state already on `perjadin`, plus its line items and their evidence.
 *
 * **Three things on this payload are derived and never stored** — the remainder, the report
 * deadline and the days left against it. Each follows from something already on the row, so
 * none can be typed wrong and each moves by itself when the trip's dates are corrected.
 * Nothing is gated on the deadline: DITSAMA sets it for itself, and the tool is never
 * stricter than the process it serves.
 */

/**
 * One uploaded receipt. `storagePath` is an opaque key in the private `receipts` bucket —
 * the app mints a signed URL for it after checking the caller is Staff, so the path travels
 * to the browser but never resolves without that step.
 */
export type AcquittalEvidence = {
  id: string;
  storagePath: string;
  contentType: string;
  byteSize: number;
  uploadedAt: Date;
};

/**
 * One line item against the Advance.
 *
 * `incurredBy` is null on most of them and that absence is not a gap: per-diems and
 * honoraria carry a person, a taxi and a box of ATK do not. The Advance is still one pot
 * either way.
 */
export type AcquittalTransaction = {
  id: string;
  spentOn: string;
  description: string;
  amountIdr: number;
  category: TransactionCategory;
  incurredBy: { personId: string; fullName: string } | null;
  evidence: AcquittalEvidence[];
};

/**
 * One Group member on the PIC's receipts checklist.
 *
 * `settledAt` is an **explicit mark and never derived**, because a member with no
 * transactions is genuinely ambiguous between *spent nothing* and *has not handed anything
 * over yet*. Counting their transactions would answer the wrong question confidently.
 */
export type AcquittalReceipt = {
  personId: string;
  fullName: string;
  role: Role;
  settledAt: Date | null;
};

/**
 * The whole acquittal screen in one round trip, per the query layer's third convention.
 *
 * `/perjadin/[id]` renders the four figures off the top of this and links onward; the
 * Report screen renders the rest. Both are the same Staff-only payload because the Report
 * *is* the acquittal state on that row — a second, thinner money query would be a second
 * place for the choke point to be forgotten.
 */
export type PerjadinAcquittal = {
  perjadinId: string;
  destination: string;
  startsOn: string;
  endsOn: string;
  /** Fixed at planning and transferred before departure, so never null and never absent. */
  advanceIdr: number;
  /** The sum of every transaction against the Advance. Zero when none has been entered. */
  spentIdr: number;
  /** What is left of the Advance to hand back. Negative means the Group overspent. */
  remainderIdr: number;
  /**
   * **Derived, never stored.** Two days after the Group gets back, so it cannot be typed
   * wrong and it moves by itself if the trip's dates are corrected.
   */
  reportDueOn: string;
  /**
   * Days left against that deadline, negative once it has passed. Computed in Postgres
   * against `current_date` for the same reason `reportDueOn` is: a `Date` here would
   * introduce a time zone the domain does not have.
   */
  daysRemaining: number;
  transactions: AcquittalTransaction[];
  receipts: AcquittalReceipt[];
  returnedToTreasurerIdr: number | null;
  returnedAt: Date | null;
  reportFiledAt: Date | null;
};

/**
 * One Perjadin's acquittal.
 *
 * Opens with the choke point, which throws `NotStaffError` on a Teaching Team `Person` —
 * **not** an empty result, because an empty return would make a mis-passed caller
 * indistinguishable from a Perjadin that has spent nothing yet.
 *
 * Returns `null` when there is no such Perjadin. That is a genuinely reachable state — a
 * stale link to a deleted Perjadin — and is distinct from the refusal above, which is not.
 */
export async function perjadinAcquittal(
  caller: Person,
  perjadinId: string,
): Promise<PerjadinAcquittal | null> {
  requireStaff(caller);

  const [trip] = await db
    .select({
      perjadinId: perjadin.id,
      destination: perjadin.destination,
      startsOn: perjadin.startsOn,
      endsOn: perjadin.endsOn,
      advanceIdr: perjadin.advanceIdr,
      // Computed in Postgres rather than in JavaScript, so the arithmetic happens in the
      // same calendar the dates are stored in. A `Date` here would introduce a time zone the
      // domain does not have — a Session is a calendar day, and so is a deadline.
      reportDueOn: sql<string>`to_char(
        ${perjadin.endsOn} + ${sql.raw(String(REPORT_DEADLINE_DAYS_AFTER_RETURN))}, 'YYYY-MM-DD'
      )`,
      daysRemaining: sql<number>`(
        ${perjadin.endsOn} + ${sql.raw(String(REPORT_DEADLINE_DAYS_AFTER_RETURN))} - current_date
      )`.mapWith(Number),
      returnedToTreasurerIdr: perjadin.returnedToTreasurerIdr,
      returnedAt: perjadin.returnedAt,
      reportFiledAt: perjadin.reportFiledAt,
    })
    .from(perjadin)
    .where(eq(perjadin.id, perjadinId));

  if (!trip) return null;

  const [transactions, receipts] = await Promise.all([
    transactionsOf(perjadinId),
    receiptsOf(perjadinId),
  ]);

  // Summed here rather than in a second `sum()` round trip: every row is already loaded, and
  // two sources for one figure is a way for the screen's total to disagree with its own list.
  const spentIdr = transactions.reduce((total, line) => total + line.amountIdr, 0);

  return {
    ...trip,
    spentIdr,
    remainderIdr: trip.advanceIdr - spentIdr,
    transactions,
    receipts,
  };
}

/**
 * The line items with their evidence, oldest spend first.
 *
 * Two selects rather than one aggregate join: a `join` onto evidence multiplies the money
 * rows, and summing a multiplied `amount_idr` is exactly the reconciliation bug this screen
 * exists to prevent.
 */
async function transactionsOf(perjadinId: string): Promise<AcquittalTransaction[]> {
  const lines = await db
    .select({
      id: transaction.id,
      spentOn: transaction.spentOn,
      description: transaction.description,
      amountIdr: transaction.amountIdr,
      category: transaction.category,
      incurredByPersonId: transaction.incurredByPersonId,
      incurredByFullName: person.fullName,
    })
    .from(transaction)
    .leftJoin(person, eq(person.id, transaction.incurredByPersonId))
    .where(eq(transaction.perjadinId, perjadinId))
    .orderBy(asc(transaction.spentOn), asc(transaction.createdAt));

  if (lines.length === 0) return [];

  const evidence = await db
    .select({
      id: transactionEvidence.id,
      transactionId: transactionEvidence.transactionId,
      storagePath: transactionEvidence.storagePath,
      contentType: transactionEvidence.contentType,
      byteSize: transactionEvidence.byteSize,
      uploadedAt: transactionEvidence.uploadedAt,
    })
    .from(transactionEvidence)
    .where(
      inArray(
        transactionEvidence.transactionId,
        lines.map((line) => line.id),
      ),
    )
    .orderBy(asc(transactionEvidence.uploadedAt));

  const byTransaction = new Map<string, AcquittalEvidence[]>();
  for (const { transactionId, ...file } of evidence) {
    const bucket = byTransaction.get(transactionId);
    if (bucket) bucket.push(file);
    else byTransaction.set(transactionId, [file]);
  }

  return lines.map(({ incurredByPersonId, incurredByFullName, ...line }) => ({
    ...line,
    // Both come off the same left join, so they are set together or not at all. The
    // condition names the id because that is the column that decides it.
    incurredBy:
      incurredByPersonId && incurredByFullName
        ? { personId: incurredByPersonId, fullName: incurredByFullName }
        : null,
    evidence: byTransaction.get(line.id) ?? [],
  }));
}

/** The checklist: every Group member, whether or not they have handed anything over. */
async function receiptsOf(perjadinId: string): Promise<AcquittalReceipt[]> {
  return db
    .select({
      personId: groupMember.personId,
      fullName: person.fullName,
      role: groupMember.role,
      settledAt: groupMember.receiptsSettledAt,
    })
    .from(groupMember)
    .innerJoin(person, eq(person.id, groupMember.personId))
    .where(eq(groupMember.perjadinId, perjadinId))
    .orderBy(asc(person.fullName));
}

/** What the acquittal form collects for one line item. */
export type NewTransaction = {
  perjadinId: string;
  spentOn: string;
  description: string;
  amountIdr: number;
  category: TransactionCategory;
  /** Null for anything the Advance paid for without paying a particular person. */
  incurredByPersonId: string | null;
};

export type RecordTransactionResult =
  | { outcome: "recorded"; transactionId: string }
  /** The id names no Perjadin — a stale link, which is reachable. */
  | { outcome: "no-such-perjadin" }
  /** A zero or negative line item. `transaction_amount_check` refuses it too. */
  | { outcome: "amount-not-positive" }
  /** Somebody who did not travel cannot have incurred a cost on this trip. */
  | { outcome: "incurred-by-not-in-group" };

/**
 * Record one line item against the Advance.
 *
 * Every refusal here is something a PIC can type honestly, so each comes back as a value and
 * earns a field-level message rather than an error page. `NotStaffError` is the opposite
 * case and still throws.
 *
 * **`incurredByPersonId` is checked against the Group, not just against `person`.** The
 * foreign key only says the person exists; the rule this screen needs is that they were on
 * the trip, which no constraint expresses because `transaction` carries no Group edge. It is
 * checked inside the write's own transaction so a Group replaced concurrently cannot slip a
 * departed member through between the check and the insert.
 */
export async function recordTransaction(
  caller: Person,
  input: NewTransaction,
): Promise<RecordTransactionResult> {
  requireStaff(caller);

  if (input.amountIdr <= 0) return { outcome: "amount-not-positive" };

  return db.transaction(async (tx) => {
    const [trip] = await tx
      .select({ id: perjadin.id })
      .from(perjadin)
      .where(eq(perjadin.id, input.perjadinId));
    if (!trip) return { outcome: "no-such-perjadin" };

    if (input.incurredByPersonId !== null) {
      const [member] = await tx
        .select({ personId: groupMember.personId })
        .from(groupMember)
        .where(
          and(
            eq(groupMember.perjadinId, input.perjadinId),
            eq(groupMember.personId, input.incurredByPersonId),
          ),
        );
      if (!member) return { outcome: "incurred-by-not-in-group" };
    }

    const [line] = await tx
      .insert(transaction)
      .values({
        perjadinId: input.perjadinId,
        spentOn: input.spentOn,
        description: input.description,
        amountIdr: input.amountIdr,
        category: input.category,
        incurredByPersonId: input.incurredByPersonId,
        createdByPersonId: caller.id,
      })
      .returning({ id: transaction.id });

    return { outcome: "recorded", transactionId: line!.id };
  });
}

/**
 * A receipt whose bytes have already landed in the `receipts` bucket. The content type and
 * size are read back from Storage by the app rather than taken from the browser, which never
 * had to tell the truth about either.
 */
export type NewEvidence = {
  storagePath: string;
  contentType: string;
  byteSize: number;
};

export type AttachEvidenceResult =
  | { outcome: "attached"; count: number }
  /** The id names no transaction on this Perjadin — a stale screen, which is reachable. */
  | { outcome: "no-such-transaction" };

/**
 * Attach receipts to one line item. Bulk or single — the same insert.
 *
 * The transaction is named **with its Perjadin**, so a caller cannot hang a receipt off a
 * line item belonging to a different trip. A Server Action is a public endpoint, so the pair
 * is checked here rather than assumed from whatever screen sent it.
 */
export async function attachTransactionEvidence(
  caller: Person,
  perjadinId: string,
  transactionId: string,
  evidence: NewEvidence[],
): Promise<AttachEvidenceResult> {
  requireStaff(caller);

  return db.transaction(async (tx) => {
    const [line] = await tx
      .select({ id: transaction.id })
      .from(transaction)
      .where(and(eq(transaction.id, transactionId), eq(transaction.perjadinId, perjadinId)));
    if (!line) return { outcome: "no-such-transaction" };

    if (evidence.length === 0) return { outcome: "attached", count: 0 };

    await tx.insert(transactionEvidence).values(
      evidence.map((file) => ({
        transactionId,
        storagePath: file.storagePath,
        contentType: file.contentType,
        byteSize: file.byteSize,
        uploadedByPersonId: caller.id,
      })),
    );

    return { outcome: "attached", count: evidence.length };
  });
}

export type MarkReceiptsSettledResult =
  | { outcome: "marked"; settledAt: Date | null }
  /** The person is not on this Perjadin's Group — a stale screen after a substitution. */
  | { outcome: "no-such-member" };

/**
 * Tick or untick one Group member on the receipts checklist.
 *
 * The mark is a timestamp rather than a boolean because *when* the PIC accepted somebody's
 * receipts is the useful half; unticking clears it rather than storing a second event, since
 * an undone tick is a correction and not a thing that happened.
 */
export async function markReceiptsSettled(
  caller: Person,
  perjadinId: string,
  personId: string,
  settled: boolean,
): Promise<MarkReceiptsSettledResult> {
  requireStaff(caller);

  const [member] = await db
    .update(groupMember)
    .set({ receiptsSettledAt: settled ? new Date() : null })
    .where(and(eq(groupMember.perjadinId, perjadinId), eq(groupMember.personId, personId)))
    .returning({ settledAt: groupMember.receiptsSettledAt });

  if (!member) return { outcome: "no-such-member" };
  return { outcome: "marked", settledAt: member.settledAt };
}

export type FilePerjadinReportResult =
  | { outcome: "filed"; filedAt: Date }
  | { outcome: "no-such-perjadin" }
  /** Filed already. Re-filing would move the timestamp and lose when it actually happened. */
  | { outcome: "already-filed"; filedAt: Date }
  /**
   * At least one line item has no receipt against it. The ids come back so the screen can
   * point at the rows rather than say "something is missing".
   */
  | { outcome: "evidence-missing"; transactionIds: string[] };

/**
 * File the Report.
 *
 * **"Every transaction has at least one piece of evidence" is checked here and nowhere
 * else** — a cross-row count no CHECK can express, and one that must not run when a
 * transaction is entered: `product.md` is explicit that a receipt may be attached later, and
 * a PIC logging a taxi fare on the pavement has not photographed the receipt yet.
 *
 * A Perjadin with no transactions at all files cleanly. A trip that spent nothing is a real
 * trip, and the vacuous truth is the right answer rather than an edge case to refuse.
 *
 * Nothing else is gated. The deadline is not checked, because DITSAMA sets it for itself and
 * the tool is never stricter than the process it serves.
 */
export async function filePerjadinReport(
  caller: Person,
  perjadinId: string,
): Promise<FilePerjadinReportResult> {
  requireStaff(caller);

  return db.transaction(async (tx) => {
    const [trip] = await tx
      .select({ reportFiledAt: perjadin.reportFiledAt })
      .from(perjadin)
      .where(eq(perjadin.id, perjadinId))
      .for("update");
    if (!trip) return { outcome: "no-such-perjadin" };
    if (trip.reportFiledAt) return { outcome: "already-filed", filedAt: trip.reportFiledAt };

    const unevidenced = await tx
      .select({ id: transaction.id })
      .from(transaction)
      .leftJoin(transactionEvidence, eq(transactionEvidence.transactionId, transaction.id))
      .where(and(eq(transaction.perjadinId, perjadinId), sql`${transactionEvidence.id} is null`))
      .orderBy(asc(transaction.spentOn));

    if (unevidenced.length > 0) {
      return { outcome: "evidence-missing", transactionIds: unevidenced.map((line) => line.id) };
    }

    const filedAt = new Date();
    await tx.update(perjadin).set({ reportFiledAt: filedAt }).where(eq(perjadin.id, perjadinId));

    return { outcome: "filed", filedAt };
  });
}
