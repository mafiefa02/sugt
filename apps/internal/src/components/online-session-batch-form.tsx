"use client";

import { arrangeOnlineSessionsAction } from "-/app/(app)/jadwalkan-sesi-daring/actions";
import type {
  ArrangeOnlineSessionsResult,
  BatchPerson,
  BatchSchool,
  OnlineSessionCollision,
  OnlineSessionRow,
} from "@sugt/db/queries";
import { STREAMS, type Stream } from "@sugt/domain";
import { Alert, AlertDescription, AlertTitle } from "@sugt/ui/components/alert";
import { Button } from "@sugt/ui/components/button";
import { Input } from "@sugt/ui/components/input";
import { Label } from "@sugt/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sugt/ui/components/select";
import { cn } from "@sugt/ui/lib/utils";
import Link from "next/link";
import { useId, useState, useTransition } from "react";

/**
 * The batch itself: one row per selected School, a shared date and a shared PIC above
 * them, and one submit.
 *
 * A client component because every row is editable and none of that state is worth a
 * URL. The two rosters and the Schools arrive from the server as props; nothing here
 * fetches. The Server Action is called with a typed array rather than through a
 * `<form action>` — the payload is nested (a row carries a list of teachers) and
 * `FormData` would mean flattening it on the way out and parsing it back on the way in,
 * with the type checker helping at neither end.
 *
 * **The shared controls are defaults, and a default does not overwrite an edit.** The
 * ticket asks for *"a shared **default** date and a shared Staff PIC applied across the
 * selection, every row still editable before submit"*, and the word **default** is the
 * whole of it: setting a shared value fills every row that has not been edited by hand,
 * and leaves the ones that have. Write-through would satisfy the checklist and break the
 * prose — set the shared date, change one School because it only takes Wednesdays, then
 * correct the shared date, and that deliberate edit would be reverted with nothing said.
 *
 * That is why `pinned` exists rather than a value comparison. Once a shared value has
 * been applied, every row holds it, so "has this row been edited" cannot be read off the
 * values — it has to be remembered.
 */
function OnlineSessionBatchForm({
  schools,
  staff,
  teachingTeam,
}: {
  schools: BatchSchool[];
  staff: BatchPerson[];
  teachingTeam: BatchPerson[];
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(schools.map((school) => [school.id, EMPTY_DRAFT])),
  );
  const [shared, setShared] = useState<{ heldOn: string; picPersonId: string }>({
    heldOn: "",
    picPersonId: "",
  });
  const [result, setResult] = useState<ArrangeOnlineSessionsResult | null>(null);
  const [pinned, setPinned] = useState<ReadonlySet<string>>(new Set());
  const [saving, startSaving] = useTransition();

  const sharedDateId = useId();
  const sharedPicId = useId();

  /**
   * Edit one row's field, and **pin it** so a later shared value leaves it alone.
   *
   * A row is pinned per field rather than as a whole: a School whose date is fixed but
   * whose PIC is not should still take a shared PIC.
   */
  function editRow(schoolId: string, field: SharedField, value: string) {
    setDrafts((previous) => ({
      ...previous,
      [schoolId]: { ...previous[schoolId]!, [field]: value },
    }));
    setPinned((previous) => new Set(previous).add(pinOf(schoolId, field)));
    // A row that has just been edited is no longer the row that collided. Clearing the
    // whole result rather than the one row is deliberate: the batch is refused whole, so
    // a stale "this failed" beside a row nobody has fixed would be worse than none.
    setResult(null);
  }

  /** Naming a teacher is not one of the two shared fields, so it pins nothing. */
  function editTeacher(schoolId: string, stream: Stream, personId: string) {
    setDrafts((previous) => ({
      ...previous,
      [schoolId]: {
        ...previous[schoolId]!,
        teachers: { ...previous[schoolId]!.teachers, [stream]: personId },
      },
    }));
    setResult(null);
  }

  /** Seed every row that has not been edited by hand. See the note on this component. */
  function applyShared(field: SharedField, value: string) {
    setShared((previous) => ({ ...previous, [field]: value }));
    setDrafts((previous) =>
      Object.fromEntries(
        Object.entries(previous).map(([schoolId, draft]) => [
          schoolId,
          pinned.has(pinOf(schoolId, field)) ? draft : { ...draft, [field]: value },
        ]),
      ),
    );
    setResult(null);
  }

  /**
   * Rows still missing a value the database requires. `held_on` is NOT NULL and every
   * online Session must name a PIC, by CHECK — so the screen refuses to offer a submit
   * that could only be rejected. Teachers are **not** counted: naming them is optional
   * at arrangement and mandatory at Tandai terlaksana.
   */
  const incomplete = schools.filter((school) => !isComplete(drafts[school.id]!));

  const collidedSchoolIds = new Set(
    result?.outcome === "collided" ? result.collisions.map((entry) => entry.schoolId) : [],
  );

  function submit() {
    const rows: OnlineSessionRow[] = schools.map((school) =>
      rowFrom(school.id, drafts[school.id]!),
    );

    startSaving(async () => {
      setResult(await arrangeOnlineSessionsAction(rows));
    });
  }

  if (result?.outcome === "arranged") {
    return (
      <Arranged
        schools={schools}
        drafts={drafts}
      />
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-wrap items-end gap-5 border-b border-border px-7 py-5">
        <div className="grid gap-1.5">
          <Label htmlFor={sharedDateId}>Tanggal untuk semua baris</Label>
          <Input
            id={sharedDateId}
            type="date"
            className="w-44"
            value={shared.heldOn}
            onChange={(event) => {
              applyShared("heldOn", event.target.value);
            }}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={sharedPicId}>PIC untuk semua baris</Label>
          <PersonSelect
            id={sharedPicId}
            people={staff}
            value={shared.picPersonId}
            placeholder="Pilih PIC"
            onSelect={(picPersonId) => {
              applyShared("picPersonId", picPersonId);
            }}
          />
        </div>
      </div>

      {result?.outcome === "collided" && (
        <Collided
          collisions={result.collisions}
          schools={schools}
        />
      )}

      <ul className="flex-1">
        {schools.map((school) => (
          <li
            key={school.id}
            className={cn(
              "flex flex-wrap items-end gap-x-5 gap-y-3 border-b border-border px-7 py-3.5",
              collidedSchoolIds.has(school.id) && "bg-destructive/8",
            )}
          >
            <div className="min-w-52 flex-1">
              <p className="text-sm font-medium">{school.name}</p>
              <p className="text-xs text-muted-foreground">{school.kabupatenKota}</p>
            </div>

            <RowField label="Tanggal">
              <Input
                type="date"
                className="w-40"
                aria-label={`Tanggal Sesi daring untuk ${school.name}`}
                aria-invalid={collidedSchoolIds.has(school.id)}
                value={drafts[school.id]!.heldOn}
                onChange={(event) => {
                  editRow(school.id, "heldOn", event.target.value);
                }}
              />
            </RowField>

            <RowField label="PIC">
              <PersonSelect
                people={staff}
                value={drafts[school.id]!.picPersonId}
                placeholder="Pilih PIC"
                aria-label={`PIC Sesi daring untuk ${school.name}`}
                onSelect={(picPersonId) => {
                  editRow(school.id, "picPersonId", picPersonId);
                }}
              />
            </RowField>

            {STREAMS.map((stream) => (
              <RowField
                key={stream}
                label={stream}
              >
                <PersonSelect
                  people={teachingTeam}
                  value={drafts[school.id]!.teachers[stream]}
                  unassignedLabel={UNASSIGNED_LABEL}
                  aria-label={`Pengajar ${stream} untuk ${school.name}`}
                  onSelect={(personId) => {
                    editTeacher(school.id, stream, personId);
                  }}
                />
              </RowField>
            ))}
          </li>
        ))}
      </ul>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-7 py-3.5 shadow-lg">
        <p className="text-sm">
          <b>{schools.length}</b> Sesi daring akan dijadwalkan
          {incomplete.length > 0 && (
            <span className="text-muted-foreground">
              {" "}
              · {incomplete.length} baris belum punya tanggal atau PIC
            </span>
          )}
        </p>

        <div className="flex gap-2.5">
          <Button
            variant="ghost"
            render={<Link href="/coverage" />}
          >
            Batal
          </Button>
          <Button
            disabled={incomplete.length > 0 || saving}
            onClick={submit}
          >
            {saving ? "Menyimpan…" : "Jadwalkan"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * What one row holds while it is being edited.
 *
 * `""` is the unset value throughout, for the PIC and for both teachers alike. A teacher
 * left at `""` is dropped on the way out — naming one is optional at arrangement — and a
 * PIC left at `""` is what `isComplete` refuses.
 */
type Draft = {
  heldOn: string;
  picPersonId: string;
  teachers: Record<Stream, string>;
};

/** The two fields a shared control seeds, and so the two a row can pin against one. */
type SharedField = "heldOn" | "picPersonId";

/** One row's pin on one field. A `Set` of these is the whole "do not overwrite" record. */
const pinOf = (schoolId: string, field: SharedField) => `${schoolId} ${field}`;

const UNASSIGNED = "";
const UNASSIGNED_LABEL = "Belum ditentukan";

const EMPTY_DRAFT: Draft = {
  heldOn: "",
  picPersonId: UNASSIGNED,
  teachers: { STEM: UNASSIGNED, Research: UNASSIGNED },
};

function isComplete(draft: Draft): boolean {
  return draft.heldOn !== "" && draft.picPersonId !== UNASSIGNED;
}

/** One row as `@sugt/db` wants it: the unnamed Streams do not travel. */
function rowFrom(schoolId: string, draft: Draft): OnlineSessionRow {
  return {
    schoolId,
    heldOn: draft.heldOn,
    picPersonId: draft.picPersonId,
    teachers: STREAMS.filter((stream) => draft.teachers[stream] !== UNASSIGNED).map((stream) => ({
      stream,
      personId: draft.teachers[stream],
    })),
  };
}

/**
 * A picker over one roster.
 *
 * `unassignedLabel` is what makes it serve both jobs. The PIC is required, so its picker
 * has no way back to nothing and shows a placeholder until one is chosen; a Stream may
 * be left unnamed, so its picker carries an explicit option saying so. An option a
 * reader can see beats a control that has to be cleared some other way.
 */
function PersonSelect({
  people,
  value,
  onSelect,
  placeholder,
  unassignedLabel,
  id,
  "aria-label": ariaLabel,
}: {
  people: BatchPerson[];
  value: string;
  onSelect: (personId: string) => void;
  placeholder?: string;
  unassignedLabel?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const items: Record<string, string> = Object.fromEntries([
    ...(unassignedLabel === undefined ? [] : [[UNASSIGNED, unassignedLabel]]),
    ...people.map((entry) => [entry.id, entry.fullName]),
  ]);

  return (
    <Select
      items={items}
      value={value === UNASSIGNED && unassignedLabel === undefined ? null : value}
      onValueChange={(selected) => {
        onSelect((selected as string | null) ?? UNASSIGNED);
      }}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className="w-44"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {unassignedLabel !== undefined && (
          <SelectItem value={UNASSIGNED}>{unassignedLabel}</SelectItem>
        )}
        {people.map((entry) => (
          <SelectItem
            key={entry.id}
            value={entry.id}
          >
            {entry.fullName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RowField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/**
 * What a refused batch says.
 *
 * **It names the Schools rather than counting them**, because the fix is per row: change
 * that School's date, or drop it from the selection. It also says that nothing was
 * written, which is not obvious from a list of failures and is the difference between
 * retrying the batch and retrying only part of it.
 */
function Collided({
  collisions,
  schools,
}: {
  collisions: OnlineSessionCollision[];
  schools: BatchSchool[];
}) {
  const nameOf = (schoolId: string) =>
    schools.find((school) => school.id === schoolId)?.name ?? schoolId;

  return (
    <div className="px-7 pt-5">
      <Alert variant="destructive">
        <AlertTitle>Tidak ada Sesi yang dijadwalkan.</AlertTitle>
        <AlertDescription>
          <p>
            Sekolah berikut sudah punya Sesi daring pada tanggal tersebut. Ubah tanggalnya, lalu
            simpan lagi.
          </p>
          <ul className="mt-1.5 list-disc pl-4">
            {collisions.map((collision) => (
              <li key={collision.schoolId}>
                {nameOf(collision.schoolId)} · {collision.heldOn}
              </li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}

/**
 * What was written, once it was.
 *
 * It replaces the form rather than sitting above it. The batch has happened, and a form
 * still holding the values that produced it invites a second submit that could now only
 * collide with the first.
 *
 * The Sessions themselves are read on **Detail Sekolah**, which is where a Session is
 * reached from — this panel says what happened and points at it rather than growing a
 * second Session list of its own.
 */
function Arranged({ schools, drafts }: { schools: BatchSchool[]; drafts: Record<string, Draft> }) {
  return (
    <div className="flex flex-col items-start gap-3.5 p-7">
      <Alert>
        <AlertTitle>{schools.length} Sesi daring dijadwalkan.</AlertTitle>
        <AlertDescription>
          <ul className="list-disc pl-4">
            {schools.map((school) => (
              <li key={school.id}>
                {school.name} · {drafts[school.id]!.heldOn}
              </li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>

      <div className="flex gap-2.5">
        <Button render={<Link href="/coverage" />}>Kembali ke Coverage</Button>
        <Button
          variant="outline"
          render={<Link href="/sekolah" />}
        >
          Buka Direktori Sekolah
        </Button>
      </div>
    </div>
  );
}

export { OnlineSessionBatchForm };
