import type { Role, Stream } from "@sugt/domain";
import { asc, eq, inArray } from "drizzle-orm";

import { db } from "../client";
import { ONLINE_SESSION_STILL_STANDS, session, sessionTeacher } from "../schema/delivery";
import { person } from "../schema/people";
import { school } from "../schema/reference";
import type { Person } from "./caller";
import { requireStaff } from "./staff-only";

/**
 * **Jadwalkan Sesi daring** — arranging an online Session for each School in a Coverage
 * selection, in one pass: a shared date and a shared Staff PIC applied across the
 * selection, every row still editable before submit.
 *
 * Six of every ten Sessions are online and have no Perjadin, so this is the entry point
 * for most of the teaching in the Programme. It is also **the first thing in this
 * package that writes**, which makes it the ticket that proves convention 5 beside this
 * module: the transaction lives in the function below and not in the Server Action
 * calling it.
 *
 * Staff-only, and that is the surface list's rule rather than ADR-0004's — see
 * `./staff-only.ts`, which now carries both reasons. It matters more on a write than on
 * a read: a Next.js layout does not run before a Server Action, so `requireStaff` here
 * is the only thing standing between a Teaching Team member and an arranged Session.
 */

/** One School in the selection, as a row of the form names it. */
export type BatchSchool = {
  id: string;
  name: string;
  /** Shown for the same reason Coverage shows it: to confirm this is the right School. */
  kabupatenKota: string;
};

/**
 * Somebody a picker on this screen can name — the shared PIC, or a Teaching Team member
 * on one row.
 *
 * **Revoked People are not here.** `person.active = false` is the whole revocation
 * mechanism ([ADR-0013](../../../../docs/adr/0013-people-are-added-in-the-tool-and-their-role-is-write-once.md)),
 * and naming a revoked Person as the PIC of a Session nobody has taught yet would
 * commit them to filing its Session Record. Historical references to them stay intact;
 * this is a picker, and a picker is about what happens next.
 */
export type BatchPerson = {
  id: string;
  fullName: string;
};

/**
 * What the screen renders before anything is written: the Schools that were selected,
 * and the two rosters its pickers offer.
 *
 * **Two statements rather than one, and that is a deliberate reading of convention 3.**
 * That convention exists so no screen assembles its own joins, and there is no join to
 * assemble here — Schools and People are unrelated aggregates, and the single-statement
 * form is a `union all` stapling them together behind a null placeholder column. The
 * screen still makes exactly one call and still assembles nothing. `Promise.all` keeps
 * the two concurrent.
 *
 * The rosters will want an unexported helper the moment
 * [#29](https://github.com/mafiefa02/sugt/issues/29) picks a Group from the same two
 * lists. The convention beside this module is that the **second** module wanting an
 * expression is what earns the helper, so it stays inline here and moves down then.
 */
export type OnlineSessionBatch = {
  /**
   * In name order, not selection order. Coverage hands over a `Set`, which carries no
   * order worth preserving, and a stable one is what lets a reader check the list.
   *
   * **A School id that matches nothing is dropped rather than refused.** A hand-edited
   * URL is reachable, and this is the honest response to one: the screen lists every
   * School it is about to write a Session for, by name, so a dropped id is visible as
   * an absence rather than hidden behind an error page.
   */
  schools: BatchSchool[];
  /** Staff, for the shared PIC. Every online Session must name one. */
  staff: BatchPerson[];
  /** Teaching Team, for the two per-Stream pickers on each row. */
  teachingTeam: BatchPerson[];
};

/**
 * The form's payload, before anything is written.
 *
 * Returns empty lists rather than `null` when the selection matches no School. The
 * screen renders its own empty state from `schools`, and there is no 404 to be had here
 * — nothing was addressed that could be missing.
 */
export async function onlineSessionBatch(
  caller: Person,
  schoolIds: string[],
): Promise<OnlineSessionBatch> {
  requireStaff(caller);

  const [schools, people] = await Promise.all([
    // `inArray` on an empty list is a query with no possible answer, so it is skipped
    // rather than sent.
    schoolIds.length === 0
      ? []
      : db
          .select({ id: school.id, name: school.name, kabupatenKota: school.kabupatenKota })
          .from(school)
          .where(inArray(school.id, schoolIds))
          .orderBy(asc(school.name)),
    db
      .select({ id: person.id, fullName: person.fullName, role: person.role })
      .from(person)
      .where(eq(person.active, true))
      .orderBy(asc(person.fullName)),
  ]);

  // Split in TypeScript rather than by two queries: `role` is one column of one table and
  // the rows are already in hand. The comparison needs no assertion — the column carries
  // `Role` from the schema, off `person_role_check`.
  const withRole = (role: Role): BatchPerson[] =>
    people
      .filter((entry) => entry.role === role)
      // `role` itself does not travel: nothing on this screen renders it, and the list a
      // picker was handed is what says which role it is asking for.
      .map((entry) => ({ id: entry.id, fullName: entry.fullName }));

  return {
    schools,
    staff: withRole("Staff"),
    teachingTeam: withRole("Teaching Team"),
  };
}

/** Who taught one Stream at one Session. At most one per Stream, by primary key. */
export type OnlineSessionTeacher = {
  stream: Stream;
  /** Teaching Team. A composite foreign key into `person (id, role)` refuses anyone else. */
  personId: string;
};

/**
 * One row of the form: a School, the date it is arranged for, who is accountable for it,
 * and who is to teach it.
 *
 * **The PIC is on the row and not on the batch**, which is the criterion read closely:
 * the screen *"applies a shared date and a shared Staff PIC, and lets every row be
 * edited before submit"* — and the rows are what those two values were applied to. The
 * shared controls are the form's convenience, so they stay in the form; the schema puts
 * `online_pic_person_id` on the Session, and this type says the same thing.
 */
export type OnlineSessionRow = {
  schoolId: string;
  /** `YYYY-MM-DD`. The shared date the form applied, or whatever this row was edited to. */
  heldOn: string;
  /**
   * The Staff member accountable for this Session. Every online Session has its own,
   * since it has no Perjadin to take one from — otherwise six of every ten Sessions
   * would have nobody to file the Session Record.
   */
  picPersonId: string;
  /**
   * **Optional here, and mandatory at Tandai terlaksana.** Naming both Streams at
   * arrangement would block a whole batch whenever one professor is not yet fixed, which
   * is the ordinary case; the dialog that marks a Session delivered is where "both
   * Streams were taught" is enforced. Settled on
   * [#17](https://github.com/mafiefa02/sugt/issues/17).
   *
   * An empty list is therefore ordinary rather than a missing value.
   */
  teachers: OnlineSessionTeacher[];
};

/**
 * A row that could not be arranged: this School already has an online Session on this
 * date that was not cancelled.
 *
 * The School is named rather than described, because the screen has the row in hand and
 * knows what to call it.
 */
export type OnlineSessionCollision = {
  schoolId: string;
  heldOn: string;
};

/**
 * **The batch is refused whole, and every colliding row is named.**
 *
 * "Refused" is read as the batch rather than the row on purpose. The alternative —
 * write what fits, report the rest — leaves Staff looking at a list where some rows
 * happened and some did not, and no way to retry the failures without re-selecting from
 * Coverage. Refusing the batch keeps the form's state and the database's in agreement:
 * either every row was arranged or nothing was.
 *
 * A collision is a **user state**, not a bug, so it comes back as a value rather than as
 * a throw — the rule of thumb settled on [#12](https://github.com/mafiefa02/sugt/issues/12)
 * is that a constraint reachable from correct UI gets a friendly field-level message.
 * Two Staff arranging the same Cluster's monthly round is exactly that. `NotStaffError`
 * is the opposite case and still throws.
 */
export type ArrangeOnlineSessionsResult =
  | { outcome: "arranged"; sessionIds: string[] }
  | { outcome: "collided"; collisions: OnlineSessionCollision[] };

/**
 * How the batch is unwound once a row collides.
 *
 * Thrown so the `db.transaction` callback rolls back, and caught immediately outside it
 * — the collisions are the function's return value, not its failure. It is private to
 * this module, and `instanceof` is safe on it for the same reason: unlike
 * `NotStaffError` it never crosses a module boundary, so there is no second class of it
 * for a bundler to make.
 */
class BatchCollided extends Error {
  constructor(readonly collisions: OnlineSessionCollision[]) {
    super(`${collisions.length} of the rows in this batch collided with an existing Session.`);
  }
}

/**
 * Arrange one online Session per row, in one transaction.
 *
 * **The transaction is here rather than in the Server Action**, which is convention 5
 * beside this module and the first exercise of it. A Session and its `session_teacher`
 * rows are one act; a Server Action that opened the boundary would have put it somewhere
 * a second caller cannot reuse.
 *
 * Rows are inserted one at a time rather than as one multi-row statement. That costs a
 * statement per School — at most seventeen, the largest Cluster — and buys the thing the
 * criterion asks for: `on conflict do nothing` returns nothing for a row that collided,
 * so **the row that failed is known exactly**, with no assumption about `returning`
 * order and no second read to guess from. Every row is attempted, so one submit names
 * every collision rather than the first.
 *
 * `on conflict` names the arbiter and repeats the index predicate, so it infers
 * `session_one_online_per_school_per_day` and nothing else. That matters: with no target
 * it would also swallow a violation of `session_one_per_school_per_perjadin` or of the
 * primary key, and neither of those is a user state.
 *
 * **No row can express a state the CHECKs would refuse**, which is a stronger thing than
 * a screen that avoids offering one. `OnlineSessionRow` has no `mode` to set wrong, no
 * `perjadinId` to pair with an online Session, and no `status` or `cancelledReason`:
 * every row is bound below as `mode = 'online'` with no Perjadin and a Staff PIC, so
 * `session_offline_iff_perjadin`, `session_online_iff_pic` and
 * `session_cancelled_iff_reason` are satisfied before a value is bound.
 */
export async function arrangeOnlineSessions(
  caller: Person,
  rows: OnlineSessionRow[],
): Promise<ArrangeOnlineSessionsResult> {
  requireStaff(caller);

  if (rows.length === 0) return { outcome: "arranged", sessionIds: [] };

  try {
    const sessionIds = await db.transaction(async (tx) => {
      const arranged: string[] = [];
      const collisions: OnlineSessionCollision[] = [];

      for (const row of rows) {
        const [created] = await tx
          .insert(session)
          .values({
            schoolId: row.schoolId,
            mode: "online",
            heldOn: row.heldOn,
            onlinePicPersonId: row.picPersonId,
            // `satisfies` where `mode` needs none: `online_pic_role` is pinned to a single
            // literal by CHECK rather than to a set, and whether those columns carry a
            // type is open — see
            // [#52](https://github.com/mafiefa02/sugt/issues/52).
            onlinePicRole: "Staff" satisfies Role,
          })
          .onConflictDoNothing({
            target: [session.schoolId, session.heldOn],
            // The index's own predicate, imported rather than retyped. Postgres refuses to
            // infer an index whose predicate does not match, and that is a runtime failure.
            where: ONLINE_SESSION_STILL_STANDS,
          })
          .returning({ id: session.id });

        if (!created) {
          collisions.push({ schoolId: row.schoolId, heldOn: row.heldOn });
          continue;
        }

        arranged.push(created.id);

        // Written in the same iteration as the Session they belong to, so nothing has to
        // match a teacher back to a row afterwards. A row that named nobody writes
        // nothing, which is the ordinary case rather than a missing value.
        if (row.teachers.length > 0) {
          await tx.insert(sessionTeacher).values(
            row.teachers.map((teacher) => ({
              sessionId: created.id,
              stream: teacher.stream,
              personId: teacher.personId,
            })),
          );
        }
      }

      if (collisions.length > 0) throw new BatchCollided(collisions);

      return arranged;
    });

    return { outcome: "arranged", sessionIds };
  } catch (error) {
    if (error instanceof BatchCollided)
      return { outcome: "collided", collisions: error.collisions };
    throw error;
  }
}
