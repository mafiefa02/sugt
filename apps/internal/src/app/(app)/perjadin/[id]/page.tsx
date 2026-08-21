import { PerjadinDates } from "-/components/perjadin-dates";
import { PerjadinEvaluationDialog } from "-/components/perjadin-evaluation-form";
import { PerjadinGroup } from "-/components/perjadin-group";
import { PerjadinLogistics } from "-/components/perjadin-logistics";
import { PerjadinPreparation } from "-/components/perjadin-preparation";
import { SessionStatusBadge } from "-/components/session-labels";
import { shortenKabupaten } from "-/lib/format-destination";
import { requirePerson } from "-/lib/person";
import { perjadinAcquittal, perjadinDetail } from "@sugt/db/queries";
import { formatIdr, formatSessionStartTimeWithWib } from "@sugt/domain";
import { LinkButton } from "@sugt/ui/components/link-button";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * **One Perjadin** — the trip, its Group, the Schools on it, and when the Report is due.
 *
 * **The Teaching Team variant is absence and not concealment**, which is the criterion
 * read literally. `perjadinDetail` carries no money at all, for either role; the Advance
 * and the acquittal come from `perjadinAcquittal`, which opens with the Staff-only choke
 * point. So the strip below is not rendered for a professor because the figures were never
 * fetched — there is no money in any props object on this page for a client component to
 * receive, and nothing to reveal by reading the payload.
 *
 * The Report deadline rides with the money for the same reason: the Perjadin Report *is*
 * the acquittal state on the row, so a professor sees neither. It is derived and never
 * stored — two days after the Group gets back, so it cannot be typed wrong and it moves by
 * itself if the trip's dates are corrected.
 */
export default async function Page({ params }: PageProps<"/perjadin/[id]">) {
  const person = await requirePerson();
  const { id } = await params;

  const trip = await perjadinDetail(person, id);
  if (!trip) notFound();

  // Fetched only for Staff, and by the query that refuses everybody else. The condition is
  // a courtesy so a professor's page makes no pointless call — `requireStaff` inside is
  // what actually closes the path.
  const acquittal = person.role === "Staff" ? await perjadinAcquittal(person, id) : null;

  // The Evaluation is offered to whoever was on the Group — the people who slept in the hotel,
  // Teaching Team and the PIC alike. Checked here for the display; `filePerjadinEvaluation`
  // re-checks membership authoritatively, since a Server Action is a public endpoint.
  const isGroupMember = trip.group.some((member) => member.personId === person.id);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border px-7 py-5">
        <Link
          href="/perjadin"
          className="text-sm text-muted-foreground hover:underline"
        >
          Perjadin
        </Link>
        <h1 className="mt-1 font-heading text-lg font-medium">
          {shortenKabupaten(trip.destination)}
        </h1>
        {/*
          The dates and, for Staff, the one write that corrects them. Moving the trip offset-shifts
          its arranged Sessions; delivered and cancelled ones stay, and the times do not move.
        */}
        <div className="mt-0.5">
          <PerjadinDates
            perjadinId={trip.id}
            startsOn={trip.startsOn}
            endsOn={trip.endsOn}
            canEdit={person.role === "Staff"}
          />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          PIC: <span className="text-foreground">{trip.picFullName}</span>
        </p>
      </header>

      {acquittal !== null && (
        <div className="border-b border-border px-7 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-heading text-sm font-medium">Uang muka</h2>
            {/*
              The Report is the acquittal state on this row, so it is a child of this page
              rather than a surface of its own — and Staff-only, like the strip it sits in.
            */}
            <LinkButton
              href={`/perjadin/${trip.id}/laporan`}
              variant="outline"
              size="sm"
            >
              Laporan Perjadin
            </LinkButton>
          </div>
          {/*
            The deadline rides with the money, because the Report *is* the acquittal. Nothing
            is gated on it — DITSAMA sets that deadline itself, and the tool is never stricter
            than the process it serves.
          */}
          <p className="mt-1 text-sm text-muted-foreground">
            Laporan jatuh tempo <span className="tabular-nums">{acquittal.reportDueOn}</span>
          </p>
          <dl className="mt-2.5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <Figure
              label="Diterima"
              amountIdr={acquittal.advanceIdr}
            />
            <Figure
              label="Terpakai"
              amountIdr={acquittal.spentIdr}
            />
            {/*
              Derived and never stored: the Advance less every transaction against it.
              Negative means the Group overspent, which is a real state and not an error.
            */}
            <Figure
              label="Sisa"
              amountIdr={acquittal.remainderIdr}
            />
          </dl>
        </div>
      )}

      <PerjadinGroup
        perjadinId={trip.id}
        group={trip.group}
        picPersonId={trip.picPersonId}
        teachingTeam={trip.teachingTeam}
        staff={trip.staff}
        canSubstitute={person.role === "Staff"}
      />

      <PerjadinLogistics
        perjadinId={trip.id}
        departure={trip.departure}
        returnLeg={trip.return}
        canEdit={person.role === "Staff"}
      />

      {/*
        The Preparation Checklist — an internal Staff monitoring aid. Shown to everyone (it carries
        no money), interactive for Staff, whom `togglePreparationItem` re-checks.
      */}
      <PerjadinPreparation
        perjadinId={trip.id}
        items={trip.preparation}
        canToggle={person.role === "Staff"}
      />

      {/*
        Offered to Group members only, and to every one of them — the Evaluation is about the
        journey, so the PIC who arranged it may file one too. Nothing tracks here whether this
        viewer already filed; a second attempt is refused by the write as `already-filed`.
      */}
      {isGroupMember && (
        <div className="border-b border-border px-7 py-5">
          <h2 className="font-heading text-sm font-medium">Evaluasi Perjadin</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nilai perjalanannya — penginapan, transportasi, konsumsi dan ketepatan waktu. Tiap
            anggota Group mengisi satu.
          </p>
          <div className="mt-3">
            <PerjadinEvaluationDialog perjadinId={trip.id} />
          </div>
        </div>
      )}

      <div className="px-7 py-5">
        <h2 className="font-heading text-sm font-medium">Sesi</h2>
        <ul className="mt-2.5 space-y-1.5">
          {trip.sessions.map((session) => (
            <li
              key={session.sessionId}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
            >
              <Link
                href={`/sesi/${session.sessionId}`}
                className="tabular-nums hover:underline"
              >
                {session.heldOn}
              </Link>
              <span className="text-muted-foreground tabular-nums">
                {formatSessionStartTimeWithWib(session.startsAt, session.timeZone)}
              </span>
              <Link
                href={`/sekolah/${session.schoolSlug}`}
                className="text-muted-foreground hover:underline"
              >
                {session.schoolName}
              </Link>
              <SessionStatusBadge status={session.status} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Money in whole rupiah, which is what it is stored as — `numeric(_, 2)` would imply a
 * subunit nobody uses, so there is no cent to render and none is invented here.
 */
function Figure({ label, amountIdr }: { label: string; amountIdr: number }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">Rp {formatIdr(amountIdr)}</dd>
    </div>
  );
}
