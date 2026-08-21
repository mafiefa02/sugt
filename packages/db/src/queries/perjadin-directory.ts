import { desc, eq, sql } from "drizzle-orm";

import { db } from "../client";
import { session } from "../schema/delivery";
import { person } from "../schema/people";
import { perjadin, perjadinPreparationItem } from "../schema/travel";
import type { Person } from "./caller";
import { PREPARATION_FIXED_KEYS } from "./preparation-checklist";

/**
 * **The Perjadin list** — every trip, open to anyone signed in.
 *
 * A separate module from the detail, the way `./school-directory.ts` is separate from
 * `./school-detail.ts`: convention 3 is one module per surface's payload, and a list and a
 * detail are two surfaces that happen to be about the same noun.
 *
 * No money here and no role check, for the reason `./perjadin-detail.ts` gives at length:
 * the Advance is `./perjadin-report.ts`'s, behind the Staff-only choke point.
 */

/** One trip, as the list shows it. */
export type DirectoryPerjadin = {
  id: string;
  destination: string;
  startsOn: string;
  endsOn: string;
  /** How many Schools the Group teaches at. The trip's size, in the only unit that matters. */
  schoolCount: number;
  picFullName: string;
  /**
   * The Preparation Checklist pill's `x` and `N` ([#114](https://github.com/mafiefa02/sugt/issues/114)).
   * `preparationTotal` is the constant **7** — the flat fixed item set (amendment to ADR-0018), with
   * no per-member derivation; `preparationDone` counts the present ticks whose key is one of the
   * seven fixed items. An orphan `dosen:` tick from the old model matches none, so the pill never
   * reads past `N`.
   */
  preparationDone: number;
  preparationTotal: number;
};

/**
 * Every Perjadin, newest trip first.
 *
 * Ordered by `starts_on` rather than by `created_at`: a trip is remembered by when it
 * happens, and the two differ whenever a trip is planned out of order. `id` breaks the tie
 * so the order is total.
 */
export async function perjadinDirectory(_caller: Person): Promise<DirectoryPerjadin[]> {
  return db
    .select({
      id: perjadin.id,
      destination: perjadin.destination,
      startsOn: perjadin.startsOn,
      endsOn: perjadin.endsOn,
      picFullName: person.fullName,
      // **`distinct`, and on the School rather than the Session.** Cancelled Sessions count
      // here, unlike everywhere else — this is how big the trip is, not how much teaching it
      // delivered — and both partial unique indexes are predicated on `status <> 'cancelled'`
      // precisely so a cancelled Session and the one that replaced it coexist on one trip.
      // Counting Sessions would report a two-School trip as three the first time that happens.
      schoolCount: sql<number>`count(distinct ${session.schoolId})`.mapWith(Number),
      // **The pill's `x`, as one correlated scalar subquery** — the style `./dashboard.ts` uses for
      // its PIC-report counts: interpolate the table ref (`${perjadinPreparationItem}`) so a rename
      // propagates, correlate on the outer `${perjadin.id}` (a grouping column here), and keep it off
      // the `session` left join above so it never fans out. Since the amendment to ADR-0018 the
      // checklist is a flat fixed seven — no per-member derivation — so `N` is the constant 7 and `x`
      // counts the ticks whose key is one of the seven fixed items. A `dosen:` tick the old model left
      // behind matches none of them, so it never counts and `x` never exceeds `N`. The fixed keys are
      // bound from the one list so they cannot drift from the strings the rows hold.
      preparationTotal: sql<number>`${PREPARATION_FIXED_KEYS.length}`.mapWith(Number),
      preparationDone: sql<number>`(
        select count(*) from ${perjadinPreparationItem} pi
        where pi.perjadin_id = ${perjadin.id}
        and pi.item_key in (${sql.join(
          PREPARATION_FIXED_KEYS.map((key) => sql`${key}`),
          sql`, `,
        )})
      )`.mapWith(Number),
    })
    .from(perjadin)
    .innerJoin(person, eq(person.id, perjadin.picPersonId))
    .leftJoin(session, eq(session.perjadinId, perjadin.id))
    .groupBy(perjadin.id, person.fullName)
    .orderBy(desc(perjadin.startsOn), desc(perjadin.id));
}
