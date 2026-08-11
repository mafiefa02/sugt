/**
 * The Programme's settled vocabulary, as fixed sets rather than database rows.
 *
 * Everything here is true independently of where Programme data is stored, so it
 * is safe for both apps to depend on — including the public app, which holds no
 * database credentials (see `docs/adr/0002-two-apps-in-a-pnpm-workspace.md`).
 * Anything that requires reading a Session Record or a Perjadin Report belongs in
 * a data-access package the public app does not declare, not here.
 *
 * Terms follow `CONTEXT.md`. Don't add a name to this file that isn't in the
 * glossary.
 */

/** The two subject-matter divisions inside the STEM & Research Track. */
export const STREAMS = ["STEM", "Research"] as const;
export type Stream = (typeof STREAMS)[number];

/**
 * Which of the three Classes a School runs. A Class is a cohort of people at one
 * School; this names which cohort. Every Class is taught in both Streams, so the
 * division here is by audience, never by Stream.
 */
export const CLASS_KINDS = ["GTK", "MS", "Student"] as const;
export type ClassKind = (typeof CLASS_KINDS)[number];

/** How a Session is delivered. Offline Sessions happen during a Perjadin; online ones have none. */
export const SESSION_MODES = ["offline", "online"] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

/**
 * A Session's lifecycle. It comes into existence already `arranged` — never before, see
 * `docs/adr/0006-sessions-are-created-when-arranged.md` — and is then delivered or
 * cancelled. A cancelled Session counts for nothing towards progress but stays visible,
 * because a School that was planned for and missed looks different from one nobody has
 * reached yet.
 */
export const SESSION_STATUSES = ["arranged", "delivered", "cancelled"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/**
 * The two roles in the internal tool. The Programme's leadership are senior
 * Staff, not a third role — see `docs/adr/0004-delivery-data-is-open-internally-money-is-not.md`.
 */
export const ROLES = ["Staff", "Teaching Team"] as const;
export type Role = (typeof ROLES)[number];

/**
 * How many Sessions each School receives, by mode. The same for every School and
 * fixed from the start, which is what lets progress read as "3 of 10 delivered"
 * without any planned Sessions existing
 * (see `docs/adr/0006-sessions-are-created-when-arranged.md`).
 */
export const SESSIONS_PER_SCHOOL = {
  offline: 4,
  online: 6,
} as const satisfies Record<SessionMode, number>;

/** Total Sessions a School receives across both modes. */
export const TOTAL_SESSIONS_PER_SCHOOL = SESSIONS_PER_SCHOOL.offline + SESSIONS_PER_SCHOOL.online;

/**
 * What a Class Record Rates — filed by the Teaching Team member who taught that Class.
 *
 * The first three are judgements only the person at the front can make: whether the cohort
 * followed it, took part, and arrived prepared. Deliberately absent from the Participant
 * form, because a room grading its own readiness is not evidence.
 *
 * Note these name **columns**, not values — unlike `CLASS_KINDS` and `STREAMS`, which are
 * stored as strings. The arrays exist so each form and the concerns query are built from
 * the same list the table is.
 */
export const CLASS_RECORD_ASPECTS = [
  "comprehension",
  "participation",
  "readiness",
  "materials",
  "delivery",
  "facilities",
  "timing",
] as const;
export type ClassRecordAspect = (typeof CLASS_RECORD_ASPECTS)[number];

/**
 * What a Session Record Rates — filed by the PIC, who organised the visit and taught none of
 * it. Every one is something an organiser can see from the back of the room; nothing here
 * asks them to judge teaching they did not deliver.
 */
export const SESSION_RECORD_ASPECTS = [
  "facilities",
  "turnout",
  "school_support",
  "timing",
  "coordination",
] as const;
export type SessionRecordAspect = (typeof SESSION_RECORD_ASPECTS)[number];

/**
 * What a Participant Rates. `materials` and `instructor` overlap with the Class Record on
 * purpose — that overlap is what lets the professor's view be set against the room's.
 */
export const PARTICIPANT_FEEDBACK_ASPECTS = ["materials", "instructor", "relevance"] as const;
export type ParticipantFeedbackAspect = (typeof PARTICIPANT_FEEDBACK_ASPECTS)[number];

/**
 * What a Perjadin Evaluation Rates — the logistics of the trip, not the teaching.
 */
export const PERJADIN_ASPECTS = ["lodging", "transport", "meals", "punctuality"] as const;
export type PerjadinAspect = (typeof PERJADIN_ASPECTS)[number];

/**
 * How many Class Records a Session expects: two professors, one per Stream, each filing for
 * all three Classes. Nothing is blocked when they are missing — this is the denominator for
 * the list of who to chase, the same way `TOTAL_SESSIONS_PER_SCHOOL` is the denominator for
 * progress with no planned rows existing.
 */
export const CLASS_RECORDS_PER_SESSION = STREAMS.length * CLASS_KINDS.length;

/**
 * The bounds of a Rating: the score one person gives one Aspect. Ratings are the only
 * thing in the system anything counts.
 */
export const RATING_MIN = 1;
export const RATING_MAX = 10;

/**
 * An Aspect reaches the concerns list when **any single** Rating of it is at or below
 * this — from a Session Record, a Perjadin Evaluation or Participant Feedback. Never an
 * average: one person scoring something low is the signal, and averaging it away under
 * three cheerful scores defeats the reason more than one person is asked.
 *
 * The same number also decides when prose becomes mandatory, so raising it costs writing
 * as well as screen space. Any threshold is invented; this one is a named constant rather
 * than a literal so it is findable — but note it appears in **index predicates**, so
 * changing it needs a migration and not just an edit here.
 * See `docs/adr/0006-sessions-are-created-when-arranged.md`.
 */
export const CONCERN_AT_OR_BELOW = 7;

/**
 * How long a Session's Participant Feedback link stays open. Counted from when the token
 * is issued, which is at the end of the Session by construction — the link is the QR code
 * shown in the room, so "24 hours after the Session ended" and "24 hours after issue" are
 * the same moment without storing a Session end time.
 */
export const FEEDBACK_TOKEN_LIFETIME_HOURS = 24;

/**
 * A Perjadin Report is due this many days after the Group gets back, so the deadline is
 * derived from the Perjadin's end date and never stored. Nothing is gated on it — it is
 * shown as days remaining and that is all.
 */
export const REPORT_DEADLINE_DAYS_AFTER_RETURN = 2;
