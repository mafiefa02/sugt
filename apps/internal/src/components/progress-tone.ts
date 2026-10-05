/**
 * **The three-way progress tone** a count badge wears (#114, #343): neutral before anything is done,
 * amber part-way, emerald once everything is. One helper for the Persiapan pill on `/perjadin` and on
 * `/pendamping`, and for the Terlaksana badge — so the screens read an `x/N` the same way.
 *
 * `0/0` is neutral: zero done is the first test, so an empty count never reads as complete.
 */
export function progressTone(done: number, total: number): string {
  if (done === 0) return "bg-muted text-muted-foreground";
  if (done >= total)
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
  return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
}
