import { formatTripDates, perjadinName } from "-/lib/perjadin-name";
import type { SchoolBookedOnAnotherPerjadin } from "@sugt/db/queries";
import { formatSessionStartTime } from "@sugt/domain";
import Link from "next/link";

/**
 * **The double-booking refusal** (#408, ADR-0043), said the same way wherever a Session is planned,
 * added, edited or moved: the School, the moment in the School's own zone — the way the Jam Mulai
 * field shows it — and the other trip by its name (ADR-0044), linked so it can be opened and the
 * clash resolved there.
 *
 *     SMAN 1 Bontang sudah punya Sesi luring pada 12 Okt 2026 pukul 08:00 WITA di Perjadin
 *     Kelompok 10 · 12–13 Okt 2026.
 */
export function SchoolBookedElsewhere({ refusal }: { refusal: SchoolBookedOnAnotherPerjadin }) {
  return (
    <>
      {refusal.schoolName} sudah punya Sesi luring pada{" "}
      {formatTripDates(refusal.heldOn, refusal.heldOn)} pukul{" "}
      {formatSessionStartTime(refusal.startsAt, refusal.timeZone)} di Perjadin{" "}
      <Link
        href={`/perjadin/${refusal.perjadin.id}`}
        className="font-semibold underline underline-offset-2"
      >
        {perjadinName(refusal.perjadin)}
      </Link>
      .
    </>
  );
}
