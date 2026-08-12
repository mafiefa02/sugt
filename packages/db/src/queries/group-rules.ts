import { STREAMS, type Stream } from "@sugt/domain";

/**
 * The two rules about a Group that **no CHECK can hold**, shared by the write that creates
 * one and the write that replaces one.
 *
 * Both are the same shape and ADR-0005's amendment names that shape: they are counts across
 * sibling rows, and a CHECK sees only the row it is written on. So they are validated where
 * a Group is submitted **whole** — which is why a Group is always submitted whole, and why
 * substituting one professor still sends the entire Group.
 *
 * Not on the package's public surface. No screen renders either of these; they are shared
 * logic beneath two modules, which is the case convention 3 makes room for.
 */

/** One Teaching Team member on the Group, and the Stream they cover. */
export type PlannedTeacher = {
  personId: string;
  stream: Stream;
};

/**
 * Anybody named more than once in a Group.
 *
 * `group_member`'s primary key is `(perjadin_id, person_id)`, so one person is on a trip
 * once — and `docs/product.md` says why that is the right answer rather than quietly
 * deduplicating: *"two professors genuinely cover all six teaching threads, because each
 * covers their Stream across all three Classes."* One professor on both Streams is somebody
 * covering six threads alone, which is a plan to question rather than a payload to tidy.
 *
 * Caught here because the alternative is the primary key refusing it, and a form filled in
 * honestly must not produce an error page.
 */
export function duplicatedTeachers(teachers: PlannedTeacher[]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const teacher of teachers) {
    if (seen.has(teacher.personId)) twice.add(teacher.personId);
    seen.add(teacher.personId);
  }
  return [...twice];
}

/**
 * Which Streams a Group leaves with no professor at all. Empty when both are covered.
 *
 * `docs/data-model.md` lists this as the one Group rule that is not declarative, and says
 * what the upgrade would be if raw SQL ever produced a Group it should have caught: a
 * `deferrable initially deferred` constraint trigger, rejected here only because wholesale
 * replacement made it unnecessary.
 */
export function streamsUncovered(teachers: PlannedTeacher[]): Stream[] {
  return STREAMS.filter((stream) => !teachers.some((teacher) => teacher.stream === stream));
}
