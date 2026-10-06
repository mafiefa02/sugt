import { rankBySchool, type TimeZone } from "@sugt/domain";
import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";

import { db } from "../client";
import { session } from "../schema/delivery";
import { province, school, subCluster } from "../schema/reference";
import { perjadin } from "../schema/travel";

/**
 * **What is already covered** (#409) — each School's live offline Sessions on other Perjadins, shown
 * wherever a Session is planned, so a Kelompok split across several trips (ADR-0043) does not lose
 * track of which Schools already have one elsewhere. Read-only, and it never blocks: the cap of two
 * offline Sessions per School (`SESSIONS_PER_SCHOOL.offline`) is still not enforced. Shared by
 * `perjadinPlan` and `perjadinDetail`, kept here beneath them and unexported from `@sugt/db/queries`
 * but for its type (convention 3).
 */

/** One live offline Session a School already has on another trip, as the note shows it. */
export type CoveredSession = {
  /** Its Sesi: the School's offline date rank over **all** its live offline Sessions (ADR-0027). */
  sesi: number;
  heldOn: string;
  startsAt: string;
  /** The School's Time Zone, for `startsAt`. */
  timeZone: TimeZone;
  /** Its trip's id, for the link, and the parts of the trip's name (ADR-0044). */
  perjadin: { id: string; subClusterName: string; startsOn: string; endsOn: string };
};

/**
 * Each of `schoolIds`' live offline Sessions, in Sesi order, with `excludePerjadinId`'s left out —
 * the trip being edited, whose own Sessions its page already lists. The Sesi is ranked **before**
 * the excluded trip is dropped, by `rankBySchool`, the one ranking, so a Session keeps the number it
 * has everywhere else. A School with none maps to an empty list.
 */
export async function offlineSessionsElsewhere(
  schoolIds: string[],
  excludePerjadinId?: string,
): Promise<Map<string, CoveredSession[]>> {
  const covered = new Map<string, CoveredSession[]>(schoolIds.map((id) => [id, []]));
  if (schoolIds.length === 0) return covered;

  const rows = await db
    .select({
      id: session.id,
      schoolId: session.schoolId,
      heldOn: session.heldOn,
      startsAt: session.startsAt,
      timeZone: province.timeZone,
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
        inArray(session.schoolId, schoolIds),
        eq(session.mode, "offline"),
        isNotNull(session.perjadinId),
        ne(session.status, "cancelled"),
      ),
    );

  for (const [schoolId, ranked] of rankBySchool(rows)) {
    covered.set(
      schoolId,
      ranked.flatMap(({ heldOn, startsAt, timeZone, perjadin: trip }, index) =>
        trip.id === excludePerjadinId
          ? []
          : [{ sesi: index + 1, heldOn, startsAt, timeZone, perjadin: trip }],
      ),
    );
  }
  return covered;
}
