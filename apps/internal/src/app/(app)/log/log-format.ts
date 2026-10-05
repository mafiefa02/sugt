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
