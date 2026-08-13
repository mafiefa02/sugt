"use client";

import { fileClassRecordAction, fileSessionRecordAction } from "-/app/(app)/sesi/[id]/actions";
import {
  CLASS_RECORD_ASPECTS,
  CONCERN_AT_OR_BELOW,
  RATING_MAX,
  RATING_MIN,
  SESSION_RECORD_ASPECTS,
  type ClassKind,
  type ClassRecordAspect,
  type SessionRecordAspect,
} from "@sugt/domain";
import { Alert, AlertDescription, AlertTitle } from "@sugt/ui/components/alert";
import { Button } from "@sugt/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@sugt/ui/components/dialog";
import { Label } from "@sugt/ui/components/label";
import { RatingInput } from "@sugt/ui/components/rating-input";
import { Textarea } from "@sugt/ui/components/textarea";
import { useId, useState, useTransition } from "react";

/**
 * The two internal evaluation forms. A **Class Record** is one professor's account of one
 * Class they taught (seven Aspects); a **Session Record** is the PIC's account of the visit
 * (five). Both are offered from the "who still owes what" list on Detail Sesi, to the person
 * who owes the Record and nobody else — so a Teaching Team member sees their Class Records
 * and the PIC sees the Session Record, and neither appears until the Session is delivered.
 *
 * Client components because each holds a rubric's worth of form state, and none of it is
 * worth a URL. The seams are the actions; nothing here fetches.
 *
 * **The elaboration rule is checked here and again in the write.** A Rating of 7 or below
 * needs prose, and this catches it before the round trip so the message lands on the field —
 * `fileClassRecord`/`fileSessionRecord` hold the same rule, and the database CHECK holds it
 * behind them. That is the rule `docs/data-model.md` calls _enforced twice by design_,
 * enforced here for the message and there for the fact.
 */

/**
 * The Aspect names in Indonesian, for the same reason `CLASS_LABELS` on `./session-records.tsx`
 * translates *Siswa*: the Aspects are English domain terms (`CONTEXT.md` § *Language*), and
 * this is the form copy around them, which is Indonesian. A filer is asked to score
 * *Pemahaman*, not `comprehension`. The translation lives at this edge rather than in
 * `@sugt/domain`, which names the columns and stays English.
 */
const CLASS_ASPECT_LABELS: Record<ClassRecordAspect, string> = {
  comprehension: "Pemahaman",
  participation: "Partisipasi",
  readiness: "Kesiapan",
  materials: "Materi",
  delivery: "Penyampaian",
  facilities: "Fasilitas",
  timing: "Ketepatan waktu",
};

const SESSION_ASPECT_LABELS: Record<SessionRecordAspect, string> = {
  facilities: "Fasilitas",
  turnout: "Kehadiran",
  school_support: "Dukungan sekolah",
  timing: "Ketepatan waktu",
  coordination: "Koordinasi",
};

const INSTRUCTION =
  "Beri nilai 1–10 untuk tiap aspek. Nilai 7 ke bawah wajib disertai penjelasan pada Kendala.";

/** What a refusal the screen did not predict says — a page held open while the Session moved. */
const STALE_MESSAGES = {
  "session-not-delivered":
    "Sesi ini belum ditandai terlaksana. Muat ulang halaman untuk melihat keadaannya.",
  "already-filed": "Catatan ini sudah pernah diisi. Muat ulang halaman untuk melihat keadaannya.",
  "not-teaching-team": "Hanya anggota Teaching Team yang bisa mengisi Catatan Kelas.",
} as const;

/**
 * **File a Class Record** — seven Aspects, plus what was covered, what went wrong and what to
 * do differently. Filed by the Teaching Team member who taught the Class.
 */
function ClassRecordDialog({
  sessionId,
  classKind,
  classLabel,
}: {
  sessionId: string;
  classKind: ClassKind;
  classLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [ratings, setRatings] = useState<Partial<Record<ClassRecordAspect, number>>>({});
  const [covered, setCovered] = useState("");
  const [problems, setProblems] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [proseNeeded, setProseNeeded] = useState(false);
  const [stale, setStale] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const namePrefix = useId();

  const full = complete(CLASS_RECORD_ASPECTS, ratings);

  function submit() {
    if (full === null) return;

    // Checked here so the message lands on the Kendala field, and again in the write function
    // so it is a rule rather than a convenience.
    if (belowThreshold(Object.values(full)) && problems.trim() === "") {
      setProseNeeded(true);
      return;
    }

    startSaving(async () => {
      const result = await fileClassRecordAction({
        sessionId,
        classKind,
        ratings: full,
        covered: blankToNull(covered),
        problems: blankToNull(problems),
        suggestions: blankToNull(suggestions),
      });
      if (result.outcome === "filed") {
        setOpen(false);
        return;
      }
      if (result.outcome === "prose-required") setProseNeeded(true);
      else setStale(STALE_MESSAGES[result.outcome]);
    });
  }

  return (
    <RecordDialog
      open={open}
      onOpenChange={setOpen}
      title={`Catatan Kelas ${classLabel}`}
      stale={stale}
      saving={saving}
      canSubmit={full !== null}
      onSubmit={submit}
    >
      {CLASS_RECORD_ASPECTS.map((aspect) => (
        <RatingField
          key={aspect}
          namePrefix={namePrefix}
          aspect={aspect}
          label={CLASS_ASPECT_LABELS[aspect]}
          value={ratings[aspect]}
          onValueChange={(value) => {
            setRatings((previous) => ({ ...previous, [aspect]: value }));
            setProseNeeded(false);
          }}
        />
      ))}

      <ProseField
        label="Yang diajarkan"
        value={covered}
        onChange={setCovered}
      />
      <ProseField
        label="Kendala"
        value={problems}
        invalid={proseNeeded}
        message={proseNeeded ? "Nilai 7 ke bawah wajib disertai penjelasan." : undefined}
        onChange={(value) => {
          setProblems(value);
          setProseNeeded(false);
        }}
      />
      <ProseField
        label="Saran"
        value={suggestions}
        onChange={setSuggestions}
      />
    </RecordDialog>
  );
}

/**
 * **File a Session Record** — five Aspects, plus what went wrong and what to do differently.
 * No *Yang diajarkan*: the PIC taught nothing. Filed by the PIC, who is Staff.
 */
function SessionRecordDialog({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [ratings, setRatings] = useState<Partial<Record<SessionRecordAspect, number>>>({});
  const [problems, setProblems] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [proseNeeded, setProseNeeded] = useState(false);
  const [stale, setStale] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const namePrefix = useId();

  const full = complete(SESSION_RECORD_ASPECTS, ratings);

  function submit() {
    if (full === null) return;

    if (belowThreshold(Object.values(full)) && problems.trim() === "") {
      setProseNeeded(true);
      return;
    }

    startSaving(async () => {
      const result = await fileSessionRecordAction({
        sessionId,
        ratings: full,
        problems: blankToNull(problems),
        suggestions: blankToNull(suggestions),
      });
      if (result.outcome === "filed") {
        setOpen(false);
        return;
      }
      if (result.outcome === "prose-required") setProseNeeded(true);
      else setStale(STALE_MESSAGES[result.outcome]);
    });
  }

  return (
    <RecordDialog
      open={open}
      onOpenChange={setOpen}
      title="Catatan Sesi"
      stale={stale}
      saving={saving}
      canSubmit={full !== null}
      onSubmit={submit}
    >
      {SESSION_RECORD_ASPECTS.map((aspect) => (
        <RatingField
          key={aspect}
          namePrefix={namePrefix}
          aspect={aspect}
          label={SESSION_ASPECT_LABELS[aspect]}
          value={ratings[aspect]}
          onValueChange={(value) => {
            setRatings((previous) => ({ ...previous, [aspect]: value }));
            setProseNeeded(false);
          }}
        />
      ))}

      <ProseField
        label="Kendala"
        value={problems}
        invalid={proseNeeded}
        message={proseNeeded ? "Nilai 7 ke bawah wajib disertai penjelasan." : undefined}
        onChange={(value) => {
          setProblems(value);
          setProseNeeded(false);
        }}
      />
      <ProseField
        label="Saran"
        value={suggestions}
        onChange={setSuggestions}
      />
    </RecordDialog>
  );
}

/**
 * The dialog both forms share: the trigger, the instruction, the refusal alert and the
 * footer. The two differ in their title, their Aspects and which action they call — the
 * rubric arrives as children. **One component because the submit-guard-and-refusal shape is
 * the part worth having once.**
 */
function RecordDialog({
  open,
  onOpenChange,
  title,
  stale,
  saving,
  canSubmit,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  stale: string | null;
  saving: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
          >
            Isi
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{INSTRUCTION}</DialogDescription>
        </DialogHeader>

        {stale !== null && (
          <Alert variant="destructive">
            <AlertTitle>Tidak jadi disimpan.</AlertTitle>
            <AlertDescription>{stale}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3.5">{children}</div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Batal
          </Button>
          <Button
            disabled={saving || !canSubmit}
            onClick={onSubmit}
          >
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One Aspect's label and its 1–10 control. The `name` is namespaced so two dialogs on one
 * page do not fuse into a single radio group. */
function RatingField({
  namePrefix,
  aspect,
  label,
  value,
  onValueChange,
}: {
  namePrefix: string;
  aspect: string;
  label: string;
  value: number | undefined;
  onValueChange: (value: number) => void;
}) {
  const labelId = useId();

  return (
    <div className="flex items-center justify-between gap-3">
      <Label id={labelId}>{label}</Label>
      <RatingInput
        name={`${namePrefix}-${aspect}`}
        aria-labelledby={labelId}
        min={RATING_MIN}
        max={RATING_MAX}
        concernAtOrBelow={CONCERN_AT_OR_BELOW}
        value={value}
        onValueChange={onValueChange}
      />
    </div>
  );
}

/** One free-text field. `Kendala` carries the elaboration message when a low Rating owes one. */
function ProseField({
  label,
  value,
  invalid,
  message,
  onChange,
}: {
  label: string;
  value: string;
  invalid?: boolean;
  message?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        aria-invalid={invalid}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {message !== undefined && <p className="text-sm text-destructive">{message}</p>}
    </div>
  );
}

/** The complete rubric, or `null` while any Aspect is still unrated. */
function complete<A extends string>(
  aspects: readonly A[],
  values: Partial<Record<A, number>>,
): Record<A, number> | null {
  const full = {} as Record<A, number>;
  for (const aspect of aspects) {
    const value = values[aspect];
    if (value === undefined) return null;
    full[aspect] = value;
  }
  return full;
}

/** Whether the lowest Rating reaches the concerns threshold, which is when prose is owed. */
function belowThreshold(ratings: number[]): boolean {
  return Math.min(...ratings) <= CONCERN_AT_OR_BELOW;
}

/** A blank or whitespace-only field travels as nothing, matching the write's own `prose`. */
function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export { ClassRecordDialog, SessionRecordDialog };
