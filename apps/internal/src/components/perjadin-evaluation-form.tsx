"use client";

import { filePerjadinEvaluationAction } from "-/app/(app)/perjadin/[id]/actions";
import type { PerjadinEvaluationRatings } from "@sugt/db/queries";
import { CONCERN_AT_OR_BELOW, RATING_MAX, RATING_MIN, type PerjadinAspect } from "@sugt/domain";
import { Alert, AlertDescription, AlertTitle } from "@sugt/ui/components/alert";
import { Button } from "@sugt/ui/components/button";
import { Checkbox } from "@sugt/ui/components/checkbox";
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
 * **The Perjadin Evaluation form** — how the trip went, filed by a member of the Group.
 *
 * A client component, offered from the money-free Perjadin detail screen to whoever was on the
 * Group. It deliberately matches the Session Record's shape, one Aspect richer in one way: the
 * dialog shell and the two field helpers below are a **sibling copy** of `record-forms.tsx`
 * rather than a shared extraction. The two #31 forms carry no runtime test, so a shared shell
 * could not tell whether a change broke one of them — a copy that diverges is cheaper than a
 * regression no gate would catch. A fourth form is when extraction earns its keep.
 *
 * **`lodging` is the one Aspect a Group may leave blank** — a day trip has no hotel to rate.
 * *Tidak menginap* nulls it, and it then drops out of the elaboration check exactly as
 * Postgres `least()` drops a NULL. The other three are always rated. The rule is checked here
 * for the message and again in `filePerjadinEvaluation` for the fact, behind the database CHECK.
 */

/**
 * The Aspect names in Indonesian — the form copy around the English domain terms, the same edge
 * translation `record-forms.tsx` makes and `CONTEXT.md` § *Language* asks for.
 */
const PERJADIN_ASPECT_LABELS: Record<PerjadinAspect, string> = {
  lodging: "Penginapan",
  transport: "Transportasi",
  meals: "Konsumsi",
  punctuality: "Ketepatan waktu",
};

/** The three Aspects that are always rated. `lodging` is handled on its own, because it is nullable. */
const ALWAYS_RATED = ["transport", "meals", "punctuality"] as const;
type AlwaysRated = (typeof ALWAYS_RATED)[number];

const INSTRUCTION = `Beri nilai ${RATING_MIN}–${RATING_MAX} untuk tiap aspek. Nilai ${CONCERN_AT_OR_BELOW} ke bawah wajib disertai penjelasan pada Kendala.`;

/** The message the Kendala field carries when a low Rating owes prose. */
const PROSE_REQUIRED = `Nilai ${CONCERN_AT_OR_BELOW} ke bawah wajib disertai penjelasan.`;

/** What a refusal the screen did not predict says — a page held open while the trip's Group changed. */
const STALE_MESSAGES = {
  "not-a-group-member": "Hanya anggota Group perjalanan ini yang bisa mengisi Evaluasi.",
  "already-filed": "Evaluasi ini sudah pernah diisi. Muat ulang halaman untuk melihat keadaannya.",
} as const;

function PerjadinEvaluationDialog({ perjadinId }: { perjadinId: string }) {
  const [open, setOpen] = useState(false);
  const [lodging, setLodging] = useState<number | undefined>(undefined);
  const [noLodging, setNoLodging] = useState(false);
  const [others, setOthers] = useState<Partial<Record<AlwaysRated, number>>>({});
  const [problems, setProblems] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [proseNeeded, setProseNeeded] = useState(false);
  const [stale, setStale] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const namePrefix = useId();
  const noLodgingId = useId();

  const othersRated = ALWAYS_RATED.every((aspect) => others[aspect] !== undefined);
  const lodgingSettled = noLodging || lodging !== undefined;
  const canSubmit = othersRated && lodgingSettled;

  function submit() {
    if (!canSubmit) return;
    // A null lodging must be a choice — *Tidak menginap* — never an unrated control degrading
    // into one. The column is nullable by design, so the write cannot catch a mistake here.
    if (!noLodging && lodging === undefined) return;

    const ratings: PerjadinEvaluationRatings = {
      lodging: noLodging ? null : lodging!,
      transport: others.transport!,
      meals: others.meals!,
      punctuality: others.punctuality!,
    };

    // Checked here so the message lands on the Kendala field, and again in the write function
    // so it is a rule rather than a convenience. A null lodging is not in the set, exactly as
    // Postgres `least()` leaves it out.
    const given = [ratings.lodging, ratings.transport, ratings.meals, ratings.punctuality].filter(
      (value): value is number => value !== null,
    );
    if (Math.min(...given) <= CONCERN_AT_OR_BELOW && problems.trim() === "") {
      setProseNeeded(true);
      return;
    }

    startSaving(async () => {
      const result = await filePerjadinEvaluationAction({
        perjadinId,
        ratings,
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
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger render={<Button variant="outline">Isi Evaluasi Perjadin</Button>} />
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Evaluasi Perjadin</DialogTitle>
          <DialogDescription>{INSTRUCTION}</DialogDescription>
        </DialogHeader>

        {stale !== null && (
          <Alert variant="destructive">
            <AlertTitle>Tidak jadi disimpan.</AlertTitle>
            <AlertDescription>{stale}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3.5">
          <div className="grid gap-2">
            <RatingField
              namePrefix={namePrefix}
              aspect="lodging"
              label={PERJADIN_ASPECT_LABELS.lodging}
              value={lodging}
              disabled={noLodging}
              onValueChange={(value) => {
                setLodging(value);
                setProseNeeded(false);
              }}
            />
            <Label className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
              <Checkbox
                id={noLodgingId}
                checked={noLodging}
                onCheckedChange={(checked) => {
                  setNoLodging(checked === true);
                  if (checked === true) setLodging(undefined);
                  // Skipping lodging can only lower the minimum's obligations, never raise them,
                  // so a prose warning from a now-removed low lodging must clear like the others.
                  setProseNeeded(false);
                }}
              />
              Tidak menginap (perjalanan pulang-hari)
            </Label>
          </div>

          {ALWAYS_RATED.map((aspect) => (
            <RatingField
              key={aspect}
              namePrefix={namePrefix}
              aspect={aspect}
              label={PERJADIN_ASPECT_LABELS[aspect]}
              value={others[aspect]}
              onValueChange={(value) => {
                setOthers((previous) => ({ ...previous, [aspect]: value }));
                setProseNeeded(false);
              }}
            />
          ))}

          <ProseField
            label="Kendala"
            value={problems}
            invalid={proseNeeded}
            message={proseNeeded ? PROSE_REQUIRED : undefined}
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
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false);
            }}
          >
            Batal
          </Button>
          <Button
            disabled={saving || !canSubmit}
            onClick={submit}
          >
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One Aspect's label and its 1–10 control. A sibling of `record-forms.tsx`'s, carrying one extra
 * prop: `lodging` disables its control when the Group did not stay anywhere. The `name` is
 * namespaced so two dialogs on one page do not fuse into a single radio group.
 */
function RatingField({
  namePrefix,
  aspect,
  label,
  value,
  disabled,
  onValueChange,
}: {
  namePrefix: string;
  aspect: string;
  label: string;
  value: number | undefined;
  disabled?: boolean;
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
        disabled={disabled}
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

/** A blank or whitespace-only field travels as nothing, matching the write's own `prose`. */
function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export { PerjadinEvaluationDialog };
