/**
 * The one rule about a Group that **no CHECK can hold**, shared by the write that creates
 * one and the writes that edit one.
 *
 * It is a count across sibling rows, and a CHECK sees only the row it is written on. So it is
 * validated where a Group is submitted — planning a trip, and editing its Staff on the detail
 * screen — the same shape ADR-0005's amendment names.
 *
 * Not on the package's public surface. No screen renders it; it is shared logic beneath two
 * modules, which is the case convention 3 makes room for.
 *
 * **This once carried the Teaching-Team rules too** — `streamsUncovered` and `duplicatedTeachers`
 * — but the Teaching Team have left the Group entirely for `perjadin_teacher` trip-scoped names
 * (ADR-0020), so a Group is Staff and only Staff and those rules are gone with the professors.
 */

/**
 * The extra Staff a Group names more than once, or that repeat the PIC. Empty when the up-to-ten
 * extra Staff are all distinct and none is the PIC.
 *
 * The `(perjadin_id, person_id)` primary key holds each person once, so a repeat would be a key
 * violation from inside the transaction rather than a message a form can show. The PIC is always on
 * the Group, so an extra Staff slot naming them is a repeat too — which is why `picPersonId` seeds
 * the `seen` set.
 *
 * Shared by the write that plans a trip and the one that sets its Staff on the detail screen.
 */
export function duplicatedStaff(picPersonId: string, extraStaffPersonIds: string[]): string[] {
  const seen = new Set<string>([picPersonId]);
  const twice = new Set<string>();
  for (const personId of extraStaffPersonIds) {
    if (seen.has(personId)) twice.add(personId);
    seen.add(personId);
  }
  return [...twice];
}
