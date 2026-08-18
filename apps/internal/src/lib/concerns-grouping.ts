import type { Concern, ConcernSource } from "@sugt/db/queries";

/** One author's concerns from one source — the unit the list groups a card run under. */
export type ConcernGroup = {
  source: ConcernSource;
  /** The filer's name, or the Participant's own typed name. */
  who: string;
  concerns: Concern[];
};

/**
 * Group concerns by the author who filed them, keyed `(source, who)`.
 *
 * **The key carries the source, so a Participant "Budi" and a professor "Budi" never merge** — a
 * typed Participant name is not an identity, and the four rubrics never collide, which is the same
 * reason the list keeps sources on separate tabs. A nested map (`source` then `who`) keys the pair
 * without concatenating the two into one string, so no separator has to be proven safe against a
 * name a Participant typed.
 *
 * **Order falls out of the input being newest-first.** `concerns` arrives ordered `at desc` from
 * the query, so the first time a `(source, who)` is seen is that group's most-recent concern —
 * pushing each new group onto `order` as it appears gives newest-group-first, and appending later
 * concerns in arrival order keeps each group newest-first within. No sort, and `at` is never read.
 */
export function groupConcernsByAuthor(concerns: Concern[]): ConcernGroup[] {
  const order: ConcernGroup[] = [];
  const bySource = new Map<ConcernSource, Map<string, ConcernGroup>>();
  for (const concern of concerns) {
    let byWho = bySource.get(concern.source);
    if (!byWho) {
      byWho = new Map();
      bySource.set(concern.source, byWho);
    }
    let group = byWho.get(concern.who);
    if (!group) {
      group = { source: concern.source, who: concern.who, concerns: [] };
      byWho.set(concern.who, group);
      order.push(group);
    }
    group.concerns.push(concern);
  }
  return order;
}
