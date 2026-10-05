import {
  ACTIVITY_LOG_AKSI_FILTERS,
  type ActivityLogAksiFilter,
  type ActivityLogFilters,
} from "@sugt/db/queries";

/** `/log`'s query string as Next hands it over. */
export type LogSearchParams = Record<string, string | string[] | undefined>;

/** A real calendar date in `YYYY-MM-DD`, or null — so `?dari=2026-02-30` filters nothing. */
function calendarDate(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : null;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * **The filters `/log`'s URL asks for** (`?q=&aksi=&dari=&sampai=&page=`), so a view can be
 * bookmarked. Anything malformed is dropped rather than refused: a bad `aksi` is Semua, a bad date
 * is no bound, a bad page is the first.
 */
export function parseLogParams(params: LogSearchParams): ActivityLogFilters {
  const aksi = first(params.aksi);
  const page = Number.parseInt(first(params.page) ?? "", 10);
  return {
    q: first(params.q)?.trim() ?? "",
    aksi:
      aksi && Object.hasOwn(ACTIVITY_LOG_AKSI_FILTERS, aksi)
        ? (aksi as ActivityLogAksiFilter)
        : null,
    dari: calendarDate(first(params.dari)),
    sampai: calendarDate(first(params.sampai)),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** The `/log` URL for these filters on another page, carrying only what is set. */
export function logHref(filters: ActivityLogFilters, page: number): string {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.aksi) query.set("aksi", filters.aksi);
  if (filters.dari) query.set("dari", filters.dari);
  if (filters.sampai) query.set("sampai", filters.sampai);
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return search ? `/log?${search}` : "/log";
}

const MONTH = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" });

/** A `YYYY-MM-DD` as its day, short month and year: `[12, "Okt", 2026]`. */
function parts(isoDate: string): [number, string, number] {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return [date.getUTCDate(), MONTH.format(date), date.getUTCFullYear()];
}

/**
 * A Perjadin's dates, short: `12–15 Okt 2026`, `30 Sep – 2 Okt 2026`, `30 Des 2026 – 2 Jan 2027`,
 * or `12 Okt 2026` for a one-day trip.
 */
export function formatTripDates(startsOn: string, endsOn: string): string {
  const [startDay, startMonth, startYear] = parts(startsOn);
  const [endDay, endMonth, endYear] = parts(endsOn);
  if (startsOn === endsOn) return `${startDay} ${startMonth} ${startYear}`;
  if (startYear !== endYear) {
    return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
  }
  if (startMonth !== endMonth)
    return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${endYear}`;
  return `${startDay}–${endDay} ${endMonth} ${endYear}`;
}

const WAKTU = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Jakarta",
});

/** The Waktu column: when the act happened in the app, in WIB — `14 Okt 2026, 08.05`. */
export function formatWaktu(when: Date): string {
  return WAKTU.format(when);
}
