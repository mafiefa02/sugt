import { TOTAL_SESSIONS_PER_SCHOOL } from "@sugt/domain";

import type { DeliveryPayload, ScopeSchool } from "-/lib/aggregates-types";

/**
 * **The figures the site derives rather than fetches.**
 *
 * `docs/product.md` is emphatic that a count never travels beside the list it summarises: `42 Sekolah`
 * is `schools.length`, `15 provinsi` is the number of distinct Provinces among them, and the delivery
 * denominator is `10 × schools.length` — each computed by the reader so it can never disagree with the
 * data it describes. These are the pure helpers that do that computing.
 */

/** How many distinct Provinces the Schools span — the `15 provinsi` beside `42 Sekolah`. */
export function provinceCount(schools: ScopeSchool[]): number {
  return new Set(schools.map((school) => school.provinceCode)).size;
}

/**
 * The total possible Sessions across every School — the denominator delivery is reported against.
 * `TOTAL_SESSIONS_PER_SCHOOL` is a `@sugt/domain` constant, not a figure on the wire, for the reason
 * `./aggregates-types.ts` gives: a fixed set sent twice is a duplication waiting to drift.
 */
export function deliveryDenominator(schoolCount: number): number {
  return TOTAL_SESSIONS_PER_SCHOOL * schoolCount;
}

/**
 * **Whether there is any delivery to report yet.** The delivery band renders only when this is true,
 * so launch day shows scope with no `0 Sesi terlaksana` gap — the screen ADR-0001 names as worse than
 * publishing nothing. It is computed from the payload, never read off a boolean flag that could
 * disagree with the number beside it.
 */
export function hasDelivery(delivery: DeliveryPayload): boolean {
  return delivery.deliveredTotal > 0;
}
