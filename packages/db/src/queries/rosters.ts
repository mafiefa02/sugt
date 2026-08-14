import { asc, eq, inArray } from "drizzle-orm";

import { db } from "../client";
import { person } from "../schema/people";
import { school } from "../schema/reference";

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
    .select({ id: school.id, name: school.name, kabupatenKota: school.kabupatenKota })
    .from(school)
    .where(inArray(school.id, schoolIds))
    .orderBy(asc(school.name));
}

/**
 * Everybody a planning form may name, split by role.
 *
 * **Split in TypeScript rather than by two queries**: `role` is one column of one table and
 * one statement brings back both lists, so asking the database twice would buy nothing.
 *
 * **Revoked People are not here.** `person.active = false` is the whole revocation
 * mechanism ([ADR-0013](../../../../docs/adr/0013-people-are-added-in-the-tool-and-their-role-is-write-once.md)),
 * and naming a revoked Person commits them to teaching or to a trip that has not happened.
 * Historical references to them stay intact; a picker is about what happens next.
 */
export async function activeRosters(): Promise<{
  staff: RosterPerson[];
  teachingTeam: RosterPerson[];
}> {
  const people = await db
    .select({ id: person.id, fullName: person.fullName, role: person.role })
    .from(person)
    .where(eq(person.active, true))
    .orderBy(asc(person.fullName));

  return {
    staff: people.filter((entry) => entry.role === "Staff").map(withoutRole),
    teachingTeam: people.filter((entry) => entry.role === "Teaching Team").map(withoutRole),
  };
}

/**
 * `role` does not travel. Nothing on either form renders it, and the list a picker was
 * handed is what says which role it is asking for.
 */
function withoutRole(entry: RosterPerson & { role: unknown }): RosterPerson {
  return { id: entry.id, fullName: entry.fullName };
}

/**
 * Every active Teaching Team member, for the surfaces that need only that half — Tandai
 * terlaksana's two pickers and the Group substitution dialog.
 */
export async function activeTeachingTeam(): Promise<RosterPerson[]> {
  return (await activeRosters()).teachingTeam;
}
