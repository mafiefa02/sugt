"use client";

import { planPerjadinAction } from "-/app/(app)/rencanakan-perjadin/actions";
import { PersonSelect } from "-/components/person-select";
import type {
  ClusterWithSubClusters,
  PlannablePerson,
  PlanPerjadinResult,
  PlannedTeacher,
  SubClusterSchool,
  SubClusterWithSchools,
} from "@sugt/db/queries";
import { STREAMS, type Stream } from "@sugt/domain";
import { Alert, AlertDescription, AlertTitle } from "@sugt/ui/components/alert";
import { Button } from "@sugt/ui/components/button";
import { Checkbox } from "@sugt/ui/components/checkbox";
import { Input } from "@sugt/ui/components/input";
import { Label } from "@sugt/ui/components/label";
import { LinkButton } from "@sugt/ui/components/link-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sugt/ui/components/select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";

/** One School's row on the form: whether it is kept, and if so on what day and hour. */
type SchoolRow = { kept: boolean; date: string; startsAt: string };

/** Every School of a Sub-Cluster starts kept, with an empty date and time. */
function rowsFor(schools: SubClusterSchool[]): Record<string, SchoolRow> {
  return Object.fromEntries(
    schools.map((school) => [school.id, { kept: true, date: "", startsAt: "" }]),
  );
}

/**
 * The trip, its Group and a date and time per kept School, on one form and one submit.
 *
 * **Deliberately dumb**, as `docs/product.md` insists: no ranking, no suggestions, no
 * coverage data inside the form. It begins from a **Sub-Cluster** — the set of Schools near
 * enough to reach on one journey — which decides which Schools may appear at all. Its Schools
 * default to all of them and any can be dropped: the Sub-Cluster says which are eligible, the
 * plan says which are visited this time. `destination` is separate free text, prose for a
 * Surat Tugas, and is not derived from the Sub-Cluster's name.
 *
 * A client component because every row is editable and none of that state is worth a URL.
 * The Sub-Clusters and rosters arrive as props; nothing here fetches. The action is called
 * with a typed value rather than through a `<form action>`, because the payload is nested — a
 * Group and a list of Sessions — and `FormData` would mean flattening it on the way out and
 * parsing it back on the way in, with the type checker helping at neither end.
 */
function PerjadinPlanForm({
  clusters,
  staff,
  teachingTeam,
}: {
  clusters: ClusterWithSubClusters[];
  staff: PlannablePerson[];
  teachingTeam: PlannablePerson[];
}) {
  const router = useRouter();

  // Every Sub-Cluster, flattened for the picker's trigger label and for finding the one that
  // was chosen. The Clusters keep their grouping in the dropdown itself.
  const subClusters = useMemo(
    () => new Map(clusters.flatMap((cluster) => cluster.subClusters.map((sub) => [sub.id, sub]))),
    [clusters],
  );

  const [subClusterId, setSubClusterId] = useState("");
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
  // Keyed by School id. Rebuilt whole when the Sub-Cluster changes, so a School from the old
  // one never lingers with a date attached.
  const [rows, setRows] = useState<Record<string, SchoolRow>>({});
  const [refusal, setRefusal] = useState<PlanPerjadinResult | null>(null);
  const [saving, startSaving] = useTransition();

  const subClusterField = useId();
  const destinationId = useId();
  const startsId = useId();
  const endsId = useId();
  const advanceId = useId();
  const picId = useId();
  // One prefix for the ids built per row and per Stream. `useId` cannot be called inside a
  // `map`, and a bare `group-STEM` would collide if this form were ever rendered twice.
  const fieldPrefix = useId();

  const chosen: SubClusterWithSchools | undefined = subClusters.get(subClusterId);
  const schools = chosen?.schools ?? [];
  const keptCount = schools.filter((school) => rows[school.id]?.kept).length;

  function chooseSubCluster(id: string) {
    setSubClusterId(id);
    setRows(rowsFor(subClusters.get(id)?.schools ?? []));
    setRefusal(null);
  }

  function setRow(schoolId: string, patch: Partial<SchoolRow>) {
    setRows((previous) => ({ ...previous, [schoolId]: { ...previous[schoolId]!, ...patch } }));
  }

  /** Every field the database needs before a trip can be written at all. */
  const incomplete =
    subClusterId === "" ||
    trip.destination.trim() === "" ||
    trip.startsOn === "" ||
    trip.endsOn === "" ||
    trip.advanceIdr === "" ||
    trip.picPersonId === "" ||
    STREAMS.some((stream) => group[stream] === "") ||
    // Only kept Schools need a date and a time. A trip with every School dropped is still
    // submittable — it comes back as `no-schools`, which is the refusal for exactly that.
    schools.some((school) => {
      const row = rows[school.id];
      return row?.kept === true && (row.date === "" || row.startsAt === "");
    });

  function submit() {
    startSaving(async () => {
      const teachers: PlannedTeacher[] = STREAMS.map((stream) => ({
        stream,
        personId: group[stream],
      }));

      const result = await planPerjadinAction({
        subClusterId,
        destination: trip.destination.trim(),
        startsOn: trip.startsOn,
        endsOn: trip.endsOn,
        advanceIdr: Number(trip.advanceIdr),
        picPersonId: trip.picPersonId,
        teachers,
        sessions: schools
          .filter((school) => rows[school.id]?.kept)
          .map((school) => ({
            schoolId: school.id,
            heldOn: rows[school.id]!.date,
            startsAt: rows[school.id]!.startsAt,
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

      <div className="border-b border-border px-7 py-5">
        <Field
          id={subClusterField}
          label="Kelompok Sekolah"
        >
          <Select
            items={Object.fromEntries([...subClusters].map(([id, sub]) => [id, sub.name]))}
            value={subClusterId === "" ? null : subClusterId}
            onValueChange={(selected) => {
              chooseSubCluster((selected as string | null) ?? "");
            }}
          >
            <SelectTrigger
              id={subClusterField}
              className="w-full sm:w-96"
            >
              <SelectValue placeholder="Pilih Kelompok Sekolah" />
            </SelectTrigger>
            <SelectContent>
              {[...subClusters].map(([id, sub]) => (
                <SelectItem
                  key={id}
                  value={id}
                >
                  {sub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

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
              id={`${fieldPrefix}-group-${stream}`}
              label={stream}
            >
              {/*
                The roster minus whoever holds the other Stream. A Group holds each person
                once, by primary key, and the write refuses a duplicate — this keeps the
                form from offering the mistake in the first place.
              */}
              <PersonSelect
                id={`${fieldPrefix}-group-${stream}`}
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

      {chosen === undefined ? (
        <p className="px-7 py-6 text-sm text-muted-foreground">
          Pilih Kelompok Sekolah untuk menampilkan Sekolahnya.
        </p>
      ) : (
        <ul className="border-b border-border">
          {schools.map((school) => {
            const row = rows[school.id];
            const kept = row?.kept ?? false;
            return (
              <li
                key={school.id}
                className="flex flex-wrap items-end gap-x-5 gap-y-2 border-b border-border px-7 py-3 last:border-b-0"
              >
                <label className="flex min-w-52 items-center gap-2.5">
                  {/*
                    Every School of the Sub-Cluster starts kept. Dropping one leaves it off
                    the trip — a School sitting exams that week — not off the Sub-Cluster.
                  */}
                  <Checkbox
                    checked={kept}
                    onCheckedChange={(checked) => {
                      setRow(school.id, { kept: checked === true });
                    }}
                  />
                  <span className={kept ? "text-sm font-medium" : "text-sm text-muted-foreground"}>
                    {school.name}
                  </span>
                </label>

                <Field
                  id={`${fieldPrefix}-date-${school.id}`}
                  label="Tanggal Sesi"
                >
                  {/*
                    `min`/`max` follow the trip, so the picker will not offer a day outside it.
                    The write checks it again — this is the browser being helpful, not the rule.
                  */}
                  <Input
                    id={`${fieldPrefix}-date-${school.id}`}
                    type="date"
                    className="w-44"
                    min={trip.startsOn || undefined}
                    max={trip.endsOn || undefined}
                    disabled={!kept}
                    value={row?.date ?? ""}
                    onChange={(event) => {
                      setRow(school.id, { date: event.target.value });
                    }}
                  />
                </Field>

                <Field
                  id={`${fieldPrefix}-time-${school.id}`}
                  label="Jam mulai"
                >
                  {/*
                    Each School its own start time — morning at one, afternoon at another. Two
                    may share a date, never a date and a time, because the Group is in one place.
                  */}
                  <Input
                    id={`${fieldPrefix}-time-${school.id}`}
                    type="time"
                    className="w-32"
                    disabled={!kept}
                    value={row?.startsAt ?? ""}
                    onChange={(event) => {
                      setRow(school.id, { startsAt: event.target.value });
                    }}
                  />
                </Field>
              </li>
            );
          })}
        </ul>
      )}

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-7 py-3.5 shadow-lg">
        <p className="text-sm">
          <b>{keptCount}</b> Sesi luring akan dijadwalkan
        </p>

        <div className="flex gap-2.5">
          <LinkButton
            variant="ghost"
            render={<Link href="/perjadin" />}
          >
            Batal
          </LinkButton>
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
 * something went wrong. The cases that name Schools do so because the fix is per row: change
 * that School's date or time, or drop it.
 */
function Refused({ result, schools }: { result: PlanPerjadinResult; schools: SubClusterSchool[] }) {
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
          {result.outcome === "school-outside-sub-cluster" && (
            <>
              <p>Sekolah berikut bukan bagian dari Kelompok Sekolah yang dipilih:</p>
              <ul className="mt-1.5 list-disc pl-4">
                {result.schoolIds.map((schoolId) => (
                  <li key={schoolId}>{nameOf(schoolId)}</li>
                ))}
              </ul>
            </>
          )}
          {result.outcome === "schools-collide" && (
            <p>
              {nameOf(result.schoolIds[0]!)} dan {nameOf(result.schoolIds[1]!)} tidak bisa
              dikunjungi pada tanggal dan jam yang sama ({result.heldOn} · {result.startsAt}).
            </p>
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
