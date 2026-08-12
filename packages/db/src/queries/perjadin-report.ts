import { REPORT_DEADLINE_DAYS_AFTER_RETURN } from "@sugt/domain";
import { eq, sql } from "drizzle-orm";

import { db } from "../client";
import { perjadin, transaction } from "../schema/travel";
import type { Person } from "./caller";
import { requireStaff } from "./staff-only";

/**
 * **Perjadin Report** — the acquittal of one Perjadin. Staff-only, and the first
 * query behind the choke point.
 *
 * There is no `perjadin_report` table: a Perjadin yields exactly one Report, always,
 * so the acquittal is the state already on `perjadin` plus a sum over `transaction`.
 *
 * **This module is deliberately partial, and [#30](https://github.com/mafiefa02/sugt/issues/30)
 * owns the surface.** What is here is the reconciliation and nothing else — the
 * transaction list, its evidence and the generic export are that ticket's, and it
 * should reshape this payload rather than add a second function beside it. It exists
 * now because [#25](https://github.com/mafiefa02/sugt/issues/25) requires the
 * Staff-only choke point to throw and requires a test that drives a Teaching Team
 * `Person` into a money query — and a choke point with nothing behind it is a helper
 * rather than a choke point.
 */

/**
 * The reconciliation, **derived and never stored**: `advance_idr - sum(amount_idr)`
 * is the running remainder the acquittal screen shows. Only the fact that money was
 * returned is a stored event.
 */
export type PerjadinAcquittal = {
  perjadinId: string;
  destination: string;
  /** Fixed at planning and transferred before departure, so never null and never absent. */
  advanceIdr: number;
  /** The sum of every transaction against the Advance. Zero when none has been entered. */
  spentIdr: number;
  /** What is left of the Advance to hand back. Negative means the Group overspent. */
  remainderIdr: number;
  /**
   * **Derived, never stored.** Two days after the Group gets back, so it cannot be typed
   * wrong and it moves by itself if the trip's dates are corrected. Nothing is gated on it.
   *
   * It sits on this payload rather than on `perjadinDetail` because the Perjadin Report is
   * the acquittal state on this row, and the acquittal is Staff-only.
   */
  reportDueOn: string;
  returnedToTreasurerIdr: number | null;
  returnedAt: Date | null;
  reportFiledAt: Date | null;
};

/**
 * One Perjadin's acquittal figures.
 *
 * Opens with the choke point, which throws `NotStaffError` on a Teaching Team
 * `Person` — **not** an empty result, because an empty return would make a
 * mis-passed caller indistinguishable from a Perjadin that has spent nothing yet.
 *
 * Returns `null` when there is no such Perjadin. That is a genuinely reachable state
 * — a stale link to a deleted Perjadin — and is distinct from the refusal above, which
 * is not.
 */
export async function perjadinAcquittal(
  caller: Person,
  perjadinId: string,
): Promise<PerjadinAcquittal | null> {
  requireStaff(caller);

  const [row] = await db
    .select({
      perjadinId: perjadin.id,
      destination: perjadin.destination,
      advanceIdr: perjadin.advanceIdr,
      // Computed in Postgres rather than in JavaScript, so the arithmetic happens in the
      // same calendar the dates are stored in. A `Date` here would introduce a time zone the
      // domain does not have — a Session is a calendar day, and so is a deadline.
      reportDueOn: sql<string>`to_char(
        ${perjadin.endsOn} + ${sql.raw(String(REPORT_DEADLINE_DAYS_AFTER_RETURN))}, 'YYYY-MM-DD'
      )`,
      // `coalesce` because the left join finds nothing at all on a Perjadin with no
      // transactions, and "spent nothing" is 0 rather than unknown.
      spentIdr: sql<number>`coalesce(sum(${transaction.amountIdr}), 0)`.mapWith(Number),
      returnedToTreasurerIdr: perjadin.returnedToTreasurerIdr,
      returnedAt: perjadin.returnedAt,
      reportFiledAt: perjadin.reportFiledAt,
    })
    .from(perjadin)
    .leftJoin(transaction, eq(transaction.perjadinId, perjadin.id))
    .where(eq(perjadin.id, perjadinId))
    .groupBy(perjadin.id);

  if (!row) return null;

  return { ...row, remainderIdr: row.advanceIdr - row.spentIdr };
}
