import {
  CLASS_RECORD_ASPECTS,
  CONCERN_AT_OR_BELOW,
  PARTICIPANT_FEEDBACK_ASPECTS,
  PERJADIN_ASPECTS,
  SESSION_RECORD_ASPECTS,
} from "@sugt/domain";
import { sql, type SQL } from "drizzle-orm";

import { db } from "../client";
import { session } from "../schema/delivery";
import {
  classRecord,
  participantFeedback,
  perjadinEvaluation,
  sessionRecord,
} from "../schema/evaluations";
import { person } from "../schema/people";
import { school } from "../schema/reference";
import { perjadin } from "../schema/travel";
import type { Person } from "./caller";

/**
 * **The concerns list** — every Aspect anyone Rated at or below the threshold, across all four
 * evaluation forms, newest first. The one query the whole Rating design exists to serve
 * (`docs/data-model.md`, "The concerns list in full"): a Cluster's problems are visible without
 * opening thirty Sessions.
 *
 * **Four sources, four unpivots, one union.** A Rating is a column beside its prose, not a row
 * in a child table — which is what makes the elaboration rule a CHECK — so reading them as a
 * list means unpivoting each source's Aspects into rows and keeping only the low ones. The
 * source is carried through, because a professor's 3 on `comprehension` and a student's 3 on
 * `instructor` are different claims and the four rubrics never collide.
 *
 * **A single low Rating is enough and is never averaged.** The `where r.rating <= …` keeps each
 * low Aspect as its own row; nothing here groups or means them.
 *
 * Open to anyone signed in, by ADR-0004 — a Rating carries no money — so no `requireStaff`.
 */

/** Which form a concern came from. Kept so the screen can filter and label by source. */
export type ConcernSource =
  | "class-record"
  | "session-record"
  | "participant"
  | "perjadin-evaluation";

/** One low Rating, with what it was against and who said it. */
export type Concern = {
  source: ConcernSource;
  /** The School and cohort, or the Perjadin's destination — what the row is about. */
  subject: string;
  /** The Aspect that was Rated low. Its key doubles as the column name. */
  aspect: string;
  rating: number;
  /** The filer's name, or the Participant's own typed name. */
  who: string;
  /** The prose filed with a low internal Rating. Null for a Participant, who owes none. */
  said: string | null;
  /** When it was filed — the list is ordered on this, newest first. */
  at: Date;
  /** The Session it came from, for the three Session-bound sources. Null for a Perjadin Evaluation. */
  sessionId: string | null;
  /** The Perjadin it came from, for a Perjadin Evaluation only. Null for the other three. */
  perjadinId: string | null;
};

/** The threshold as a literal, so the `<= 7` predicate matches each partial index's own `<= 7`. */
const THRESHOLD = sql.raw(String(CONCERN_AT_OR_BELOW));

/** `('aspect', src.aspect), …` — the VALUES list that unpivots one source's Aspect columns. */
function unpivot(alias: string, aspects: readonly string[]): SQL {
  return sql.raw(aspects.map((aspect) => `('${aspect}', ${alias}.${aspect})`).join(", "));
}

/**
 * `least(src.a, src.b, …)` for one source's Aspects — **the base-table predicate that hits the
 * partial index.** Each `*_concerns_idx` is `on least(…) where least(…) <= 7`; a query that only
 * filtered the unpivoted `r.rating` would scan the whole table, so this repeats the index's own
 * expression on the base row and the planner uses the index to skip rows with no concern.
 */
function least(alias: string, aspects: readonly string[]): SQL {
  return sql.raw(`least(${aspects.map((aspect) => `${alias}.${aspect}`).join(", ")})`);
}

/**
 * Every concern, newest first, in one round trip.
 *
 * The Aspect names are interpolated as SQL text rather than bound — a column name cannot be a
 * bind parameter, and they are the `as const` arrays `@sugt/domain` declares precisely so the
 * forms and this query are built from the same list the tables are. Nothing here ever sees a
 * value from a request. A name that drifts from its column fails a test, `school_support` first.
 */
export async function concerns(_caller: Person): Promise<Concern[]> {
  return db
    .select({
      source: sql<ConcernSource>`concerns.source`,
      subject: sql<string>`concerns.subject`,
      aspect: sql<string>`concerns.aspect`,
      rating: sql<number>`concerns.rating`.mapWith(Number),
      who: sql<string>`concerns.who`,
      said: sql<string | null>`concerns.said`,
      at: sql<Date>`concerns.at`,
      sessionId: sql<string | null>`concerns.session_id`,
      perjadinId: sql<string | null>`concerns.perjadin_id`,
    })
    .from(
      sql`(
        select 'class-record' as source, sch.name || ' · ' || c.class_kind as subject,
               r.aspect as aspect, r.rating as rating, p.full_name as who,
               c.problems as said, c.created_at as at,
               c.session_id as session_id, null::uuid as perjadin_id
          from ${classRecord} as c
          join ${session} as sn on sn.id = c.session_id
          join ${school} as sch on sch.id = sn.school_id
          join ${person} as p on p.id = c.filed_by_person_id
          cross join lateral (values ${unpivot("c", CLASS_RECORD_ASPECTS)}) as r(aspect, rating)
         where ${least("c", CLASS_RECORD_ASPECTS)} <= ${THRESHOLD} and r.rating <= ${THRESHOLD}

        union all

        select 'session-record' as source, sch.name as subject,
               r.aspect as aspect, r.rating as rating, p.full_name as who,
               s.problems as said, s.created_at as at,
               s.session_id as session_id, null::uuid as perjadin_id
          from ${sessionRecord} as s
          join ${session} as sn on sn.id = s.session_id
          join ${school} as sch on sch.id = sn.school_id
          join ${person} as p on p.id = s.filed_by_person_id
          cross join lateral (values ${unpivot("s", SESSION_RECORD_ASPECTS)}) as r(aspect, rating)
         where ${least("s", SESSION_RECORD_ASPECTS)} <= ${THRESHOLD} and r.rating <= ${THRESHOLD}

        union all

        select 'participant' as source, sch.name || ' · ' || f.class_kind as subject,
               r.aspect as aspect, r.rating as rating, f.name as who,
               f.comment as said, f.submitted_at as at,
               f.session_id as session_id, null::uuid as perjadin_id
          from ${participantFeedback} as f
          join ${session} as sn on sn.id = f.session_id
          join ${school} as sch on sch.id = sn.school_id
          cross join lateral (values ${unpivot("f", PARTICIPANT_FEEDBACK_ASPECTS)}) as r(aspect, rating)
         where ${least("f", PARTICIPANT_FEEDBACK_ASPECTS)} <= ${THRESHOLD} and r.rating <= ${THRESHOLD}

        union all

        select 'perjadin-evaluation' as source, pj.destination as subject,
               r.aspect as aspect, r.rating as rating, p.full_name as who,
               e.problems as said, e.created_at as at,
               null::uuid as session_id, e.perjadin_id as perjadin_id
          from ${perjadinEvaluation} as e
          join ${perjadin} as pj on pj.id = e.perjadin_id
          join ${person} as p on p.id = e.filed_by_person_id
          cross join lateral (values ${unpivot("e", PERJADIN_ASPECTS)}) as r(aspect, rating)
         where ${least("e", PERJADIN_ASPECTS)} <= ${THRESHOLD} and r.rating <= ${THRESHOLD}
      ) as concerns`,
    )
    .orderBy(sql`concerns.at desc, concerns.subject asc, concerns.aspect asc`);
}
