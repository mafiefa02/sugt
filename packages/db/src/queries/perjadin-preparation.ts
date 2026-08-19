import { and, eq, sql } from "drizzle-orm";

import { db } from "../client";
import { perjadinPreparationItem } from "../schema/travel";
import type { Person } from "./caller";
import { requireStaff } from "./staff-only";

/**
 * **Ticking and un-ticking one Preparation Checklist box** ([#114](https://github.com/mafiefa02/sugt/issues/114)).
 *
 * The checklist is an internal-monitoring aid — no money, no deadline, not a record — so a box is
 * hand-ticked and nothing ever ticks one automatically. The set of items is derived at read time
 * (`./preparation-checklist.ts`); this write stores only the ticks.
 *
 * **Any signed-in Staff may toggle any Perjadin's boxes.** It opens with the Staff-only choke
 * point because a Server Action is a public endpoint and a layout does not run before one — the
 * same reason every other write here does, though this one carries no money (convention 4:
 * arranging is Staff-only by the surface list). The guard is the only role check.
 */

/**
 * The box to flip. `checked: true` records the tick, `false` clears it. `itemKey` is a fixed key
 * or a `dosen:{personId}`; it is not validated against the current Group, because an orphan tick
 * is deliberately allowed to persist (ADR-0018).
 */
export type TogglePreparationItemInput = {
  perjadinId: string;
  itemKey: string;
  checked: boolean;
};

export type TogglePreparationItemResult = { outcome: "toggled" };

/**
 * Upsert on tick, delete on un-tick — **idempotent both ways**.
 *
 * One statement, no transaction: the composite primary key `(perjadin_id, item_key)` makes a
 * second tick an `onConflictDoUpdate` that rewrites `checked_by`/`checked_at` rather than a
 * duplicate row, and a second un-tick a delete that matches nothing. `checked_at` is `now()` on
 * both the insert and the conflict update — the column's `defaultNow()` only fires on insert, so
 * the update sets it explicitly, keeping the tick's time honest when a box is re-ticked.
 */
export async function togglePreparationItem(
  caller: Person,
  input: TogglePreparationItemInput,
): Promise<TogglePreparationItemResult> {
  requireStaff(caller);

  const { perjadinId, itemKey, checked } = input;

  if (checked) {
    await db
      .insert(perjadinPreparationItem)
      .values({ perjadinId, itemKey, checkedBy: caller.id })
      .onConflictDoUpdate({
        target: [perjadinPreparationItem.perjadinId, perjadinPreparationItem.itemKey],
        set: { checkedBy: caller.id, checkedAt: sql`now()` },
      });
  } else {
    await db
      .delete(perjadinPreparationItem)
      .where(
        and(
          eq(perjadinPreparationItem.perjadinId, perjadinId),
          eq(perjadinPreparationItem.itemKey, itemKey),
        ),
      );
  }

  return { outcome: "toggled" };
}
