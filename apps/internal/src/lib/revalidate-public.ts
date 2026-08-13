/**
 * **The seam to `@sugt/public`'s revalidation — a stub until [#37] builds the route.**
 *
 * Publishing or withdrawing a Story sets or clears `published_at` in this app's database, but the
 * public site serves its last good payload indefinitely (ADR-0008's endpoint contract), so it has
 * to be told to refresh — otherwise a withdrawn photograph stays up. The refresh happens in order,
 * **detail entry → list → School page**, so the list never points at a page the detail refresh has
 * not reached yet.
 *
 * **That route is [#37]'s and does not exist yet.** This function is the one place the cross-app
 * call will live. Today it performs no network call and reports every step as pending #37, so the
 * publish flow is complete end to end and #37 drops in behind this signature. When it lands, this
 * is where the `fetch` to `@sugt/public`'s revalidate endpoint goes, turning each step's `outcome`
 * into a real `"ok"` or `"failed"`.
 *
 * [#37]: https://github.com/mafiefa02/sugt/issues/37
 */

/** The three pages a publish or withdrawal invalidates, in the order they must run. */
export type RevalidationTarget = "detail" | "list" | "school";

export type RevalidationStepReport = {
  target: RevalidationTarget;
  /** What the operator sees for this step, in Indonesian to match the surface. */
  label: string;
  /**
   * `"pending-issue-37"` while the route is unbuilt. #37 replaces this with `"ok"` on a 2xx and
   * `"failed"` otherwise, and the flow already renders all three.
   */
  outcome: "pending-issue-37";
};

export type RevalidationReport = {
  /** `true` while #37 is unbuilt: no page was actually refreshed, and the UI says so plainly. */
  pending: boolean;
  steps: RevalidationStepReport[];
};

const STEPS: { target: RevalidationTarget; label: string }[] = [
  { target: "detail", label: "Memuat ulang halaman Cerita" },
  { target: "list", label: "Memuat ulang daftar" },
  { target: "school", label: "Memuat ulang halaman Sekolah" },
];

/**
 * Report the revalidation of one Story's public pages. `slug` is the Story's public path segment,
 * carried through so #37's real call has it without another query.
 */
export async function revalidatePublicStory(_input: { slug: string }): Promise<RevalidationReport> {
  return {
    pending: true,
    steps: STEPS.map((step) => ({ ...step, outcome: "pending-issue-37" as const })),
  };
}
