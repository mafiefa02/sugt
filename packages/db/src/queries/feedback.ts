import type { ClassKind, PerjadinEvaluationRole, SessionMode } from "@sugt/domain";
import { and, desc, eq, lt, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";

import { db } from "../client";
import { session } from "../schema/delivery";
import { participantFeedback, perjadinEvaluation } from "../schema/evaluations";
import { school } from "../schema/reference";
import { perjadin } from "../schema/travel";
import type { Person } from "./caller";

/**
 * **The Feedback screen's Peserta tab** — every Participant's submission, newest first, read
 * as a page rather than the whole set. This reads `participant_feedback` directly and for a
 * plain reason: `./participant-feedback.ts` is the write path and holds no read (ADR-0012 gives
 * a `ParticipantToken` write access and no read at all), so a screen that lists submissions
 * cannot route through it.
 *
 * **Why a page and not a one-round-trip whole set.** A submission is not rare: every Participant
 * of every delivered Session leaves one, so the set grows without bound and both the filters and
 * the paging live in the query rather than in memory on the screen. The three summary averages
 * are the exception (`participantFeedbackAverages` below): they are dataset-wide and unfiltered,
 * so they are one scalar read the page filters never touch.
 *
 * Open to anyone signed in, by ADR-0004 — feedback carries no money — so no `requireStaff`. The
 * `caller` is still first by convention 1 even though nothing here gates on it; it is named
 * `_caller` to say so, the way every read here does.
 *
 * **The Perjadin tab lives in this file too**, below its Peserta twin: the same keyset+BATCH+1
 * shape, the same `bound()` and `FeedbackFilterValue`, over `perjadin_evaluation` rather than
 * `participant_feedback`. It is the follow-up (#169) that retired the old `/concerns` page.
 */

/** The batch size — how many rows a page holds. Ten fits the card list without crowding it. */
const BATCH = 10;

/**
 * One filter's three-way choice. `all` is off; `le7` keeps rows at or below 7, `gt7` keeps
 * rows above it. The split is `<= 7` / `> 7` so the two non-`all` arms partition the scale
 * with no gap and no overlap — the same 7 the domain's concern threshold sits on.
 */
export type FeedbackFilterValue = "all" | "le7" | "gt7";

/**
 * The four filters, each independent and each ANDed with the others. `reviewType` gates on the
 * **row average** across the three Aspects; the other three gate on their own Aspect column.
 * A screen sends all four every time; `all` on any of them contributes no predicate.
 */
export type FeedbackFilters = {
  /** Gates on `(materials + instructor + relevance) / 3` — the row's overall standing. */
  reviewType: FeedbackFilterValue;
  instructor: FeedbackFilterValue;
  materials: FeedbackFilterValue;
  relevance: FeedbackFilterValue;
};

/** All filters off — the first page of everything, newest first. */
export const NO_FEEDBACK_FILTERS: FeedbackFilters = {
  reviewType: "all",
  instructor: "all",
  materials: "all",
  relevance: "all",
};

/**
 * Where the last page stopped: the 10th row's sort key. Keyset rather than offset so a page is
 * stable under inserts — a new submission arriving between two "load more" clicks shifts an
 * OFFSET and duplicates or drops a row, whereas a key does not move. `submittedAt` may arrive
 * as a `Date` (from a prior page) or a string (from a client round trip); the comparison binds
 * it either way.
 */
export type FeedbackCursor = {
  submittedAt: Date | string;
  id: string;
};

/** One Participant's submission, as the card renders it. */
export type ParticipantFeedbackRow = {
  id: string;
  /** The Participant's own typed name — referenced by nothing, exactly as stored. */
  name: string;
  classKind: ClassKind;
  schoolName: string;
  sessionMode: SessionMode;
  /** The Session's date as `YYYY-MM-DD`; a `date` column, so already a string. */
  heldOn: string;
  materials: number;
  instructor: number;
  relevance: number;
  /** `(materials + instructor + relevance) / 3`, computed in SQL as numeric and mapped to Number. */
  rowAverage: number;
  materialsComment: string | null;
  instructorComment: string | null;
  relevanceComment: string | null;
  submittedAt: Date;
};

/** The raw, unrounded row average — the expression `reviewType` gates on and the row carries. */
const rowAverageExpr = sql<number>`(${participantFeedback.materials} + ${participantFeedback.instructor} + ${participantFeedback.relevance}) / 3.0`;

/**
 * Turn one filter into its predicate, or `null` when it is `all`. `le7` → `<= 7`, `gt7` → `> 7`,
 * against whatever expression the caller passes — an Aspect column for three of the filters, the
 * row-average expression for `reviewType`.
 */
function bound(value: FeedbackFilterValue, expr: SQLWrapper): SQL | null {
  if (value === "le7") return sql`${expr} <= 7`;
  if (value === "gt7") return sql`${expr} > 7`;
  return null;
}

/**
 * One page of Participant Feedback, filtered and keyset-paginated, newest first.
 *
 * **The filters AND together and only the active ones appear in the WHERE.** Each `all` filter
 * drops out; what remains is conjoined. `reviewType` gates on the raw (unrounded) row average so
 * the cut matches the number the card shows before it is rounded for display.
 *
 * **Keyset paging over `(submitted_at desc, id desc)`.** The order is total — `id` breaks a tie
 * on the timestamp — so a cursor names exactly one row and the page after it is unambiguous. For
 * a descending order the "after this row" predicate is the row-value comparison
 * `submitted_at < cursor.submittedAt OR (submitted_at = cursor.submittedAt AND id < cursor.id)`,
 * written out rather than as SQL's `(a, b) < (x, y)` because Postgres row-value comparison and a
 * mixed collation are easy to get subtly wrong; spelling it out keeps it obviously correct.
 *
 * **Fetch one more than the batch to know whether there is a next page.** The query asks for
 * `BATCH + 1` rows; if it gets them, the extra one proves a next page exists — so the extra is
 * dropped from the result and the cursor is set to the last *kept* row (the 10th). The 11th row
 * never leaves this function, so it can never be shown twice.
 */
export async function participantFeedbackPage(
  _caller: Person,
  args: { filters: FeedbackFilters; cursor: FeedbackCursor | null },
): Promise<{ rows: ParticipantFeedbackRow[]; nextCursor: FeedbackCursor | null }> {
  const { filters, cursor } = args;

  // Each `all` filter yields `null` and is filtered out below; the active ones are conjoined. The
  // cursor predicate (when there is one) joins them, and `or()` can be `undefined`, so the list
  // holds both — a single `!= null` at the `where` drops either.
  const conditions: (SQL | null | undefined)[] = [
    bound(filters.reviewType, rowAverageExpr),
    bound(filters.instructor, participantFeedback.instructor),
    bound(filters.materials, participantFeedback.materials),
    bound(filters.relevance, participantFeedback.relevance),
  ];

  if (cursor !== null) {
    // The descending keyset predicate: strictly-older submissions, plus same-instant ties broken
    // by a smaller id — the mirror of the `desc, desc` order above. Built from drizzle operators
    // rather than a raw `sql` fragment so the timestamptz column's own driver mapping binds the
    // cursor value; a raw fragment hands the `Date` straight to the driver, which cannot serialise
    // it without the column's type. The cursor may arrive as a string (a client round trip), so it
    // is normalised to a `Date` first.
    const submittedAt =
      cursor.submittedAt instanceof Date ? cursor.submittedAt : new Date(cursor.submittedAt);
    conditions.push(
      or(
        lt(participantFeedback.submittedAt, submittedAt),
        and(
          eq(participantFeedback.submittedAt, submittedAt),
          lt(participantFeedback.id, cursor.id),
        ),
      ),
    );
  }

  const rows = await db
    .select({
      id: participantFeedback.id,
      name: participantFeedback.name,
      classKind: participantFeedback.classKind,
      schoolName: school.name,
      sessionMode: session.mode,
      heldOn: session.heldOn,
      // The smallint columns already read back as `number`; the row average is a numeric
      // expression, so only it needs the explicit `.mapWith(Number)`.
      materials: participantFeedback.materials,
      instructor: participantFeedback.instructor,
      relevance: participantFeedback.relevance,
      rowAverage: rowAverageExpr.mapWith(Number),
      materialsComment: participantFeedback.materialsComment,
      instructorComment: participantFeedback.instructorComment,
      relevanceComment: participantFeedback.relevanceComment,
      submittedAt: participantFeedback.submittedAt,
    })
    .from(participantFeedback)
    .innerJoin(session, eq(session.id, participantFeedback.sessionId))
    .innerJoin(school, eq(school.id, session.schoolId))
    .where(and(...conditions.filter((c): c is SQL => c != null)))
    .orderBy(desc(participantFeedback.submittedAt), desc(participantFeedback.id))
    .limit(BATCH + 1);

  // The (BATCH + 1)th row is the proof a next page exists, never a row to show. Drop it and hand
  // back a cursor on the last kept row; short of a full-plus-one batch there is no next page.
  if (rows.length > BATCH) {
    const kept = rows.slice(0, BATCH);
    const last = kept[BATCH - 1]!;
    return { rows: kept, nextCursor: { submittedAt: last.submittedAt, id: last.id } };
  }
  return { rows, nextCursor: null };
}

/**
 * **The three summary averages, dataset-wide and unfiltered.** The `avg()` runs over the whole
 * `participant_feedback` table and takes no filter argument on purpose: the summary cards are the
 * overall standing, so they must not move when the page's filters narrow the list below them.
 *
 * An empty table makes `avg()` return NULL; `coalesce(…, 0)` turns that into `0` so the caller
 * gets three numbers to format rather than a null to guard. Zero is outside the 1–10 scale, so
 * "0.0" on an empty dataset reads as "nothing yet" rather than as a real low score.
 */
export async function participantFeedbackAverages(
  _caller: Person,
): Promise<{ instructor: number; materials: number; relevance: number }> {
  const [row] = await db
    .select({
      instructor: sql<number>`coalesce(avg(${participantFeedback.instructor}), 0)`.mapWith(Number),
      materials: sql<number>`coalesce(avg(${participantFeedback.materials}), 0)`.mapWith(Number),
      relevance: sql<number>`coalesce(avg(${participantFeedback.relevance}), 0)`.mapWith(Number),
    })
    .from(participantFeedback);

  return row ?? { instructor: 0, materials: 0, relevance: 0 };
}

/**
 * The five Perjadin filters, each independent and each ANDed with the others — the Peserta tab's
 * four plus one, because a Perjadin has four Aspects. `reviewType` gates on the **row average**
 * across the ratings that are present (see `perjadinRowAverageExpr`); the other four gate on their
 * own Aspect column. A screen sends all five every time; `all` on any of them contributes no
 * predicate.
 */
export type PerjadinFeedbackFilters = {
  /** Gates on the present-ratings average — the row's overall standing. */
  reviewType: FeedbackFilterValue;
  lodging: FeedbackFilterValue;
  transport: FeedbackFilterValue;
  meals: FeedbackFilterValue;
  punctuality: FeedbackFilterValue;
};

/** All Perjadin filters off — the first page of everything, newest first. */
export const NO_PERJADIN_FEEDBACK_FILTERS: PerjadinFeedbackFilters = {
  reviewType: "all",
  lodging: "all",
  transport: "all",
  meals: "all",
  punctuality: "all",
};

/**
 * Where the last Perjadin page stopped: the 10th row's sort key. Keyset over `created_at` the way
 * the Peserta tab is over `submitted_at` — `perjadin_evaluation` has no `submitted_at`, its filed
 * instant is `created_at`. `createdAt` may arrive as a `Date` (a prior page) or a string (a client
 * round trip); the comparison binds it either way.
 */
export type PerjadinFeedbackCursor = {
  createdAt: Date | string;
  id: string;
};

/** One Perjadin Evaluation, as the card renders it. */
export type PerjadinFeedbackRow = {
  id: string;
  /** The filer's own typed name (ADR-0024), exactly as stored — referenced by nothing. */
  filedByName: string;
  /** The self-declared role, stored as one of three Indonesian words — shown as-is. */
  filedByRole: PerjadinEvaluationRole;
  /** The trip's destination line, from the joined `perjadin`. */
  destination: string;
  /** The trip's id, for the card's link to `/perjadin/[id]`. */
  perjadinId: string;
  /** `created_at` as `YYYY-MM-DD`, rendered in SQL — the analog of Peserta's `heldOn`. */
  createdOn: string;
  /** The one nullable Rating: a day trip with no hotel leaves it null and omits the row. */
  lodging: number | null;
  transport: number;
  meals: number;
  punctuality: number;
  /** The present-ratings average, computed in SQL as numeric and mapped to Number. */
  rowAverage: number;
  lodgingComment: string | null;
  transportComment: string | null;
  mealsComment: string | null;
  punctualityComment: string | null;
};

/**
 * The raw, unrounded Perjadin row average — **over the ratings that are present**. A day trip with
 * no hotel has a null `lodging`, so it must not count as a zero and must not divide by four: the
 * numerator `coalesce`s the absent hotel to 0 and the denominator drops it, so the average is over
 * three ratings when `lodging` is null and over four when it is not. `reviewType` gates on this,
 * and the row carries it.
 */
const perjadinRowAverageExpr = sql<number>`(${perjadinEvaluation.transport} + ${perjadinEvaluation.meals} + ${perjadinEvaluation.punctuality} + coalesce(${perjadinEvaluation.lodging}, 0)) / (3.0 + (case when ${perjadinEvaluation.lodging} is null then 0 else 1 end))`;

/**
 * One page of Perjadin Evaluations, filtered and keyset-paginated, newest first — the twin of
 * `participantFeedbackPage`, over `perjadin_evaluation` joined to `perjadin` for the destination
 * and the link target.
 *
 * **The five filters AND together and only the active ones appear in the WHERE.** Each `all` drops
 * out. `reviewType` gates on the present-ratings average so the cut matches the number the card
 * shows before rounding. **A null-`lodging` row is naturally excluded from both lodging arms**:
 * `lodging <= 7` and `lodging > 7` are each NULL for it, so a `lodging` filter never keeps a day
 * trip with no hotel — no explicit null guard is needed.
 *
 * **Keyset paging over `(created_at desc, id desc)`.** The order is total, so a cursor names one
 * row and the page after it is unambiguous — the same row-value comparison the Peserta tab spells
 * out. Fetch `BATCH + 1` to learn whether a next page exists; drop the sentinel and set the cursor
 * to the last kept row.
 */
export async function perjadinFeedbackPage(
  _caller: Person,
  args: { filters: PerjadinFeedbackFilters; cursor: PerjadinFeedbackCursor | null },
): Promise<{ rows: PerjadinFeedbackRow[]; nextCursor: PerjadinFeedbackCursor | null }> {
  const { filters, cursor } = args;

  const conditions: (SQL | null | undefined)[] = [
    bound(filters.reviewType, perjadinRowAverageExpr),
    bound(filters.lodging, perjadinEvaluation.lodging),
    bound(filters.transport, perjadinEvaluation.transport),
    bound(filters.meals, perjadinEvaluation.meals),
    bound(filters.punctuality, perjadinEvaluation.punctuality),
  ];

  if (cursor !== null) {
    // The descending keyset predicate: strictly-older evaluations, plus same-instant ties broken by
    // a smaller id — the mirror of the `desc, desc` order below. Built from drizzle operators so the
    // timestamptz column's own driver mapping binds the cursor value; normalised to a `Date` first
    // because the cursor may arrive as a string from a client round trip.
    const createdAt =
      cursor.createdAt instanceof Date ? cursor.createdAt : new Date(cursor.createdAt);
    conditions.push(
      or(
        lt(perjadinEvaluation.createdAt, createdAt),
        and(eq(perjadinEvaluation.createdAt, createdAt), lt(perjadinEvaluation.id, cursor.id)),
      ),
    );
  }

  const rows = await db
    .select({
      id: perjadinEvaluation.id,
      filedByName: perjadinEvaluation.filedByName,
      filedByRole: perjadinEvaluation.filedByRole,
      destination: perjadin.destination,
      perjadinId: perjadinEvaluation.perjadinId,
      // The filed instant rendered to a `YYYY-MM-DD` string in SQL — the analog of Peserta's
      // `heldOn`, which is a `date` column and already a string.
      createdOn: sql<string>`to_char(${perjadinEvaluation.createdAt}, 'YYYY-MM-DD')`.mapWith(
        String,
      ),
      // The smallint columns already read back as `number` (or null for `lodging`); the row average
      // is a numeric expression, so only it needs the explicit `.mapWith(Number)`.
      lodging: perjadinEvaluation.lodging,
      transport: perjadinEvaluation.transport,
      meals: perjadinEvaluation.meals,
      punctuality: perjadinEvaluation.punctuality,
      rowAverage: perjadinRowAverageExpr.mapWith(Number),
      lodgingComment: perjadinEvaluation.lodgingComment,
      transportComment: perjadinEvaluation.transportComment,
      mealsComment: perjadinEvaluation.mealsComment,
      punctualityComment: perjadinEvaluation.punctualityComment,
      createdAt: perjadinEvaluation.createdAt,
    })
    .from(perjadinEvaluation)
    .innerJoin(perjadin, eq(perjadin.id, perjadinEvaluation.perjadinId))
    .where(and(...conditions.filter((c): c is SQL => c != null)))
    .orderBy(desc(perjadinEvaluation.createdAt), desc(perjadinEvaluation.id))
    .limit(BATCH + 1);

  // The (BATCH + 1)th row proves a next page exists; it is never shown. Drop it and hand back a
  // cursor on the last kept row; short of a full-plus-one batch there is no next page. The row
  // objects carry `createdAt` only to seed the cursor — the caller's `PerjadinFeedbackRow` does not.
  if (rows.length > BATCH) {
    const kept = rows.slice(0, BATCH);
    const last = kept[BATCH - 1]!;
    return {
      rows: kept.map(({ createdAt: _createdAt, ...row }) => row),
      nextCursor: { createdAt: last.createdAt, id: last.id },
    };
  }
  return { rows: rows.map(({ createdAt: _createdAt, ...row }) => row), nextCursor: null };
}

/**
 * **The four Perjadin summary averages, dataset-wide and unfiltered.** The `avg()` runs over the
 * whole `perjadin_evaluation` table and takes no filter argument, so the summary cards read the
 * overall standing and never move when the page's filters narrow the list below them.
 *
 * `avg(lodging)` ignores NULL naturally — a day trip with no hotel is not a zero in the hotel
 * average, it is simply not in it. `coalesce(…, 0)` turns the empty-table NULL into `0` so the
 * caller gets four numbers to format; "0.0" reads as "nothing yet" rather than a real low score.
 */
export async function perjadinFeedbackAverages(
  _caller: Person,
): Promise<{ lodging: number; transport: number; meals: number; punctuality: number }> {
  const [row] = await db
    .select({
      lodging: sql<number>`coalesce(avg(${perjadinEvaluation.lodging}), 0)`.mapWith(Number),
      transport: sql<number>`coalesce(avg(${perjadinEvaluation.transport}), 0)`.mapWith(Number),
      meals: sql<number>`coalesce(avg(${perjadinEvaluation.meals}), 0)`.mapWith(Number),
      punctuality: sql<number>`coalesce(avg(${perjadinEvaluation.punctuality}), 0)`.mapWith(Number),
    })
    .from(perjadinEvaluation);

  return row ?? { lodging: 0, transport: 0, meals: 0, punctuality: 0 };
}
