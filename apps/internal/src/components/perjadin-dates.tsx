/**
 * A Perjadin's date range — **read-only display now** (ADR-0021).
 *
 * The range is the departure→return span, not a field of its own: it is derived from the leg dates
 * and edited by editing those legs in `PerjadinLogistics`. So this no longer carries a "move dates"
 * editor — `movePerjadinDates` and its auto-shift retired with the standalone range — and shows the
 * window and nothing more. `starts_on`/`ends_on` are still stored (stored-but-derived), so the page
 * reads them straight off the trip; this just renders them.
 */
function PerjadinDates({ startsOn, endsOn }: { startsOn: string; endsOn: string }) {
  return (
    <p className="text-sm text-muted-foreground tabular-nums">
      {startsOn} – {endsOn}
    </p>
  );
}

export { PerjadinDates };
