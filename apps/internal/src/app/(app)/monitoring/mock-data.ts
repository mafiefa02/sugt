import type { Warning } from "./monitoring-state";

/**
 * **Every figure `/monitoring` renders, in one place, and every one of them is invented.**
 *
 * This is a presentational scaffold (#178); wiring it to real data is #177. The values here are
 * illustrative and intentionally diverge from — and in places contradict — the domain: the offline
 * overdue count is not 2 in any real sense, Sessions carry no ordinal (the "Sesi 1/2/…" labels are
 * cosmetic), and there is no programme budget figure anywhere in the schema. The types mirror the
 * shapes an eventual real query would return, so #177 can swap the source without touching the view.
 * See CONTEXT.md → Open questions → /monitoring.
 */

/** The banner/accordion warnings. Starts with one active warning. */
export type MockWarning = Warning;

export const WARNINGS: MockWarning[] = [
  {
    id: "luring-sesi-1-overdue",
    message: "Periode Luring Sesi 1 telah berakhir, namun Sesi 1 belum terlaksana pada 2 sekolah.",
  },
];

/** The two headline KPIs. `activitiesPercent` is a 0–100 number; budget carries its own percent. */
export type MockKpi = {
  activitiesPercent: number;
  budget: { usedIdr: number; totalIdr: number; percent: number };
};

export const KPI: MockKpi = {
  activitiesPercent: 12,
  budget: { usedIdr: 29_560_000, totalIdr: 15_000_000_000, percent: 0.2 },
};

/** One step in the delivery timeline. */
export type MockTimelineStep = {
  label: string;
  window: string;
  status: "completed" | "pending";
};

export const TIMELINE: MockTimelineStep[] = [
  { label: "Luring Sesi 1", window: "2026-09-15 - 2026-10-15", status: "completed" },
  { label: "Luring Sesi 2", window: "2026-10-15 - 2026-11-15", status: "pending" },
];

/** One matrix row: a session label and four "completed/total" cells, one per Klaster (1..4). */
export type MockMatrixRow = { session: string; cells: string[] };

export const LURING_MATRIX: MockMatrixRow[] = [
  { session: "Sesi 1", cells: ["5/6", "17/17", "11/11", "7/8"] },
  { session: "Sesi 2", cells: ["2/6", "1/17", "1/11", "1/8"] },
];

export const DARING_MATRIX: MockMatrixRow[] = [
  { session: "Sesi 1", cells: ["5/6", "17/17", "11/11", "7/8"] },
  { session: "Sesi 2", cells: ["2/6", "1/17", "1/11", "1/8"] },
  { session: "Sesi 3", cells: ["0/6", "0/17", "0/11", "0/8"] },
  { session: "Sesi 4", cells: ["0/6", "0/17", "0/11", "0/8"] },
  { session: "Sesi 5", cells: ["0/6", "0/17", "0/11", "0/8"] },
  { session: "Sesi 6", cells: ["0/6", "0/17", "0/11", "0/8"] },
];
