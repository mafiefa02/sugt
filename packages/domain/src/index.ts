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
 * A Session Record carries one part per Class per Stream — six in all. Each is
 * owed by the Teaching Team member who taught that Stream.
 */
export const SESSION_RECORD_PART_COUNT = CLASS_KINDS.length * STREAMS.length;
