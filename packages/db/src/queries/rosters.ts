import type { TimeZone } from "@sugt/domain";
import { asc, eq, inArray } from "drizzle-orm";

import { db } from "../client";
import { person } from "../schema/people";
import { province, school } from "../schema/reference";

/**
 * The two lists every planning form picks from, and the Schools a Coverage selection names.
 *
 * **This helper was earned by the second module wanting it.** Jadwalkan Sesi daring picked the
 * two lists inline first; Rencanakan Perjadin ([#29](https://github.com/mafiefa02/sugt/issues/29))
 * is the second module to want them, and the convention beside `@sugt/db` is that the second is
 * what earns a shared helper — so they moved down here.
 *
 * **Nothing here is re-exported from `./index.ts`.** Convention 3 says nothing is exported
 * that a surface renders, and no surface renders these — they are shared SQL beneath two
 * modules, which is exactly the case that convention makes room for.
 */

/** Somebody a picker can name. Both planning surfaces render the same two fields. */
export type RosterPerson = {
  id: string;
  fullName: string;
};

/** A School a Coverage selection named, as a form row shows it. */
export type SelectedSchool = {
  id: string;
  name: string;
  /** Shown so a reader can confirm this is the right School, not a namesake. */
  kabupatenKota: string;
  /**
   * The School's Time Zone, from its Province (`province.time_zone`). Carried so a create/plan
   * form can label its wall-clock time input with the zone the moment the School is picked
   * ([#165](https://github.com/mafiefa02/sugt/issues/165)); a School always sits in one Province,
   * so it is never absent.
   */
  timeZone: TimeZone;
};

/**
 * The Schools a selection names, in **name order rather than selection order**.
 *
 * Coverage hands over a `Set`, which carries no order worth preserving, and a stable one is
 * what lets a reader check the list.
 *
 * **A School id matching nothing is dropped rather than refused.** A hand-edited URL is
 * reachable, and this is the honest response to one: the form lists every School it is about
 * to write a Session for, by name, so a dropped id is visible as an absence rather than
 * hidden behind an error page.
 */
export async function selectedSchools(schoolIds: string[]): Promise<SelectedSchool[]> {
  // `inArray` on an empty list is a query with no possible answer, so it is skipped rather
  // than sent.
  if (schoolIds.length === 0) return [];

  return db
    .select({
      id: school.id,
      name: school.name,
      kabupatenKota: school.kabupatenKota,
      timeZone: province.timeZone,
    })
    .from(school)
    .innerJoin(province, eq(province.code, school.provinceCode))
    .where(inArray(school.id, schoolIds))
    .orderBy(asc(school.name));
}

/**
 * Everybody a planning form may name.
 *
 * **Only `{ staff }` now** (T3, #153): the `Teaching Team` Person role is retired, so every active
 * Person is Staff. The teaching team a planning form once picked from People is trip-scoped /
 * session-scoped free-text names now (ADR-0020, ADR-0022), typed on the form rather than chosen
 * from a roster. The shape stays an object rather than a bare array so a second half can return
 * here without every call site changing, and because the PIC/extra-Staff combobox reads `.staff`.
 *
 * **Revoked People are not here.** `person.active = false` is the whole revocation
 * mechanism ([ADR-0013](../../../../docs/adr/0013-people-are-added-in-the-tool-and-their-role-is-write-once.md)),
 * and naming a revoked Person commits them to a trip that has not happened. Historical references
 * to them stay intact; a picker is about what happens next.
 */
export async function activeRosters(): Promise<{ staff: RosterPerson[] }> {
  const staff = await db
    .select({ id: person.id, fullName: person.fullName })
    .from(person)
    .where(eq(person.active, true))
    .orderBy(asc(person.fullName));

  return { staff };
}
