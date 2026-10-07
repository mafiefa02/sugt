import { formatTripDates } from "-/lib/perjadin-name";
import type { PreparationWeek, WeekPerjadin } from "@sugt/db/queries";
import type { PreparationItemLevel } from "@sugt/domain";

/**
 * **The Persiapan Luring tab's pure seam** (#423): which week a date is in, and the week's figures
 * folded from `preparationWeek`'s rows. No React, no DOM, no database — the suite drives it with
 * plain values, the way `preparation-derive.ts` and `dashboard-derive.ts` are driven.
 *
 * **A week is Monday to Saturday.** A Sunday belongs to the week that follows it, both as a day to
 * jump to and as a Perjadin's start: a trip starting Sunday 11 Okt is in the week of 12–17 Okt. So
 * every date names exactly one week, by its Monday.
 */

/** `YYYY-MM-DD` plus `days`, in UTC so no clock change shifts it. */
function addDays(isoDate: string, days: number): string {
  const ms = Date.parse(`${isoDate}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** A real calendar date in `YYYY-MM-DD`, or null. */
function calendarDate(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : null;
}

/** The Monday of the week `isoDate` is in; a Sunday's week is the one starting the next day. */
export function weekOf(isoDate: string): string {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return day === 0 ? addDays(isoDate, 1) : addDays(isoDate, 1 - day);
}

/** `weeks` weeks on from the week of Monday `monday` (back when negative). */
export function addWeeks(monday: string, weeks: number): string {
  return addDays(monday, weeks * 7);
}

/**
 * The starts a week holds: from the Sunday before its Monday through its Saturday, both included —
 * the range `preparationWeek` reads.
 */
export function weekStarts(monday: string): { from: string; until: string } {
  return { from: addDays(monday, -1), until: addDays(monday, 5) };
}

/** "Persiapan Luring 12–17 Okt 2026": the week's Monday to Saturday, as a trip's dates are written. */
export function weekTitle(monday: string): string {
  return `Persiapan Luring ${formatTripDates(monday, addDays(monday, 5))}`;
}

/**
 * The week the URL asks for (`?minggu=`), as its Monday: any real date names its week, so a link may
 * carry any day of it. Anything else is the week of `today`.
 */
export function parseWeekParam(value: string | string[] | undefined, today: string): string {
  const date = calendarDate(Array.isArray(value) ? value[0] : value);
  return weekOf(date ?? today);
}

/** The Dashboard URL that opens on this week's Persiapan Luring tab. */
export function weekHref(monday: string): string {
  return `/?minggu=${monday}`;
}

/** `done ÷ total` as a whole-number percent, 0 for nothing — `preparationPercent`'s rounding. */
function percent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

const LEVEL_ORDER: Record<PreparationItemLevel, number> = { semua: 0, cluster: 1, perjadin: 2 };

/** One row of the "Per item" panel. */
export type WeekItemRow = {
  itemId: string;
  label: string;
  /** Perjadins of the week that have it ticked. */
  done: number;
  /** Perjadins of the week whose checklist has it. */
  applies: number;
  percent: number;
};

/** One Perjadin of the week, with its own figure. */
export type WeekPerjadinRow = WeekPerjadin & { done: number; total: number; percent: number };

export type WeekFigures = {
  /** Ticked items over all items, summed over the week's Perjadins, each with its own list. */
  done: number;
  total: number;
  percent: number;
  perjadins: WeekPerjadinRow[];
  /** Every item on at least one of the week's lists: lowest percentage first, then checklist order. */
  items: WeekItemRow[];
};

/** Fold a week's rows into the tab's three blocks. Nothing is cached: every load folds afresh. */
export function deriveWeek(week: PreparationWeek): WeekFigures {
  const perjadins = week.perjadins.map((trip) => {
    const done = trip.preparation.filter((item) => item.checked).length;
    const total = trip.preparation.length;
    return { ...trip, done, total, percent: percent(done, total) };
  });

  const counts = new Map<string, { done: number; applies: number }>();
  for (const trip of week.perjadins) {
    for (const item of trip.preparation) {
      const count = counts.get(item.itemId) ?? { done: 0, applies: 0 };
      count.applies += 1;
      if (item.checked) count.done += 1;
      counts.set(item.itemId, count);
    }
  }

  const items = week.items
    .filter((item) => counts.has(item.itemId))
    .toSorted(
      (a, b) =>
        LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
        a.position - b.position ||
        a.itemId.localeCompare(b.itemId),
    )
    .map((item) => {
      const { done, applies } = counts.get(item.itemId)!;
      return {
        itemId: item.itemId,
        label: item.label,
        done,
        applies,
        percent: percent(done, applies),
      };
    })
    // A stable sort, so equal percentages keep the checklist order above.
    .toSorted((a, b) => a.percent - b.percent);

  const done = perjadins.reduce((sum, trip) => sum + trip.done, 0);
  const total = perjadins.reduce((sum, trip) => sum + trip.total, 0);
  return { done, total, percent: percent(done, total), perjadins, items };
}
