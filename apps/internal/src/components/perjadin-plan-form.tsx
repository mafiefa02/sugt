"use client";

import { planPerjadinAction } from "-/app/(app)/rencanakan-perjadin/actions";
import { PersonSelect } from "-/components/person-select";
import type {
  PlannablePerson,
  PlannableSchool,
  PlannableSubCluster,
  PlanPerjadinResult,
  PlannedTeacher,
} from "@sugt/db/queries";
import { formatIdr, STREAMS, TRANSPORT_MODES, type Stream, type TransportMode } from "@sugt/domain";
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
import { useId, useState, useTransition } from "react";

/** One School's row on the form: kept on the trip, and when the Group teaches there. */
type SchoolRow = { kept: boolean; date: string; time: string };

/**
 * The trip, its Group and a date and time per School, on one form and one submit.
 *
 * **Planning starts from a Sub-Cluster** (#69): pick one, and its Schools appear — all kept by
 * default, each individually droppable. The Sub-Cluster fixes which Schools may appear; the
 * plan fixes which are visited this time, so a School sitting exams that week is dropped from
 * the trip rather than a reason to abandon it. Each kept School gets its own date and start
 * time.
 *
 * A client component because every row is editable and none of that state is worth a URL. The
 * Sub-Clusters and rosters arrive as props; nothing here fetches. The action is called with a
 * typed value rather than through a `<form action>`, because the payload is nested — a Group
 * and a list of Sessions — and `FormData` would mean flattening it out and parsing it back
 * with the type checker helping at neither end.
 */
function PerjadinPlanForm({
  subClusters,
  staff,
  teachingTeam,
}: {
  subClusters: PlannableSubCluster[];
  staff: PlannablePerson[];
  teachingTeam: PlannablePerson[];
}) {
  const router = useRouter();
  const [subClusterId, setSubClusterId] = useState("");
  const [trip, setTrip] = useState({
    startsOn: "",
    endsOn: "",
    advanceIdr: "",
    picPersonId: "",
  });
  // One picker per Stream, which is the shape the rule is stated in: at least one Teaching
  // Team member per Stream. A Group may hold more, and the substitution screen is where that
  // is edited — offering an unbounded roster on the planning form would make the common case
  // the awkward one.
  const [group, setGroup] = useState<Record<Stream, string>>({ STEM: "", Research: "" });
  // Three optional extra-Staff slots, each a Person id or "" for empty. A set, not an order —
  // slot position is not stored, so which slot holds whom does not matter.
  const [extraStaff, setExtraStaff] = useState<[string, string, string]>(["", "", ""]);
  // Departure/return logistics, all six required to submit. `mode` is a `TransportMode` once
  // chosen; "" until then. The zones are not here — WIB and the derived return zone are the
  // server's to set.
  const [logistics, setLogistics] = useState({
    departureDate: "",
    departureTime: "",
    departureMode: "" as TransportMode | "",
    returnDate: "",
    returnTime: "",
    returnMode: "" as TransportMode | "",
  });
  // Keyed by School id, seeded when a Sub-Cluster is picked. A School absent from the current
  // Sub-Cluster has no row, so switching Sub-Cluster starts its Schools fresh.
  const [rows, setRows] = useState<Record<string, SchoolRow>>({});
  const [refusal, setRefusal] = useState<PlanPerjadinResult | null>(null);
  const [saving, startSaving] = useTransition();

  const subClusterFieldId = useId();
  const startsId = useId();
  const endsId = useId();
  const advanceId = useId();
  const picId = useId();
  // One prefix for the ids built per row and per Stream. `useId` cannot be called inside a
  // `map`, and a bare `group-STEM` would collide if this form were ever rendered twice.
  const idPrefix = useId();

  const selected = subClusters.find((entry) => entry.id === subClusterId);
  const schools = selected?.schools ?? [];
  const kept = schools.filter((school) => rows[school.id]?.kept);

  function pickSubCluster(id: string) {
    setSubClusterId(id);
    const picked = subClusters.find((entry) => entry.id === id);
    setRows(
      Object.fromEntries(
        (picked?.schools ?? []).map((school) => [school.id, { kept: true, date: "", time: "" }]),
      ),
    );
    setRefusal(null);
  }

  /** Every field the database needs before a trip can be written at all. Extra Staff are optional. */
  const incomplete =
    subClusterId === "" ||
    trip.startsOn === "" ||
    trip.endsOn === "" ||
    trip.advanceIdr === "" ||
    trip.picPersonId === "" ||
    STREAMS.some((stream) => group[stream] === "") ||
    logistics.departureDate === "" ||
    logistics.departureTime === "" ||
    logistics.departureMode === "" ||
    logistics.returnDate === "" ||
    logistics.returnTime === "" ||
    logistics.returnMode === "" ||
    kept.length === 0 ||
    kept.some((school) => rows[school.id]!.date === "" || rows[school.id]!.time === "");

  function submit() {
    startSaving(async () => {
      const teachers: PlannedTeacher[] = STREAMS.map((stream) => ({
        stream,
        personId: group[stream],
      }));

      const result = await planPerjadinAction({
        subClusterId,
        startsOn: trip.startsOn,
        endsOn: trip.endsOn,
        advanceIdr: Number(trip.advanceIdr),
        picPersonId: trip.picPersonId,
        extraStaffPersonIds: extraStaff.filter((personId) => personId !== ""),
        teachers,
        sessions: kept.map((school) => ({
          schoolId: school.id,
          heldOn: rows[school.id]!.date,
          startsAt: rows[school.id]!.time,
        })),
        // The guard above proves the six are set, so the `mode` casts hold.
        departure: {
          date: logistics.departureDate,
          time: logistics.departureTime,
          mode: logistics.departureMode as TransportMode,
        },
        return: {
          date: logistics.returnDate,
          time: logistics.returnTime,
          mode: logistics.returnMode as TransportMode,
        },
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
          id={subClusterFieldId}
          label="Kelompok Sekolah"
        >
          <Select
            items={Object.fromEntries(
              subClusters.map((entry) => [entry.id, `${entry.name} — ${entry.clusterName}`]),
            )}
            value={subClusterId === "" ? null : subClusterId}
            onValueChange={(value) => {
              pickSubCluster((value as string | null) ?? "");
            }}
          >
            <SelectTrigger
              id={subClusterFieldId}
              aria-label="Kelompok Sekolah"
            >
              <SelectValue placeholder="Pilih Kelompok Sekolah" />
            </SelectTrigger>
            <SelectContent>
              {subClusters.map((entry) => (
                <SelectItem
                  key={entry.id}
                  value={entry.id}
                >
                  {entry.name} — {entry.clusterName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            Fixed at planning and transferred before departure, so a Perjadin is never in an
            unfunded state — which is why this is on the planning form rather than the acquittal.

            A masked text input, not `type="number"`: it groups the thousands as they type so
            a seven-figure advance's magnitude is legible at the point of entry, which a numeric
            spinner cannot show. `advanceIdr` stays a plain digit string in state — every
            non-digit (the `Rp` affix, the dot separators) is stripped back out on change — so
            submit's `Number(...)` and the empty-value guard are unchanged. `inputMode="numeric"`
            keeps the mobile keypad; only the desktop spinner is lost, which nobody uses here.
          */}
          <Input
            id={advanceId}
            type="text"
            inputMode="numeric"
            value={trip.advanceIdr === "" ? "" : `Rp ${formatIdr(Number(trip.advanceIdr))}`}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
              setTrip((previous) => ({ ...previous, advanceIdr: digits }));
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
              id={`${idPrefix}-group-${stream}`}
              label={stream}
            >
              {/*
                The roster minus whoever holds the other Stream. A Group holds each person once,
                by primary key, and the write refuses a duplicate — this keeps the form from
                offering the mistake in the first place.
              */}
              <PersonSelect
                id={`${idPrefix}-group-${stream}`}
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

        <p className="mt-4 text-sm text-muted-foreground">
          Staf tambahan (opsional) — koordinator, bendahara, atau dokumentator. Hingga tiga orang,
          selain PIC.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {extraStaff.map((chosen, slot) => (
            <Field
              // Three fixed slots that are never reordered, so the position is a stable key.
              key={`extra-staff-slot-${slot}`}
              id={`${idPrefix}-extra-staff-${slot}`}
              label={`Staf ${slot + 1}`}
            >
              {/*
                The Staff roster minus the PIC and minus whoever the other slots hold, so a
                duplicate is never offered — the write refuses one too. Clearable back to empty via
                the unassigned item, because each slot is optional.
              */}
              <PersonSelect
                id={`${idPrefix}-extra-staff-${slot}`}
                people={staff.filter(
                  (entry) =>
                    entry.id === chosen ||
                    (entry.id !== trip.picPersonId &&
                      !extraStaff.some((other, index) => index !== slot && other === entry.id)),
                )}
                value={chosen}
                placeholder="Pilih Staf"
                unassignedLabel="Tanpa Staf"
                onSelect={(personId) => {
                  setExtraStaff((previous) => {
                    const next = [...previous] as [string, string, string];
                    next[slot] = personId;
                    return next;
                  });
                }}
              />
            </Field>
          ))}
        </div>
      </div>

      <div className="grid gap-4 border-b border-border px-7 py-5 sm:grid-cols-2">
        <TravelLeg
          idPrefix={`${idPrefix}-departure`}
          heading="Keberangkatan"
          note="Dari Bandung (WIB)."
          date={logistics.departureDate}
          time={logistics.departureTime}
          mode={logistics.departureMode}
          onChange={(patch) => {
            setLogistics((previous) => ({
              ...previous,
              departureDate: patch.date ?? previous.departureDate,
              departureTime: patch.time ?? previous.departureTime,
              departureMode: patch.mode ?? previous.departureMode,
            }));
          }}
        />
        <TravelLeg
          idPrefix={`${idPrefix}-return`}
          heading="Kepulangan"
          note="Zona waktu mengikuti Sekolah terakhir yang dikunjungi."
          date={logistics.returnDate}
          time={logistics.returnTime}
          mode={logistics.returnMode}
          onChange={(patch) => {
            setLogistics((previous) => ({
              ...previous,
              returnDate: patch.date ?? previous.returnDate,
              returnTime: patch.time ?? previous.returnTime,
              returnMode: patch.mode ?? previous.returnMode,
            }));
          }}
        />
      </div>

      {selected === undefined ? (
        <p className="px-7 py-6 text-sm text-muted-foreground">
          Pilih Kelompok Sekolah untuk menampilkan Sekolah-sekolahnya.
        </p>
      ) : (
        <ul className="border-b border-border">
          {schools.map((school) => {
            const row = rows[school.id] ?? { kept: true, date: "", time: "" };
            return (
              <li
                key={school.id}
                className="flex flex-wrap items-end gap-x-5 gap-y-2 border-b border-border px-7 py-3 last:border-b-0"
              >
                <div className="flex min-w-52 items-start gap-3">
                  <Checkbox
                    checked={row.kept}
                    onCheckedChange={(checked) => {
                      setRows((previous) => ({
                        ...previous,
                        [school.id]: { ...row, kept: checked === true },
                      }));
                    }}
                    aria-label={`Sertakan ${school.name}`}
                    className="mt-0.5"
                  />
                  <div className={row.kept ? undefined : "text-muted-foreground"}>
                    <p className="text-sm font-medium">{school.name}</p>
                    <p className="text-xs text-muted-foreground">{school.kabupatenKota}</p>
                  </div>
                </div>

                <Field
                  id={`${idPrefix}-date-${school.id}`}
                  label="Tanggal Sesi"
                >
                  {/*
                    `min`/`max` follow the trip, so the picker will not offer a day outside it.
                    The write checks it again — this is the browser being helpful, not the rule.
                  */}
                  <Input
                    id={`${idPrefix}-date-${school.id}`}
                    type="date"
                    className="w-44"
                    disabled={!row.kept}
                    min={trip.startsOn || undefined}
                    max={trip.endsOn || undefined}
                    value={row.date}
                    onChange={(event) => {
                      setRows((previous) => ({
                        ...previous,
                        [school.id]: { ...row, date: event.target.value },
                      }));
                    }}
                  />
                </Field>

                <Field
                  id={`${idPrefix}-time-${school.id}`}
                  label="Jam Mulai"
                >
                  {/* Local wall-clock time, in the School's Time Zone. Two Schools may share a
                      date but not a date and a time — the write names the pair if they do. */}
                  <Input
                    id={`${idPrefix}-time-${school.id}`}
                    type="time"
                    className="w-32"
                    disabled={!row.kept}
                    value={row.time}
                    onChange={(event) => {
                      setRows((previous) => ({
                        ...previous,
                        [school.id]: { ...row, time: event.target.value },
                      }));
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
          <b>{kept.length}</b> Sesi luring akan dijadwalkan
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
 * **Nothing was written**, and each of these says which field to fix rather than that something
 * went wrong. The per-School cases name the Schools, because the fix is per row: change that
 * School's date or time, or drop it.
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
          {result.outcome === "duplicate-staff" && (
            <p>Setiap Staf tambahan harus berbeda, dan bukan PIC.</p>
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
          {result.outcome === "school-outside-sub-cluster" && (
            <>
              <p>Sekolah berikut bukan bagian dari Kelompok Sekolah yang dipilih:</p>
              <ul className="mt-1.5 list-disc pl-4">
                {result.offending.map((schoolId) => (
                  <li key={schoolId}>{nameOf(schoolId)}</li>
                ))}
              </ul>
            </>
          )}
          {result.outcome === "session-time-clash" && (
            <>
              <p>Dua Sekolah tidak bisa berada di tanggal dan jam yang sama:</p>
              <ul className="mt-1.5 list-disc pl-4">
                {result.clashes.map((clash) => (
                  <li key={`${clash.heldOn} ${clash.startsAt}`}>
                    {clash.schoolIds.map(nameOf).join(", ")} · {clash.heldOn} {clash.startsAt}
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

/**
 * One travel leg on the plan form: a date, a wall-clock time and a transport mode. No zone
 * picker — the departure zone is WIB and the return zone is derived server-side from the last
 * School, so a control for it would offer a choice the form does not make.
 */
function TravelLeg({
  idPrefix,
  heading,
  note,
  date,
  time,
  mode,
  onChange,
}: {
  idPrefix: string;
  heading: string;
  note: string;
  date: string;
  time: string;
  mode: TransportMode | "";
  onChange: (patch: { date?: string; time?: string; mode?: TransportMode }) => void;
}) {
  return (
    <div className="grid gap-3">
      <div>
        <h2 className="font-heading text-sm font-medium">{heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{note}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          id={`${idPrefix}-date`}
          label="Tanggal"
        >
          <Input
            id={`${idPrefix}-date`}
            type="date"
            value={date}
            onChange={(event) => {
              onChange({ date: event.target.value });
            }}
          />
        </Field>
        <Field
          id={`${idPrefix}-time`}
          label="Jam"
        >
          <Input
            id={`${idPrefix}-time`}
            type="time"
            value={time}
            onChange={(event) => {
              onChange({ time: event.target.value });
            }}
          />
        </Field>
        <Field
          id={`${idPrefix}-mode`}
          label="Moda"
        >
          <Select
            items={Object.fromEntries(TRANSPORT_MODES.map((entry) => [entry, entry]))}
            value={mode === "" ? null : mode}
            onValueChange={(value) => {
              onChange({ mode: (value as TransportMode | null) ?? undefined });
            }}
          >
            <SelectTrigger
              id={`${idPrefix}-mode`}
              aria-label={`Moda ${heading}`}
            >
              <SelectValue placeholder="Pilih moda" />
            </SelectTrigger>
            <SelectContent>
              {TRANSPORT_MODES.map((entry) => (
                <SelectItem
                  key={entry}
                  value={entry}
                >
                  {entry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}

export { PerjadinPlanForm };
