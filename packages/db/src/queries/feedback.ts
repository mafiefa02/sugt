import type { ClassKind, SessionMode } from "@sugt/domain";
import { and, desc, eq, lt, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";

import { db } from "../client";
import { session } from "../schema/delivery";
import { participantFeedback } from "../schema/evaluations";
import { school } from "../schema/reference";
import type { Person } from "./caller";

/**
 * **The Feedback screen's Peserta tab** — every Participant's submission, newest first, read
 * as a page rather than the whole set. This reads `participant_feedback` directly, the way
 * `./concerns.ts` does and for the same reason: `./participant-feedback.ts` is the write path
 * and holds no read (ADR-0012 gives a `ParticipantToken` write access and no read at all), so
 * a screen that lists submissions cannot route through it.
 *
 * **Why a page and not the concerns list's one-round-trip whole set.** A concern is rare — a
 * low Rating — and the whole set fits in memory, so that screen filters client-side. A
 * submission is not rare: every Participant of every delivered Session leaves one, so the set
 * grows without bound and both the filters and the paging live in the query. The three summary
 * averages are the exception (`participantFeedbackAverages` below): they are dataset-wide and
 * unfiltered, so they are one scalar read the page filters never touch.
 *
 * Open to anyone signed in, by ADR-0004 — feedback carries no money — so no `requireStaff`. The
 * `caller` is still first by convention 1 even though nothing here gates on it; it is named
 * `_caller` to say so, the way `concerns(_caller)` does.
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
