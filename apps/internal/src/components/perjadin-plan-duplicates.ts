/**
 * **Rencanakan Perjadin's client-side duplicate check** (#342, ADR-0038).
 *
 * One live offline Session per School per date and start time: parallel rooms are recorded as one
 * Session whose Teaching Team lists everyone who taught, so a second row at the same School and
 * moment is a mistake. `planPerjadin` refuses that payload as `duplicate-session` and
 * `session_no_duplicate_offline_per_school_per_perjadin` refuses it at the database; this catches
 * it before submit so the form can flag the row itself. A plain function rather than a hook so the
 * rule is testable without React, the same reason `acquittal-transactions-sort.ts` is one.
 *
 * Two *different* Schools at one moment are not flagged here — that is the `session-time-clash`
 * rule, which the server reports whole.
 */

/** The fields of a form Session row this check reads. */
type SessionSlot = { date: string; time: string };

/**
 * The rows that repeat an earlier row's date and time at the same School, keyed
 * `${schoolId}-${index}`. The first row in a slot is the Session; every later one is the duplicate
 * flagged. A row whose date or time is still blank has no slot yet and is never flagged — the
 * submit guard already holds it back.
 */
export function duplicateSessionRows(sessions: Record<string, SessionSlot[]>): Set<string> {
  const flagged = new Set<string>();
  for (const [schoolId, list] of Object.entries(sessions)) {
    const seen = new Set<string>();
    list.forEach((draft, index) => {
      if (draft.date === "" || draft.time === "") return;
      const slot = `${draft.date} ${draft.time}`;
      if (seen.has(slot)) flagged.add(`${schoolId}-${index}`);
      seen.add(slot);
    });
  }
  return flagged;
}
