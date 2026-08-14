"use client";

import { arrangeOnlineSessionAction } from "-/app/(app)/jadwalkan-sesi-daring/actions";
import { PersonSelect } from "-/components/person-select";
import type { ArrangePerson, OnlineSessionTeacher, SchoolOption } from "@sugt/db/queries";
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
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

/**
 * Arrange **one** online Session (#70). Two entry points share this component: the standalone
 * screen leads with a School picker (`schools`), and Detail Sekolah pins the School it is on
 * (`school`). Exactly one of the two is passed.
 *
 * A client component because every field is editable and none of that state is worth a URL. The
 * pickers and Schools arrive from the server as props; nothing here fetches. The Server Action
 * is called with a typed value rather than through a `<form action>`, because the payload is
 * nested — a list of teachers — and `FormData` would mean flattening it out and parsing it back
 * with the type checker helping at neither end.
 */
function ArrangeOnlineSessionForm({
  school,
  schools,
  staff,
  teachingTeam,
}: {
  staff: ArrangePerson[];
  teachingTeam: ArrangePerson[];
} & (
  | /** Detail Sekolah pins the School. */ { school: SchoolOption; schools?: never }
  | /** The standalone screen offers a picker. */ { school?: never; schools: SchoolOption[] }
)) {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState(school?.id ?? "");
  const [heldOn, setHeldOn] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [picPersonId, setPicPersonId] = useState("");
  const [teachers, setTeachers] = useState<Record<Stream, string>>({ STEM: "", Research: "" });
  const [collidedOn, setCollidedOn] = useState<string | null>(null);
  const [arranged, setArranged] = useState(false);
  const [saving, startSaving] = useTransition();

  const schoolFieldId = useId();
  const dateId = useId();
  const timeId = useId();
  const picId = useId();
  const idPrefix = useId();

  // `held_on` and `starts_at` are NOT NULL and every online Session must name a PIC, by CHECK —
  // so the screen refuses a submit that could only be rejected. Teachers are optional at
  // arrangement (mandatory at Tandai terlaksana), so they are not required here.
  const incomplete = schoolId === "" || heldOn === "" || startsAt === "" || picPersonId === "";

  function reset() {
    setHeldOn("");
    setStartsAt("");
    setPicPersonId("");
    setTeachers({ STEM: "", Research: "" });
    setArranged(false);
    setCollidedOn(null);
  }

  function submit() {
    const named: OnlineSessionTeacher[] = STREAMS.filter((stream) => teachers[stream] !== "").map(
      (stream) => ({ stream, personId: teachers[stream] }),
    );

    startSaving(async () => {
      const result = await arrangeOnlineSessionAction({
        schoolId,
        heldOn,
        startsAt,
        picPersonId,
        teachers: named,
      });

      if (result.outcome === "arranged") {
        setArranged(true);
        setCollidedOn(null);
        // Detail Sekolah reads its Sessions on the server; refresh so the new one appears.
        router.refresh();
        return;
      }
      setCollidedOn(result.heldOn);
    });
  }

  if (arranged) {
    return (
      <div className="flex flex-col items-start gap-3.5 px-7 py-5">
        <Alert>
          <AlertTitle>Sesi daring dijadwalkan.</AlertTitle>
          <AlertDescription>Sesi baru muncul di daftar Sesi Sekolah ini.</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onClick={reset}
        >
          Jadwalkan lagi
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-7 py-5">
      {collidedOn !== null && (
        <Alert variant="destructive">
          <AlertTitle>Sesi belum dijadwalkan.</AlertTitle>
          <AlertDescription>
            Sekolah ini sudah punya Sesi daring pada {collidedOn}. Ubah tanggalnya, lalu simpan
            lagi.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {school === undefined ? (
          <Field
            id={schoolFieldId}
            label="Sekolah"
          >
            <Select
              items={Object.fromEntries((schools ?? []).map((entry) => [entry.id, entry.name]))}
              value={schoolId === "" ? null : schoolId}
              onValueChange={(value) => {
                setSchoolId((value as string | null) ?? "");
                setCollidedOn(null);
              }}
            >
              <SelectTrigger
                id={schoolFieldId}
                aria-label="Sekolah"
              >
                <SelectValue placeholder="Pilih Sekolah" />
              </SelectTrigger>
              <SelectContent>
                {(schools ?? []).map((entry) => (
                  <SelectItem
                    key={entry.id}
                    value={entry.id}
                  >
                    {entry.name} — {entry.kabupatenKota}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">Sekolah</span>
            <p className="text-sm font-medium">{school.name}</p>
          </div>
        )}

        <Field
          id={picId}
          label="PIC"
        >
          <PersonSelect
            id={picId}
            people={staff}
            value={picPersonId}
            placeholder="Pilih PIC"
            onSelect={(personId) => {
              setPicPersonId(personId);
              setCollidedOn(null);
            }}
          />
        </Field>

        <Field
          id={dateId}
          label="Tanggal"
        >
          <Input
            id={dateId}
            type="date"
            className="w-44"
            value={heldOn}
            onChange={(event) => {
              setHeldOn(event.target.value);
              setCollidedOn(null);
            }}
          />
        </Field>

        <Field
          id={timeId}
          label="Jam Mulai"
        >
          {/* Local wall-clock time, in the School's Time Zone. */}
          <Input
            id={timeId}
            type="time"
            className="w-32"
            value={startsAt}
            onChange={(event) => {
              setStartsAt(event.target.value);
            }}
          />
        </Field>

        {STREAMS.map((stream) => (
          <Field
            key={stream}
            id={`${idPrefix}-${stream}`}
            label={`Pengajar ${stream}`}
          >
            {/* Optional at arrangement — "Belum ditentukan" leaves the Stream unnamed. */}
            <PersonSelect
              id={`${idPrefix}-${stream}`}
              people={teachingTeam}
              value={teachers[stream]}
              unassignedLabel="Belum ditentukan"
              onSelect={(personId) => {
                setTeachers((previous) => ({ ...previous, [stream]: personId }));
              }}
            />
          </Field>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          disabled={incomplete || saving}
          onClick={submit}
        >
          {saving ? "Menyimpan…" : "Jadwalkan"}
        </Button>
      </div>
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

export { ArrangeOnlineSessionForm };
