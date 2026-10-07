import { formatTripDates, perjadinName } from "-/lib/perjadin-name";
import type { CoveredSession } from "@sugt/db/queries";
import { formatSessionStartTime } from "@sugt/domain";
import Link from "next/link";

/**
 * **What a School already has on other trips** (#409) — one muted line per live offline Session,
 * wherever a Session is planned, so a Kelompok split across several Perjadins (ADR-0043) keeps track
 * of which Schools are covered elsewhere. Read-only: it never blocks a submission.
 *
 *     Sesi 1 · 12 Okt 2026, 08:00 WITA · Kelompok 10 · 12–13 Okt 2026
 *
 * The Sesi is the School's ADR-0027 rank, the time is in the School's zone the way the Jam Mulai
 * field shows it, and the trip's name (ADR-0044) links to it — in a new tab, since the note sits
 * inside a form being filled in, which following the link in place would throw away. `empty` is what
 * a School with none says — on a trip's own page, "none elsewhere" rather than "none at all".
 */
export function CoveredSessionsNote({
  sessions,
  empty,
}: {
  sessions: CoveredSession[];
  empty: string;
}) {
  if (sessions.length === 0) {
    return <p className="text-xs text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="grid gap-0.5 text-xs text-muted-foreground">
      {sessions.map((covered) => (
        <li key={`${covered.perjadin.id}-${covered.sesi}`}>
          Sesi {covered.sesi} · {formatTripDates(covered.heldOn, covered.heldOn)},{" "}
          {formatSessionStartTime(covered.startsAt, covered.timeZone)} ·{" "}
          <Link
            href={`/perjadin/${covered.perjadin.id}`}
            target="_blank"
            rel="noopener"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            {perjadinName(covered.perjadin)}
          </Link>
        </li>
      ))}
    </ul>
  );
}
