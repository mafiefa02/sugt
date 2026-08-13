import type { SessionMode, SessionStatus, Stream } from "@sugt/domain";
import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { person } from "./people";
import { school } from "./reference";
import { perjadin } from "./travel";

/**
 * Which rows `session_one_online_per_school_per_day` covers: an online Session that has
 * not been cancelled.
 *
 * **Exported because a second place has to say the same thing, character for character.**
 * `arrangeOnlineSessions` names this index as its `on conflict` arbiter and has to repeat
 * the predicate to do so — and Postgres refuses to infer an index whose predicate does not
 * match, which fails at runtime rather than at typecheck. Two copies of it are two chances
 * to find that out in production.
 *
 * Column names are unqualified deliberately. A `create index … where` clause may not carry
 * a qualified reference, so the form that works in the index is the form that has to be
 * shared.
 *
 * `./index.ts` re-exports this file with `export *`, so this is on the public
 * `@sugt/db/schema` surface rather than schema-internal. That is intended — the query
 * layer is its one consumer and is a separate subpath — but it does mean the fragment is
 * as public as the table it belongs to.
 */
export const ONLINE_SESSION_STILL_STANDS = sql`perjadin_id is null and status <> 'cancelled'`;

/**
 * Delivery: Sessions, and who taught which Stream at them.
 *
 * A Session exists only once **arranged** — never before — so there are no planned
 * rows, no target dates and nothing is ever overdue. Progress is delivered Sessions
 * against `TOTAL_SESSIONS_PER_SCHOOL`, a constant in `@sugt/domain`.
 */
export const session = pgTable(
  "session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => school.id),
    // No `onDelete`: an offline Session BLOCKS deleting its Perjadin. A trip that
    // produced teaching cannot be quietly erased.
    perjadinId: uuid("perjadin_id").references(() => perjadin.id),
    // `session_mode_check` and `session_status_check` name exactly the values
    // `SESSION_MODES` and `SESSION_STATUSES` hold, so these narrowings are the database's
    // guarantee rather than this module's hope. `$type<>()` comes before `.default()` so
    // that the default is checked against the set too.
    mode: text("mode").$type<SessionMode>().notNull(),
    heldOn: date("held_on").notNull(),
    status: text("status").$type<SessionStatus>().notNull().default("arranged"),
    cancelledReason: text("cancelled_reason"),

    onlinePicPersonId: uuid("online_pic_person_id"),
    // Pinned to the single value 'Staff' by `session_online_pic_role_check`, so it reads
    // back as the literal "Staff" rather than string — a narrower claim than the set
    // columns above; see the header on single-literal columns.
    onlinePicRole: text("online_pic_role").$type<"Staff">(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("session_mode_check", sql`${t.mode} in ('offline', 'online')`),
    check("session_status_check", sql`${t.status} in ('arranged', 'delivered', 'cancelled')`),
    // The sharpest rule in the delivery half, and an equivalence in both directions:
    // an offline Session has a Perjadin and an online Session has none.
    check(
      "session_offline_iff_perjadin",
      sql`(${t.mode} = 'offline') = (${t.perjadinId} is not null)`,
    ),
    // Its exact mirror. Every Session has a PIC: an offline one takes its Perjadin's,
    // an online one carries its own, so the six-in-ten online Sessions still have
    // somebody to file the Session Record.
    check(
      "session_online_iff_pic",
      sql`(${t.mode} = 'online') = (${t.onlinePicPersonId} is not null)`,
    ),
    check("session_online_pic_role_check", sql`${t.onlinePicRole} = 'Staff'`),
    check(
      "session_pic_pair_check",
      sql`(${t.onlinePicPersonId} is null) = (${t.onlinePicRole} is null)`,
    ),
    check(
      "session_cancelled_iff_reason",
      sql`(${t.status} = 'cancelled') = (${t.cancelledReason} is not null)`,
    ),
    // MATCH SIMPLE: a row with NULLs in the referencing columns satisfies the
    // constraint, so offline Sessions pass without a special case.
    foreignKey({
      name: "session_online_pic_is_staff",
      columns: [t.onlinePicPersonId, t.onlinePicRole],
      foreignColumns: [person.id, person.role],
    }),
    // "Creating a Perjadin is what brings its Sessions into existence — one per
    // School on the trip." Partial, because cancelled Sessions accumulate: a School
    // whose visit was called off and re-arranged on the same trip must not collide
    // with its own cancelled row.
    uniqueIndex("session_one_per_school_per_perjadin")
      .on(t.perjadinId, t.schoolId)
      .where(sql`status <> 'cancelled'`),
    // The gap the index above cannot close. It keys on `perjadin_id`, which is NULL for
    // every online Session, and Postgres treats NULLs in a unique index as distinct — so
    // nothing stopped two online Sessions for one School on one day. Jadwalkan Sesi
    // daring arranges them from Coverage in a batch, one date across a multi-selection,
    // which moves that from theoretical to one mis-click away.
    //
    // Partial in both the ways the first index is, and for the same two reasons:
    // cancelled rows accumulate and must not collide with the Session that replaced
    // them, and offline Sessions are untouched because their `perjadin_id` is not null.
    uniqueIndex("session_one_online_per_school_per_day")
      .on(t.schoolId, t.heldOn)
      .where(ONLINE_SESSION_STILL_STANDS),
  ],
);

/**
 * Who taught which Stream. The primary key gives at most one teacher per Stream per
 * Session; the composite foreign key makes it impossible to record a Staff member as
 * having taught one.
 *
 * This is also the denominator for who owes a Class Record: these two people crossed
 * with the three Class kinds is the six a Session expects.
 */
export const sessionTeacher = pgTable(
  "session_teacher",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => session.id, { onDelete: "cascade" }),
    stream: text("stream").$type<Stream>().notNull(),
    personId: uuid("person_id").notNull(),
    personRole: text("person_role").$type<"Teaching Team">().notNull().default("Teaching Team"),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.stream] }),
    check("session_teacher_stream_check", sql`${t.stream} in ('STEM', 'Research')`),
    check("session_teacher_role_check", sql`${t.personRole} = 'Teaching Team'`),
    foreignKey({
      name: "session_teacher_is_teaching_team",
      columns: [t.personId, t.personRole],
      foreignColumns: [person.id, person.role],
    }),
  ],
);
