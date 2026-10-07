import type { DirectoryPerjadin } from "@sugt/db/queries";

/** The fields the `/perjadin` search reads — a subset of `DirectoryPerjadin`. */
export type SearchablePerjadin = Pick<
  DirectoryPerjadin,
  "subClusterName" | "picFullName" | "pengajarNames" | "groupMemberNames" | "schoolNames"
>;

/**
 * **Whether a trip matches the `/perjadin` search box** (#334) — a case-insensitive substring of
 * its **Kelompok** (the Sub-Cluster name, the first half of its name — ADR-0044), its **PIC** name,
 * or any of its **pengajar**, **Group-member** or **School** names. The same trip fields `/log`'s
 * search reads; neither matches the dates, which the list sorts by instead. A blank query matches
 * every trip. A plain function so the rule is testable without React.
 */
export function matchesPerjadinSearch(trip: SearchablePerjadin, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  return [
    trip.subClusterName,
    trip.picFullName,
    ...trip.pengajarNames,
    ...trip.groupMemberNames,
    ...trip.schoolNames,
  ].some((field) => field.toLowerCase().includes(needle));
}
