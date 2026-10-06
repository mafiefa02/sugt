import type { TimeZone } from "@sugt/domain";
import { and, eq, isNotNull, ne, sql } from "drizzle-orm";

import { db } from "../client";
import { session } from "../schema/delivery";
import { province, school, subCluster } from "../schema/reference";
import { perjadin } from "../schema/travel";

/**
 * **One live offline Session per School per moment, across every Perjadin** (#408, ADR-0043) — the
 * read the writes run before `session_no_duplicate_offline_per_school` refuses at the database, so a
 * double-booking comes back as a sentence naming the other trip rather than as a raw violation.
 * Shared by `planPerjadin`, `addPerjadinSession`, `editPerjadinSession` and `moveSessionDate`, and
 * kept here beneath them, unexported from `@sugt/db/queries` but for its refusal type
 * (convention 3).
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A School, a date and a local start time — the key the index holds unique among live Sessions. */
export type SchoolSlot = { schoolId: string; heldOn: string; startsAt: string };

/**
 * The slot is taken by a live offline Session on **another** Perjadin. It carries what the
 * sentence needs — the School, the moment in the School's own zone, and the other trip's name parts
 * (ADR-0044) and id for the link — so the screen looks nothing up.
 */
export type SchoolBookedOnAnotherPerjadin = {
  outcome: "school-booked-on-another-perjadin";
  schoolName: string;
  heldOn: string;
  startsAt: string;
  timeZone: TimeZone;
  perjadin: { id: string; subClusterName: string; startsOn: string; endsOn: string };
};

/**
 * Who holds the slot: the live offline Session already at this School, date and start time, and
 * its trip — or `null` when it is free. `excludeSessionId` leaves out the Session being edited or
 * moved, so it never holds its own slot. The caller tells "on this trip" from "on another" by
 * `perjadinId`: the first is its own duplicate refusal, the second is
 * `school-booked-on-another-perjadin`.
 *
 * `starts_at` is a `time`, so the `HH:MM` the forms send compares equal to the stored `HH:MM:SS`.
 */
export async function slotHolder(
  reader: Tx | typeof db,
  slot: SchoolSlot,
  excludeSessionId?: string,
): Promise<{ perjadinId: string; refusal: SchoolBookedOnAnotherPerjadin } | null> {
  const [held] = await reader
    .select({
      schoolName: school.name,
      timeZone: province.timeZone,
      startsAt: session.startsAt,
      perjadin: {
        id: perjadin.id,
        subClusterName: subCluster.name,
        startsOn: perjadin.startsOn,
        endsOn: perjadin.endsOn,
      },
    })
    .from(session)
    .innerJoin(school, eq(school.id, session.schoolId))
    .innerJoin(province, eq(province.code, school.provinceCode))
    .innerJoin(perjadin, eq(perjadin.id, session.perjadinId))
    .innerJoin(subCluster, eq(subCluster.id, perjadin.subClusterId))
    .where(
      and(
        eq(session.schoolId, slot.schoolId),
        eq(session.heldOn, slot.heldOn),
        sql`${session.startsAt} = ${slot.startsAt}::time`,
        ne(session.status, "cancelled"),
        isNotNull(session.perjadinId),
        excludeSessionId ? ne(session.id, excludeSessionId) : undefined,
      ),
    )
    .limit(1);
  if (!held) return null;

  return {
    perjadinId: held.perjadin.id,
    refusal: {
      outcome: "school-booked-on-another-perjadin",
      schoolName: held.schoolName,
      heldOn: slot.heldOn,
      startsAt: held.startsAt,
      timeZone: held.timeZone,
      perjadin: held.perjadin,
    },
  };
}

/** Whether a write failed on the double-booking index, so the caller can name who holds the slot. */
export function isSlotTaken(error: unknown): boolean {
  const constraint = (error as { cause?: { constraint_name?: string } }).cause?.constraint_name;
  return constraint === "session_no_duplicate_offline_per_school";
}
