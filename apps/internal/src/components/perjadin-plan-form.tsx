"use client";

import { planPerjadinAction } from "-/app/(app)/rencanakan-perjadin/actions";
import { PersonSelect } from "-/components/person-select";
import type {
  PlannablePerson,
  PlannableSchool,
  PlanPerjadinResult,
  PlannedTeacher,
} from "@sugt/db/queries";
import { STREAMS, type Stream } from "@sugt/domain";
import { Alert, AlertDescription, AlertTitle } from "@sugt/ui/components/alert";
import { Button } from "@sugt/ui/components/button";
import { Input } from "@sugt/ui/components/input";
import { Label } from "@sugt/ui/components/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

/**
 * The trip, its Group and a date per School, on one form and one submit.
 *
 * **Deliberately dumb**, as `docs/product.md` insists: no ranking, no suggestions, no
 * coverage data inside the form. The context came from where the user started — they
 * selected these Schools on Coverage having just read the delivered counts — and repeating
 * those counts here would invite the decision to be re-made against a worse view of them.
 *
 * A client component because every row is editable and none of that state is worth a URL.
 * The rosters and Schools arrive as props; nothing here fetches. The action is called with
 * a typed value rather than through a `<form action>`, because the payload is nested — a
 * Group and a list of Sessions — and `FormData` would mean flattening it on the way out
 * and parsing it back on the way in, with the type checker helping at neither end.
 */
function PerjadinPlanForm({
  schools,
  staff,
  teachingTeam,
}: {
  schools: PlannableSchool[];
  staff: PlannablePerson[];
  teachingTeam: PlannablePerson[];
}) {
  const router = useRouter();
  const [trip, setTrip] = useState({
    destination: "",
    startsOn: "",
    endsOn: "",
    advanceIdr: "",
    picPersonId: "",
  });
  // One picker per Stream, which is the shape the rule is stated in: at least one Teaching
  // Team member per Stream. A Group may hold more, and the substitution screen is where
  // that is edited — offering an unbounded roster on the planning form would make the
  // common case the awkward one.
  const [group, setGroup] = useState<Record<Stream, string>>({ STEM: "", Research: "" });
  const [dates, setDates] = useState<Record<string, string>>(() =>
    Object.fromEntries(schools.map((school) => [school.id, ""])),
  );
  const [refusal, setRefusal] = useState<PlanPerjadinResult | null>(null);
  const [saving, startSaving] = useTransition();

  const destinationId = useId();
  const startsId = useId();
  const endsId = useId();
  const advanceId = useId();
  const picId = useId();
  // One prefix for the ids built per row and per Stream. `useId` cannot be called inside a
  // `map`, and a bare `group-STEM` would collide if this form were ever rendered twice.
  const rows = useId();

  /** Every field the database needs before a trip can be written at all. */
  const incomplete =
    trip.destination.trim() === "" ||
    trip.startsOn === "" ||
    trip.endsOn === "" ||
    trip.advanceIdr === "" ||
    trip.picPersonId === "" ||
    STREAMS.some((stream) => group[stream] === "") ||
    schools.some((school) => dates[school.id] === "");

  function submit() {
    startSaving(async () => {
      const teachers: PlannedTeacher[] = STREAMS.map((stream) => ({
        stream,
        personId: group[stream],
      }));

      const result = await planPerjadinAction({
        destination: trip.destination.trim(),
        startsOn: trip.startsOn,
        endsOn: trip.endsOn,
        advanceIdr: Number(trip.advanceIdr),
        picPersonId: trip.picPersonId,
        teachers,
        sessions: schools.map((school) => ({
          schoolId: school.id,
          heldOn: dates[school.id]!,
        })),
      });

      if (result.outcome === "planned") {
        router.push(`/perjadin/${result.perjadinId}`);
        return;
      }
      setRefusal(result);
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      {refusal !== null && (
        <Refused
          result={refusal}
          schools={schools}
        />
      )}

      <div className="grid gap-4 border-b border-border px-7 py-5 sm:grid-cols-2">
        <Field
          id={destinationId}
          label="Tujuan"
        >
          <Input
            id={destinationId}
            value={trip.destination}
            onChange={(event) => {
              setTrip((previous) => ({ ...previous, destination: event.target.value }));
            }}
          />
        </Field>

        <Field
          id={picId}
          label="PIC"
        >
          <PersonSelect
            id={picId}
            people={staff}
            value={trip.picPersonId}
            placeholder="Pilih PIC"
            onSelect={(personId) => {
              setTrip((previous) => ({ ...previous, picPersonId: personId }));
            }}
          />
        </Field>

        <Field
          id={startsId}
          label="Mulai"
        >
          <Input
            id={startsId}
            type="date"
            value={trip.startsOn}
            onChange={(event) => {
              setTrip((previous) => ({ ...previous, startsOn: event.target.value }));
            }}
          />
        </Field>

        <Field
          id={endsId}
          label="Selesai"
        >
          <Input
            id={endsId}
            type="date"
            value={trip.endsOn}
            onChange={(event) => {
              setTrip((previous) => ({ ...previous, endsOn: event.target.value }));
            }}
          />
        </Field>

        <Field
          id={advanceId}
          label="Uang muka (Rp)"
        >
          {/*
            Fixed at planning and transferred before departure, so a Perjadin is never in
            an unfunded state — which is why this is on the planning form rather than on
            the acquittal.
          */}
          <Input
            id={advanceId}
            type="number"
            min={0}
            value={trip.advanceIdr}
            onChange={(event) => {
              setTrip((previous) => ({ ...previous, advanceIdr: event.target.value }));
            }}
          />
        </Field>
      </div>

      <div className="border-b border-border px-7 py-5">
        <h2 className="font-heading text-sm font-medium">Group</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Setiap Stream harus punya pengajar. PIC otomatis menjadi anggota Group.
        </p>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {STREAMS.map((stream) => (
            <Field
              key={stream}
              id={`${rows}-group-${stream}`}
              label={stream}
            >
              {/*
                The roster minus whoever holds the other Stream. A Group holds each person
                once, by primary key, and the write refuses a duplicate — this keeps the
                form from offering the mistake in the first place.
              */}
              <PersonSelect
                id={`${rows}-group-${stream}`}
                people={teachingTeam.filter(
                  (entry) =>
                    entry.id === group[stream] ||
                    !STREAMS.some((other) => other !== stream && group[other] === entry.id),
                )}
                value={group[stream]}
                placeholder="Pilih pengajar"
                onSelect={(personId) => {
                  setGroup((previous) => ({ ...previous, [stream]: personId }));
                }}
              />
            </Field>
          ))}
        </div>
      </div>

      <ul className="border-b border-border">
        {schools.map((school) => (
          <li
            key={school.id}
            className="flex flex-wrap items-end gap-x-5 gap-y-2 border-b border-border px-7 py-3 last:border-b-0"
          >
            <div className="min-w-52">
              <p className="text-sm font-medium">{school.name}</p>
              <p className="text-xs text-muted-foreground">{school.kabupatenKota}</p>
            </div>
            <Field
              id={`${rows}-date-${school.id}`}
              label="Tanggal Sesi"
            >
              {/*
                `min`/`max` follow the trip, so the picker will not offer a day outside it.
                The write checks it again — this is the browser being helpful, not the rule.
              */}
              <Input
                id={`${rows}-date-${school.id}`}
                type="date"
                className="w-44"
                min={trip.startsOn || undefined}
                max={trip.endsOn || undefined}
                value={dates[school.id] ?? ""}
                onChange={(event) => {
                  setDates((previous) => ({ ...previous, [school.id]: event.target.value }));
                }}
              />
            </Field>
          </li>
        ))}
      </ul>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-7 py-3.5 shadow-lg">
        <p className="text-sm">
          <b>{schools.length}</b> Sesi luring akan dijadwalkan
        </p>

        <div className="flex gap-2.5">
          <Button
            variant="ghost"
            render={<Link href="/coverage" />}
          >
            Batal
          </Button>
          <Button
            disabled={incomplete || saving}
            onClick={submit}
          >
            {saving ? "Menyimpan…" : "Rencanakan"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * What a refused plan says.
 *
 * **Nothing was written**, and each of these says which field to fix rather than that
 * something went wrong. The dated-outside case names the Schools, because the fix is per
 * row: change that School's date, or change the trip's.
 */
function Refused({ result, schools }: { result: PlanPerjadinResult; schools: PlannableSchool[] }) {
  const nameOf = (schoolId: string) =>
    schools.find((school) => school.id === schoolId)?.name ?? schoolId;

  return (
    <div className="px-7 pt-5">
      <Alert variant="destructive">
        <AlertTitle>Perjadin belum dibuat.</AlertTitle>
        <AlertDescription>
          {result.outcome === "stream-uncovered" && (
            <p>Stream berikut belum punya pengajar: {result.missing.join(", ")}.</p>
          )}
          {result.outcome === "ends-before-starts" && (
            <p>Tanggal selesai tidak boleh mendahului tanggal mulai.</p>
          )}
          {result.outcome === "no-schools" && <p>Tidak ada Sekolah pada Perjadin ini.</p>}
          {result.outcome === "duplicate-teacher" && (
            <p>Satu pengajar tidak bisa mengampu dua Stream sekaligus.</p>
          )}
          {result.outcome === "session-outside-perjadin" && (
            <>
              <p>
                Tanggal Sesi harus berada di antara {result.startsOn} dan {result.endsOn}.
              </p>
              <ul className="mt-1.5 list-disc pl-4">
                {result.offending.map((offending) => (
                  <li key={offending.schoolId}>
                    {nameOf(offending.schoolId)} · {offending.heldOn}
                  </li>
                ))}
              </ul>
            </>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export { PerjadinPlanForm };
