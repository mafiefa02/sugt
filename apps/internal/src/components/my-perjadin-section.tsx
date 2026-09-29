"use client";

import { FeedbackTokenDialog } from "-/components/feedback-token";
import { RecordTransaction } from "-/components/laporan-perjadin/acquittal-transactions";
import { PerjadinFeedbackTokenDialog } from "-/components/perjadin-feedback-token";
import { SessionMarkDeliveredDialog } from "-/components/perjadin-mark-delivered";
import { PerjadinPreparationDialog } from "-/components/perjadin-preparation";
import { progressTone } from "-/components/progress-tone";
import { spentPercent, tripTimeline, type TimelineNode } from "-/components/trip-timeline";
import { shortenKabupaten } from "-/lib/format-destination";
import type { MyUpcomingPerjadin } from "@sugt/db/queries";
import { formatRupiah, formatSessionStartTimeWithWib } from "@sugt/domain";
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  AccordionPlainTrigger,
} from "@sugt/ui/components/accordion";
import { Button } from "@sugt/ui/components/button";
import { LinkButton } from "@sugt/ui/components/link-button";
import { Progress } from "@sugt/ui/components/progress";
import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/**
 * **Perjalanan Dinas Anda** — the Staff home's own-trips section (#199), the client island over
 * `myUpcomingPerjadin`'s payload (#197). It wires that read straight into the reusable dialogs #198
 * carved out: the Preparation checklist, the two feedback-QR dialogs and the transaction entry form
 * all open from a card's own labelled control rather than a page of their own, and each Session on a
 * trip's timeline carries its own Tandai confirmation (#349). Each trip is a card in one single-open
 * accordion (#348), all collapsed to start, with the Anggota roster shown inline.
 *
 * `today` is the WIB date the page computed on the server; the timeline reads its done legs off it
 * rather than off a clock here, so the server render and the hydration agree.
 *
 * A client component for two reasons that have nothing to do with the data: the "show more" paging is
 * local state, and every dialog it mounts is itself a client component. The data is fetched on the
 * server and passed down whole, so this never refetches — paging only widens the slice already here.
 *
 * The whole section — heading included — is absent when the caller is on no upcoming trip, rather
 * than a heading over an empty list: there is nothing to say, so nothing is shown.
 */
function MyPerjadinSection({ trips, today }: { trips: MyUpcomingPerjadin[]; today: string }) {
  // Reveal three at a time from the client, never a refetch — the full list is already in hand, and
  // the button only widens the slice. Hidden once everything is shown.
  const [shown, setShown] = useState(3);

  if (trips.length === 0) return null;

  return (
    <section>
      <h2 className="font-heading text-sm font-medium">Perjalanan Dinas Anda</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Perjalanan yang belum selesai, dan yang bisa Anda kerjakan pada masing-masing.
      </p>

      {/* One single-open accordion (Base UI's default), every card collapsed to start — including
          the ones "show more" reveals, since none is ever in the open value until it is clicked.
          Each item is its own bordered card with a gap between, not the stacked-divider box the
          primitive draws by default. */}
      <Accordion className="mt-3 flex flex-col gap-3 rounded-none border-0">
        {trips.slice(0, shown).map((trip) => (
          <TripCard
            key={trip.id}
            trip={trip}
            today={today}
          />
        ))}
      </Accordion>

      {shown < trips.length && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            setShown((current) => current + 3);
          }}
        >
          Tampilkan lebih banyak
        </Button>
      )}
    </section>
  );
}

/**
 * One trip as one accordion item (#348): a header row that is all a collapsed card shows, and a
 * two-column body — the money, the actions and the trip timeline on the left, the Anggota roster on
 * the right.
 *
 * The header row holds a second control, the Persiapan pill, so the trigger cannot wrap the row — a
 * button inside a button is invalid HTML. Instead the trigger wraps only the title and is *stretched*
 * over the whole row by an `after:` overlay (the row is its containing block): clicking the PIC, the
 * dates, the chevron or empty space lands on the overlay and toggles the card, and the trigger's
 * accessible name is the title alone. The pill sits above the overlay (`relative z-10`), so it takes
 * its own click and opens the checklist without toggling. The chevron is decorative and outside the
 * trigger, rotated from the item's `data-open`.
 */
function TripCard({ trip, today }: { trip: MyUpcomingPerjadin; today: string }) {
  // The pill's `x/N` is read straight off the checklist the card also hands the dialog — one payload
  // for both, so the pill and the boxes can never disagree. `N` is always seven (amendment to ADR-0018).
  const preparationDone = trip.preparation.filter((item) => item.checked).length;
  const preparationTotal = trip.preparation.length;
  // The shared three-way progress tone `/perjadin`'s pill wears too — neutral before anything is
  // ticked, amber part-way, emerald once every item is done — so the two screens read the pill the
  // same way. This one stays a button (the checklist opens from it).
  const preparationTone = progressTone(preparationDone, preparationTotal);

  // The same travel-float remainder the acquittal derives (`advanceIdr - drawnDownIdr`, only
  // ADVANCE_DRAWDOWN_CATEGORIES draw down — ADR-0029), pinned equal by a query test so the two
  // screens never show two answers. Shown as is, negative included; only the bar clamps.
  const remainingIdr = trip.advanceIdr - trip.drawnDownIdr;

  return (
    <AccordionItem
      value={trip.id}
      className="group/trip rounded-lg border border-border bg-card last:border-b"
    >
      <div className="relative flex items-start gap-3 p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
          <AccordionHeader className="min-w-0 font-heading text-lg font-normal text-foreground">
            <AccordionPlainTrigger className="after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50">
              {/* Same render-time abbreviation the trip's own page and its dialogs use (#105). */}
              {shortenKabupaten(trip.destination)}
            </AccordionPlainTrigger>
          </AccordionHeader>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span>PIC: {trip.picFullName}</span>
            {/* The pill *is* the dialog's trigger — clicking it opens the checklist, live-toggleable
                because `/` is Staff-only (canToggle), and the toggle write re-checks the role anyway. */}
            <PerjadinPreparationDialog
              perjadinId={trip.id}
              items={trip.preparation}
              canToggle
              trigger={
                <button
                  type="button"
                  className={`relative z-10 rounded-full px-2 py-0.5 font-medium tabular-nums transition-opacity hover:opacity-80 ${preparationTone}`}
                >
                  Persiapan {preparationDone}/{preparationTotal}
                </button>
              }
            />
            <span className="text-muted-foreground tabular-nums">
              {trip.startsOn} – {trip.endsOn}
            </span>
          </div>
        </div>
        <ChevronDown
          aria-hidden
          className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-open/trip:rotate-180"
        />
      </div>

      <AccordionPanel className="text-foreground">
        <div className="grid gap-6 pt-2 pb-1 lg:grid-cols-[11fr_9fr]">
          <div className="flex min-w-0 flex-col gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Uang Perjalanan</p>
              <p className="mt-1 font-heading text-lg tabular-nums">
                Tersisa {formatRupiah(remainingIdr)}
              </p>
              <div className="mt-1 flex items-baseline justify-between gap-3 text-sm tabular-nums">
                <span>Terpakai {formatRupiah(trip.drawnDownIdr)}</span>
                <span>{formatRupiah(trip.advanceIdr)}</span>
              </div>
              <Progress
                value={spentPercent(trip.advanceIdr, trip.drawnDownIdr)}
                aria-label="Uang Perjalanan terpakai"
                className="mt-2 *:data-[slot=progress-track]:h-3"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <RecordTransaction
                perjadinId={trip.id}
                trigger={
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full"
                  >
                    Catat Transaksi
                  </Button>
                }
              />
              <PerjadinFeedbackTokenDialog
                perjadinId={trip.id}
                trigger={
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full"
                  >
                    Evaluasi Perjadin
                  </Button>
                }
              />
              <LinkButton
                size="sm"
                className="rounded-full"
                render={<Link href={`/perjadin/${trip.id}`} />}
              >
                Edit
              </LinkButton>
            </div>

            <TripTimeline nodes={tripTimeline(trip, today)} />
          </div>

          <AnggotaRoster anggota={trip.anggota} />
        </div>
      </AccordionPanel>
    </AccordionItem>
  );
}

/**
 * Who is on the trip, inline: Pendamping (the Staff Group), Pengajar (the trip-scoped teacher names)
 * and Pimpinan (record-only), in that order. A group with nobody in it is left out rather than
 * labelled over an empty list, and the names are plain — the PIC is already named in the header.
 */
function AnggotaRoster({ anggota }: { anggota: MyUpcomingPerjadin["anggota"] }) {
  const groups = [
    {
      label: "Pendamping",
      names: anggota.staff.map((person) => ({ key: person.personId, name: person.fullName })),
    },
    {
      label: "Pengajar",
      names: anggota.pengajar.map((person) => ({ key: person.id, name: person.name })),
    },
    {
      label: "Pimpinan",
      names: anggota.pimpinan.map((person) => ({ key: person.personId, name: person.name })),
    },
  ].filter((group) => group.names.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="text-xs text-muted-foreground">{group.label}</p>
          <ul className="mt-1 grid gap-0.5 text-sm">
            {group.names.map((person) => (
              <li key={person.key}>{person.name}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * The trip as it happens, top to bottom (#349): departure, each live Session across the Schools in
 * date-then-time order, return — the order and the done state already decided by `tripTimeline`.
 * Left out entirely when there is nothing on it. An ordered list, so assistive tech reads it as a
 * sequence.
 *
 * Each node is a circle on a vertical rail: done is solid primary with a check, pending a muted ring
 * with a primary dot. The rail segment below a node is primary only when that node is done; every
 * other segment is muted.
 */
function TripTimeline({ nodes }: { nodes: TimelineNode[] }) {
  if (nodes.length === 0) return null;

  return (
    <ol className="flex flex-col text-sm">
      {nodes.map((node, index) => (
        <li
          key={node.key}
          className="flex gap-3"
        >
          <div className="flex flex-col items-center">
            <TimelineMarker done={node.done} />
            {index < nodes.length - 1 && (
              <div
                aria-hidden
                className={`w-0.5 flex-1 ${node.done ? "bg-primary" : "bg-muted-foreground/30"}`}
              />
            )}
          </div>
          <div
            className={`flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 ${index < nodes.length - 1 ? "pb-4" : ""}`}
          >
            <span className="sr-only">{node.done ? "Selesai: " : "Belum: "}</span>
            {node.kind === "leg" ? <LegNode node={node} /> : <SessionNode node={node} />}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The node's circle. Decorative: the row's hidden "Selesai"/"Belum" says the same in words. */
function TimelineMarker({ done }: { done: boolean }) {
  return done ? (
    <span
      aria-hidden
      className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
    >
      <Check className="size-3" />
    </span>
  ) : (
    <span
      aria-hidden
      className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30 bg-card"
    >
      <span className="size-1.5 rounded-full bg-primary" />
    </span>
  );
}

/** `{date} · {HH:MM} {zone} · {mode}` — the leg's own zone, with no WIB equivalent added. */
function LegNode({ node }: { node: Extract<TimelineNode, { kind: "leg" }> }) {
  return (
    <span>
      <span className="tabular-nums">{node.date}</span> ·{" "}
      <span className="tabular-nums">{node.time}</span> {node.zone} · {node.mode}
    </span>
  );
}

/**
 * `{heldOn} · {start time} · {School}`, then the Session's own controls: **Tandai** only while it is
 * `arranged` (a delivered Session has no transition left, so the pill goes once it lands), and
 * **Feedback** — the Participant-Feedback QR — which stays after delivery.
 */
function SessionNode({ node }: { node: Extract<TimelineNode, { kind: "session" }> }) {
  const { school, session } = node;
  const text = `${session.heldOn} · ${formatSessionStartTimeWithWib(session.startsAt, school.timeZone)} · ${school.name}`;

  return (
    <>
      <span className="tabular-nums">{text}</span>
      <span className="flex gap-2">
        {session.status === "arranged" && (
          <SessionMarkDeliveredDialog
            school={school}
            session={session}
            trigger={
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full"
                aria-label={`Tandai ${text}`}
              >
                Tandai
              </Button>
            }
          />
        )}
        <FeedbackTokenDialog
          sessionId={session.sessionId}
          status={session.status}
          trigger={
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              aria-label={`Feedback ${text}`}
            >
              Feedback
            </Button>
          }
        />
      </span>
    </>
  );
}

export { MyPerjadinSection };
