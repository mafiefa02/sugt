import {
  CLASS_KINDS,
  REPORT_DEADLINE_DAYS_AFTER_RETURN,
  type ClassKind,
  type SessionMode,
  type Stream,
  type TimeZone,
} from "@sugt/domain";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "../client";
import { session, sessionTeacher } from "../schema/delivery";
import { classRecord, sessionRecord } from "../schema/evaluations";
import { cluster, province, school } from "../schema/reference";
import { groupMember, perjadin, transaction } from "../schema/travel";
import type { Person } from "./caller";
import { deliveredSessionCount, onDeliveredSessions } from "./delivered-sessions";
import { requireStaff } from "./staff-only";

/**
 * The outer `perjadin` row's id, **qualified by hand**. Drizzle renders `perjadin.id` as bare
 * `"id"` when `perjadin` is the single FROM table, and inside the correlated subqueries below that
 * collides with `transaction.id` — so `tx.perjadin_id = "id"` silently means `= tx.id` and never
 * matches. Writing `"perjadin"."id"` keeps the correlation, the same fix `roster.ts` documents.
 */
const OUTER_PERJADIN_ID = sql.raw(`"perjadin"."id"`);

/**
 * **Beranda** — the two role dashboards (#40). Each is one use-case function returning one
 * payload, taking a caller, and it **assembles rather than invents** — every figure is a rule
 * that already lives somewhere else in this package, read here through one call.
 *
 * The tone throughout is **counts, not claims** (ADR-0009, `docs/data-model.md`'s *who still
 * owes what*): nothing is overdue, nothing is gated, and the owed lists name who has not filed so
 * they can be chased. **Participants are never counted** — there is no attendee list, so a count
 * would have no denominator.
 *
 * *"Who still owes what" filters on `session.status = 'delivered'`*, because an online Session
 * names its professors at arrangement — without the filter a dashboard would report Class Records
 * owed for teaching that has not happened, the overdue-shaped state ADR-0006 exists to prevent.
 */

/** One Class Record a professor still owes on a delivered Session they taught. */
export type OwedClassRecord = {
  sessionId: string;
  schoolName: string;
  heldOn: string;
  classKind: ClassKind;
};

/** An arranged Session a professor is on and has not yet taught. */
export type UpcomingSession = {
  sessionId: string;
  schoolName: string;
  mode: SessionMode;
  heldOn: string;
  /** Wall-clock start time local to the School (`HH:MM:SS`), rendered with its zone. */
  startsAt: string;
  timeZone: TimeZone;
};

/**
 * The Teaching Team landing: what this professor still owes, the Sessions they are yet to teach,
 * and how many trips they are on. **Money-free throughout** — there is no `requireStaff` because
 * there is nothing here to gate.
 */
export type TeachingTeamDashboard = {
  fullName: string;
  /** The Streams this professor covers, from their Group assignments and taught Sessions. */
  streams: Stream[];
  /** Class Records owed on delivered Sessions they taught — the list to be chased, no deadline. */
  owed: OwedClassRecord[];
  /** Arranged Sessions on their trips (offline) or naming them (online), oldest first. */
  upcoming: UpcomingSession[];
  /** Trips they are a Group member of whose Report is not yet filed. */
  activeTripCount: number;
};

/** One delivered Session the caller taught, with the Class kinds they have already filed. */
type TaughtSession = {
  sessionId: string;
  schoolName: string;
  heldOn: string;
  filedKinds: ClassKind[];
};

/**
 * The Teaching Team dashboard, in one call. Four independent reads — a professor's taught
 * Sessions, their upcoming ones, their Streams and their active-trip count are unrelated
 * aggregates with no join to assemble — kept concurrent with `Promise.all`. The screen still
 * makes one call and assembles nothing.
 */
export async function teachingTeamDashboard(caller: Person): Promise<TeachingTeamDashboard> {
  const [taught, upcoming, streamRows, activeTrips] = await Promise.all([
    // Delivered Sessions the caller taught, each with the Class kinds they have filed. `owed` is
    // the three Class kinds minus those, expanded below — the same "delivered only" rule the
    // Session detail's owed list uses.
    db
      .select({
        sessionId: session.id,
        schoolName: school.name,
        heldOn: session.heldOn,
        filedKinds: sql<
          ClassKind[]
        >`coalesce(array_agg(distinct ${classRecord.classKind}) filter (where ${classRecord.classKind} is not null), '{}')`,
      })
      .from(sessionTeacher)
      .innerJoin(
        session,
        and(eq(session.id, sessionTeacher.sessionId), eq(session.status, "delivered")),
      )
      .innerJoin(school, eq(school.id, session.schoolId))
      .leftJoin(
        classRecord,
        and(eq(classRecord.sessionId, session.id), eq(classRecord.filedByPersonId, caller.id)),
      )
      .where(eq(sessionTeacher.personId, caller.id))
      .groupBy(session.id, school.name, session.heldOn)
      .orderBy(asc(session.heldOn)),
    // Arranged Sessions the caller is on: an offline one on a trip whose Group includes them, or
    // an online one that names them directly.
    db
      .select({
        sessionId: session.id,
        schoolName: school.name,
        mode: session.mode,
        heldOn: session.heldOn,
        startsAt: session.startsAt,
        timeZone: province.timeZone,
      })
      .from(session)
      .innerJoin(school, eq(school.id, session.schoolId))
      .innerJoin(province, eq(province.code, school.provinceCode))
      .where(
        and(
          eq(session.status, "arranged"),
          sql`(
            exists (select 1 from ${groupMember} gm where gm.perjadin_id = ${session.perjadinId} and gm.person_id = ${caller.id})
            or exists (select 1 from ${sessionTeacher} st where st.session_id = ${session.id} and st.person_id = ${caller.id})
          )`,
        ),
      )
      .orderBy(asc(session.heldOn), asc(session.id)),
    // Streams the caller covers: their Group assignments and any Session they have taught.
    db
      .selectDistinct({ stream: groupMember.stream })
      .from(groupMember)
      .where(and(eq(groupMember.personId, caller.id), sql`${groupMember.stream} is not null`))
      .union(
        db
          .selectDistinct({ stream: sessionTeacher.stream })
          .from(sessionTeacher)
          .where(eq(sessionTeacher.personId, caller.id)),
      ),
    // Trips they are on whose Report is not yet filed — "active" in the sense the design gives.
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(perjadin)
      .innerJoin(groupMember, eq(groupMember.perjadinId, perjadin.id))
      .where(and(eq(groupMember.personId, caller.id), isNull(perjadin.reportFiledAt))),
  ]);

  const owed = (taught as TaughtSession[]).flatMap((row) =>
    CLASS_KINDS.filter((kind) => !row.filedKinds.includes(kind)).map((classKind) => ({
      sessionId: row.sessionId,
      schoolName: row.schoolName,
      heldOn: row.heldOn,
      classKind,
    })),
  );

  const streams = streamRows
    .map((row) => row.stream)
    .filter((stream): stream is Stream => stream !== null)
    .sort();

  return {
    fullName: caller.fullName,
    streams,
    owed,
    upcoming,
    activeTripCount: activeTrips[0]?.count ?? 0,
  };
}

/** One Cluster's delivered-Session count, for the Staff dashboard's reach picture. */
export type ClusterReach = {
  clusterId: string;
  clusterName: string;
  delivered: number;
};

/** One Session Record the PIC still owes on a delivered Session they led. */
export type OwedSessionRecord = {
  sessionId: string;
  schoolName: string;
  heldOn: string;
};

/**
 * One trip this Staff member is PIC of, summarised — the acquittal figures the "Pekerjaan PIC
 * Anda" strip shows, without the full transaction and receipt lists.
 */
export type PicReport = {
  perjadinId: string;
  destination: string;
  startsOn: string;
  endsOn: string;
  groupCount: number;
  /** Members who have handed their receipts over — the `2 / 4` the design shows. */
  receiptsSettled: number;
  transactionCount: number;
  /** Advance minus everything spent. Negative means the Group overspent. */
  remainderIdr: number;
  /** Two days after the Group gets back — derived, never stored. */
  reportDueOn: string;
  /** Days left against that deadline in `Asia/Jakarta`, negative once passed. No gate, just a count. */
  daysRemaining: number;
  reportFiled: boolean;
};

/**
 * The Staff landing: the same delivery picture the Programme shows, plus this person's PIC work.
 *
 * **Everything here opens with the Staff-only choke point**, because the Advance strip and the PIC
 * work read money (ADR-0004). Reaching this with a Teaching Team `Person` throws — that is the
 * choke point working, not a case to handle. The delivery picture is not money, but it rides the
 * same guard: this is one payload, and there is no Teaching Team caller who should reach it.
 */
export type StaffDashboard = {
  fullName: string;
  /** Distinct Schools with at least one delivered Session. */
  schoolsReached: number;
  deliveredTotal: number;
  perCluster: ClusterReach[];
  /** The Advance still out, unaccounted for: the sum of Advances not yet returned. Money. */
  advanceOutstandingIdr: number;
  /** Session Records this PIC owes on delivered Sessions they led — the list to be chased. */
  owed: OwedSessionRecord[];
  /** Trips they are PIC of whose Report is not yet filed. */
  picReports: PicReport[];
};

/**
 * The Staff dashboard, in one call and behind the Staff-only choke point. The reads are
 * independent aggregates — the reach picture, the outstanding Advance, the owed Records and the
 * PIC's trips — kept concurrent with `Promise.all`.
 */
export async function staffDashboard(caller: Person): Promise<StaffDashboard> {
  requireStaff(caller);

  const [perCluster, reached, advance, owed, picReports] = await Promise.all([
    // Delivered count per Cluster, the delivered filter in the JOIN so a Cluster at zero still
    // appears — the rule `./delivered-sessions.ts` owns.
    db
      .select({
        clusterId: cluster.id,
        clusterName: cluster.name,
        delivered: deliveredSessionCount,
      })
      .from(cluster)
      .innerJoin(school, eq(school.clusterId, cluster.id))
      .leftJoin(session, onDeliveredSessions)
      .groupBy(cluster.id, cluster.name)
      .orderBy(asc(cluster.name), asc(cluster.id)),
    // Distinct Schools that have delivered at least one Session.
    db
      .select({ count: sql<number>`count(distinct ${session.schoolId})`.mapWith(Number) })
      .from(session)
      .where(eq(session.status, "delivered")),
    // The Advance still out: every trip whose money has not been returned to the treasurer yet.
    db
      .select({
        total: sql<number>`coalesce(sum(${perjadin.advanceIdr}), 0)`.mapWith(Number),
      })
      .from(perjadin)
      .where(isNull(perjadin.returnedAt)),
    // Session Records the caller owes: delivered Sessions where they are PIC (online) or the
    // trip's PIC (offline), and no Session Record of theirs exists yet.
    db
      .select({
        sessionId: session.id,
        schoolName: school.name,
        heldOn: session.heldOn,
      })
      .from(session)
      .innerJoin(school, eq(school.id, session.schoolId))
      .leftJoin(perjadin, eq(perjadin.id, session.perjadinId))
      .where(
        and(
          eq(session.status, "delivered"),
          sql`coalesce(${session.onlinePicPersonId}, ${perjadin.picPersonId}) = ${caller.id}`,
          sql`not exists (
            select 1 from ${sessionRecord} sr
            where sr.session_id = ${session.id} and sr.filed_by_person_id = ${caller.id}
          )`,
        ),
      )
      .orderBy(asc(session.heldOn), asc(session.id)),
    // Trips the caller is PIC of whose Report is not filed, with the acquittal figures the strip
    // shows. `reportDueOn` and `daysRemaining` are derived here the way `perjadinAcquittal`
    // derives them — two days after return, counted against today in Asia/Jakarta.
    db
      .select({
        perjadinId: perjadin.id,
        destination: perjadin.destination,
        startsOn: perjadin.startsOn,
        endsOn: perjadin.endsOn,
        groupCount:
          sql<number>`(select count(*) from ${groupMember} gm where gm.perjadin_id = ${OUTER_PERJADIN_ID})`.mapWith(
            Number,
          ),
        receiptsSettled:
          sql<number>`(select count(*) from ${groupMember} gm where gm.perjadin_id = ${OUTER_PERJADIN_ID} and gm.receipts_settled_at is not null)`.mapWith(
            Number,
          ),
        transactionCount:
          sql<number>`(select count(*) from ${transaction} tx where tx.perjadin_id = ${OUTER_PERJADIN_ID})`.mapWith(
            Number,
          ),
        remainderIdr:
          sql<number>`${perjadin.advanceIdr} - coalesce((select sum(tx.amount_idr) from ${transaction} tx where tx.perjadin_id = ${OUTER_PERJADIN_ID}), 0)`.mapWith(
            Number,
          ),
        // `reportDueOn` and `daysRemaining` are derived the way `perjadinAcquittal` derives them:
        // two calendar days after return, counted against today in Asia/Jakarta (DITSAMA's own
        // zone — the deadline is theirs, not the School's). The day count is a trusted constant,
        // rendered as a literal so `date + int` type-checks rather than binding an untyped param.
        reportDueOn: sql<string>`to_char(${perjadin.endsOn} + ${sql.raw(String(REPORT_DEADLINE_DAYS_AFTER_RETURN))}, 'YYYY-MM-DD')`,
        daysRemaining: sql<number>`(
          ${perjadin.endsOn} + ${sql.raw(String(REPORT_DEADLINE_DAYS_AFTER_RETURN))}
          - (now() at time zone 'Asia/Jakarta')::date
        )`.mapWith(Number),
        reportFiled: sql<boolean>`${perjadin.reportFiledAt} is not null`,
      })
      .from(perjadin)
      .where(and(eq(perjadin.picPersonId, caller.id), isNull(perjadin.reportFiledAt)))
      .orderBy(asc(perjadin.endsOn), asc(perjadin.id)),
  ]);

  return {
    fullName: caller.fullName,
    schoolsReached: reached[0]?.count ?? 0,
    deliveredTotal: perCluster.reduce((sum, row) => sum + row.delivered, 0),
    perCluster,
    advanceOutstandingIdr: advance[0]?.total ?? 0,
    owed,
    picReports,
  };
}
