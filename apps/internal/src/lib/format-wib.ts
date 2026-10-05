/**
 * `2026-10-05 09:30 WIB` — an instant as a wall-clock time in WIB, in the ISO form every date in the
 * internal app reads in (#166). Pinned to `Asia/Jakarta`, so the server's own zone never shows.
 */
export function formatWib(when: Date): string {
  const formatted = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    dateStyle: "short",
    timeStyle: "short",
  }).format(when);
  return `${formatted} WIB`;
}
