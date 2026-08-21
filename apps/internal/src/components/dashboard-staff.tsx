import { shortenKabupaten } from "-/lib/format-destination";
import type { StaffDashboard } from "@sugt/db/queries";
import { formatIdr } from "@sugt/domain";
import Link from "next/link";

/**
 * **Beranda — Staff.** The same delivery picture the Programme shows, plus this person's PIC work.
 * The Advance strip and the PIC reports are money, fetched behind the Staff-only choke point (#40,
 * ADR-0004).
 *
 * Counts, not claims: the delivery figures carry no red and no denominator-of-judgement, the owed
 * list is the chase list, and the PIC strip says "Tidak ada gerbang — DITSAMA yang menetapkan
 * tenggat, bukan alat ini." **Participants are never counted** — there is no such figure here.
 */
function DashboardStaff({ dashboard }: { dashboard: StaffDashboard }) {
  return (
    <div className="flex min-h-full flex-col gap-8 p-7">
      <header>
        <p className="text-sm text-muted-foreground">Selamat datang kembali,</p>
        <h1 className="font-heading text-xl font-medium">{dashboard.fullName}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Staff · DITSAMA ITB</p>
      </header>

      <section>
        <h2 className="font-heading text-sm font-medium">Program secara keseluruhan</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Hitungan, bukan penilaian.</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <p className="font-heading text-2xl font-semibold tabular-nums">
              {dashboard.schoolsReached}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">Sekolah sudah terjangkau</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="font-heading text-2xl font-semibold tabular-nums">
              {dashboard.deliveredTotal}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">Sesi terlaksana</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            {/* Folded from `perCluster` — how many of the Clusters have any delivery yet. */}
            <p className="font-heading text-2xl font-semibold tabular-nums">
              {dashboard.perCluster.filter((entry) => entry.delivered > 0).length}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">Cluster sudah terjangkau</p>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-border p-4">
          <p className="text-sm font-medium">Sekolah terjangkau per Cluster</p>
          <ul className="mt-2.5 flex flex-col gap-2">
            {dashboard.perCluster.map((entry) => (
              <li
                key={entry.clusterId}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>{entry.clusterName}</span>
                <span className="text-muted-foreground tabular-nums">{entry.delivered} Sesi</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* The Advance strip — money, and marked as Staff-only in the copy the way the design does. */}
      <section className="rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Advance beredar (belum dipertanggungjawabkan)
          </p>
          <span className="text-xs text-muted-foreground">Hanya Staff</span>
        </div>
        <p className="mt-1 font-heading text-2xl font-semibold tabular-nums">
          Rp {formatIdr(dashboard.advanceOutstandingIdr)}
        </p>
      </section>

      <section>
        <h2 className="font-heading text-sm font-medium">Perlu Anda kerjakan</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Tanpa tenggat — daftar untuk dikejar.
        </p>

        {dashboard.owed.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Belum ada Session Record yang menunggu.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {dashboard.owed.map((entry) => (
              <li
                key={entry.sessionId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border px-4 py-2.5 text-sm"
              >
                <span className="font-medium">{entry.schoolName}</span>
                <span className="text-muted-foreground">Session Record</span>
                <span className="text-muted-foreground tabular-nums">{entry.heldOn}</span>
                <Link
                  href={`/sesi/${entry.sessionId}`}
                  className="ml-auto text-muted-foreground hover:text-foreground hover:underline"
                >
                  Isi Session Record
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-heading text-sm font-medium">Pekerjaan PIC Anda</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Tidak ada gerbang — DITSAMA yang menetapkan tenggat, bukan alat ini.
        </p>

        {dashboard.picReports.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Tidak ada Perjadin Report yang menunggu.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2.5">
            {dashboard.picReports.map((report) => (
              <li
                key={report.perjadinId}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    Perjadin Report — {shortenKabupaten(report.destination)}
                  </p>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {report.startsOn} – {report.endsOn} · {report.groupCount} anggota Group
                  </span>
                </div>

                <div className="mt-2.5 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                  <span className="text-muted-foreground">
                    <span className="text-foreground tabular-nums">{report.transactionCount}</span>{" "}
                    Transaksi tercatat
                  </span>
                  <span className="text-muted-foreground">
                    <span className="text-foreground tabular-nums">
                      {report.receiptsSettled} / {report.groupCount}
                    </span>{" "}
                    Bukti anggota masuk
                  </span>
                  <span className="text-muted-foreground">
                    <span className="text-foreground tabular-nums">
                      Rp {formatIdr(report.remainderIdr)}
                    </span>{" "}
                    Sisa untuk dikembalikan
                  </span>
                  <span className="text-muted-foreground">
                    Jatuh tempo{" "}
                    <span className="text-foreground tabular-nums">{report.reportDueOn}</span>
                  </span>
                </div>

                <Link
                  href={`/perjadin/${report.perjadinId}/laporan`}
                  className="mt-2.5 inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  Buka Perjadin Report
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export { DashboardStaff };
