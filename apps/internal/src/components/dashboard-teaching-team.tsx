import { MODE_LABELS } from "-/components/session-labels";
import type { TeachingTeamDashboard } from "@sugt/db/queries";
import { formatSessionStartTimeWithWib } from "@sugt/domain";
import Link from "next/link";

/**
 * **Beranda — Teaching Team.** A professor's landing: the Class Records they still owe, the
 * Sessions they are yet to teach, and the trips they are on. **Money-free throughout** (#40).
 *
 * The tone is counts, not claims: the owed list is headed "Tanpa tenggat — daftar untuk dikejar",
 * there are no deadlines and nothing is red. Empty states read as *nothing has happened yet*, not
 * as *nothing loaded*.
 */
function DashboardTeachingTeam({ dashboard }: { dashboard: TeachingTeamDashboard }) {
  return (
    <div className="flex min-h-full flex-col gap-8 p-7">
      <header>
        <p className="text-sm text-muted-foreground">Selamat datang kembali,</p>
        <h1 className="font-heading text-xl font-medium">{dashboard.fullName}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Teaching Team
          {dashboard.streams.length > 0 && <> · Stream {dashboard.streams.join(" & ")}</>}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          value={dashboard.owed.length}
          label="Class Record belum diisi"
        />
        <StatTile
          value={dashboard.upcoming.length}
          label="Sesi Anda mendatang"
        />
        <StatTile
          value={dashboard.activeTripCount}
          label="Perjadin Group aktif"
        />
      </div>

      <section>
        <h2 className="font-heading text-sm font-medium">Perlu Anda isi</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Tanpa tenggat — daftar untuk dikejar.
        </p>

        {dashboard.owed.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Belum ada Class Record yang menunggu. Daftar ini terisi setelah Sesi Anda terlaksana.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {dashboard.owed.map((entry) => (
              <li
                key={`${entry.sessionId}-${entry.classKind}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border px-4 py-2.5 text-sm"
              >
                <span className="font-medium">{entry.schoolName}</span>
                <span className="text-muted-foreground">Kelas {entry.classKind}</span>
                <span className="text-muted-foreground tabular-nums">{entry.heldOn}</span>
                <Link
                  href={`/sesi/${entry.sessionId}`}
                  className="ml-auto text-muted-foreground hover:text-foreground hover:underline"
                >
                  Isi Class Record
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-heading text-sm font-medium">Sesi Anda mendatang</h2>

        {dashboard.upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Belum ada Sesi terjadwal untuk Anda.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {dashboard.upcoming.map((entry) => (
              <li
                key={entry.sessionId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border px-4 py-2.5 text-sm"
              >
                <Link
                  href={`/sesi/${entry.sessionId}`}
                  className="font-medium hover:underline"
                >
                  {entry.schoolName}
                </Link>
                <span className="text-xs text-muted-foreground">{MODE_LABELS[entry.mode]}</span>
                <span className="ml-auto text-muted-foreground tabular-nums">
                  {entry.heldOn} · {formatSessionStartTimeWithWib(entry.startsAt, entry.timeZone)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** One count with its label — the number carries the weight, never colour. */
function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="font-heading text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export { DashboardTeachingTeam };
