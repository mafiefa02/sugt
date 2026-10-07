import type { TimeZone } from "@sugt/domain";
import { and, eq, isNotNull, ne, sql } from "drizzle-orm";

import { db } from "../client";
import { session } from "../schema/delivery";
import { province, school, subCluster } from "../schema/reference";
import { perjadin } from "../schema/travel";
import type { PerjadinNameRef } from "./perjadin-naming";

/**
 * **One live offline Session per School per moment, across every Perjadin** (#408, ADR-0043) — the
 * read the writes run before `session_no_duplicate_offline_per_school` refuses at the database, so a
 * double-booking comes back as a sentence naming the other trip rather than as a raw violation.
 * Shared by `planPerjadin`, `addPerjadinSession`, `editPerjadinSession` and `moveSessionDate`, and
 * kept here beneath them, unexported from `@sugt/db/queries` but for its refusal type
 * (convention 3).
 *
 * The check is a read before the write and the index is the backstop: a write that races past the
 * read is refused by the index, and `slotViolationRefusal` turns that back into the same refusal.
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
  perjadin: PerjadinNameRef;
};

/** Which Session and trip a check is on behalf of, so neither counts as holding its own slot. */
export type SlotOwner = {
  /** The trip being written — `null` while planning, when it does not exist yet. */
  ownPerjadinId: string | null;
  /** The Session being edited or moved, which never holds its own slot. */
  excludeSessionId?: string;
};

/**
 * **The first of `slots` another trip already holds**, as the refusal naming that trip — or `null`
 * when each is free, or held only on the caller's own trip, whose duplicate is its own refusal
 * (`duplicate-session`, or `collided` on a move). Read before the write, so a double-booking is a
 * sentence rather than a violation.
 *
 * `starts_at` is a `time`, so the `HH:MM` the forms send compares equal to the stored `HH:MM:SS`.
 */
export async function bookedOnAnotherPerjadin(
  reader: Tx | typeof db,
  slots: SchoolSlot[],
  { ownPerjadinId, excludeSessionId }: SlotOwner,
): Promise<SchoolBookedOnAnotherPerjadin | null> {
  for (const slot of slots) {
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
          ownPerjadinId ? ne(session.perjadinId, ownPerjadinId) : undefined,
          excludeSessionId ? ne(session.id, excludeSessionId) : undefined,
        ),
      )
      .limit(1);
    if (held) {
      return {
        outcome: "school-booked-on-another-perjadin",
        schoolName: held.schoolName,
        heldOn: slot.heldOn,
        startsAt: held.startsAt,
        timeZone: held.timeZone,
        perjadin: held.perjadin,
      };
    }
  }
  return null;
}

/**
 * **A write refused by `session_no_duplicate_offline_per_school`, named** — the race past
 * `bookedOnAnotherPerjadin`'s read, which the index closes. The index cannot say whose Session
 * holds the slot, so it is read again, outside the failed transaction: the refusal naming the other
 * trip, or `null` when the holder is on the caller's own trip. Anything else the write failed on is
 * rethrown, named rather than caught wholesale, so a bug is never reported as a user state.
 */
export async function slotViolationRefusal(
  error: unknown,
  slots: SchoolSlot[],
  owner: SlotOwner,
): Promise<SchoolBookedOnAnotherPerjadin | null> {
  const wrapped = error as { cause?: { constraint_name?: string }; constraint_name?: string };
  const constraint = wrapped.cause?.constraint_name ?? wrapped.constraint_name;
  if (constraint !== "session_no_duplicate_offline_per_school") throw error;
  return bookedOnAnotherPerjadin(db, slots, owner);
}
