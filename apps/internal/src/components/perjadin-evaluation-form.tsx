"use client";

import { filePerjadinEvaluationAction } from "-/app/(app)/perjadin/[id]/actions";
import type { PerjadinEvaluationRatings } from "@sugt/db/queries";
import {
  CONCERN_AT_OR_BELOW,
  PERJADIN_ASPECTS,
  RATING_MAX,
  RATING_MIN,
  type PerjadinAspect,
} from "@sugt/domain";
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

/**
 * The Aspects that are always rated — `PERJADIN_ASPECTS` without `lodging`, which is handled on
 * its own because it is nullable. Derived from the domain list rather than restated, so a new
 * Aspect there reaches the form without a second edit.
 */
type AlwaysRated = Exclude<PerjadinAspect, "lodging">;
const ALWAYS_RATED = PERJADIN_ASPECTS.filter(
  (aspect): aspect is AlwaysRated => aspect !== "lodging",
);

const INSTRUCTION = `Beri nilai ${RATING_MIN}–${RATING_MAX} untuk tiap aspek. Nilai ${CONCERN_AT_OR_BELOW} ke bawah wajib disertai penjelasan pada Komentar aspek tersebut.`;

/** The message an Aspect's Komentar carries when its own low Rating owes prose. */
const PROSE_REQUIRED = `Nilai ${CONCERN_AT_OR_BELOW} ke bawah wajib disertai penjelasan pada Komentar aspek ini.`;

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
  // One optional Komentar per Aspect, so a comment belongs to the Rating it explains (#163) — the
  // shared Kendala/Saran pair is gone. Kept as a record like `others`, driven off the domain list.
  const [comments, setComments] = useState<Partial<Record<PerjadinAspect, string>>>({});
  // Which Aspects are lit as owing prose — a set, not one flag, because the requirement is now
  // per-Aspect: a low `transport` highlights only Transportasi's Komentar.
  const [proseNeeded, setProseNeeded] = useState<Partial<Record<PerjadinAspect, boolean>>>({});
  const [stale, setStale] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const namePrefix = useId();
  const noLodgingId = useId();

  const othersRated = ALWAYS_RATED.every((aspect) => others[aspect] !== undefined);
  const lodgingSettled = noLodging || lodging !== undefined;
  const canSubmit = othersRated && lodgingSettled;

  /** Clear one Aspect's prose warning — its Komentar was typed, or its Rating was raised. */
  function clearProse(aspect: PerjadinAspect) {
    setProseNeeded((previous) => ({ ...previous, [aspect]: false }));
  }

  /**
   * Which low Aspects still owe their own Komentar. Per-Aspect: prose on a different Aspect does
   * not satisfy a low one (#163). A null `lodging` is not low — it drops out exactly as Postgres
   * `least()` leaves a NULL out of the minimum — so it never appears here.
   */
  function proseGaps(ratings: PerjadinEvaluationRatings): Partial<Record<PerjadinAspect, boolean>> {
    const byAspect: Record<PerjadinAspect, number | null> = {
      lodging: ratings.lodging,
      transport: ratings.transport,
      meals: ratings.meals,
      punctuality: ratings.punctuality,
    };
    const gaps: Partial<Record<PerjadinAspect, boolean>> = {};
    for (const aspect of PERJADIN_ASPECTS) {
      const rating = byAspect[aspect];
      if (
        rating !== null &&
        rating <= CONCERN_AT_OR_BELOW &&
        (comments[aspect]?.trim() ?? "") === ""
      ) {
        gaps[aspect] = true;
      }
    }
    return gaps;
  }

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

    // Checked here so each message lands on its own Aspect's Komentar, and again in the write
    // function so it is a rule rather than a convenience.
    const gaps = proseGaps(ratings);
    if (Object.keys(gaps).length > 0) {
      setProseNeeded(gaps);
      return;
    }

    startSaving(async () => {
      const result = await filePerjadinEvaluationAction({
        perjadinId,
        ratings,
        comments: {
          lodging: blankToNull(comments.lodging ?? ""),
          transport: blankToNull(comments.transport ?? ""),
          meals: blankToNull(comments.meals ?? ""),
          punctuality: blankToNull(comments.punctuality ?? ""),
        },
      });
      if (result.outcome === "filed") {
        setOpen(false);
        return;
      }
      if (result.outcome === "prose-required") setProseNeeded(proseGaps(ratings));
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
                clearProse("lodging");
              }}
            />
            <Label className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
              <Checkbox
                id={noLodgingId}
                checked={noLodging}
                onCheckedChange={(checked) => {
                  setNoLodging(checked === true);
                  if (checked === true) {
                    setLodging(undefined);
                    // A skipped hotel has no Komentar and owes none — clear both so a stale one
                    // cannot travel or light up. Skipping only lowers obligations, never raises.
                    setComments((previous) => ({ ...previous, lodging: "" }));
                  }
                  clearProse("lodging");
                }}
              />
              Tidak menginap (perjalanan pulang-hari)
            </Label>
            {/* Lodging's Komentar is hidden on a day trip: there is no hotel to comment on. */}
            {!noLodging && (
              <ProseField
                label={`Komentar ${PERJADIN_ASPECT_LABELS.lodging}`}
                value={comments.lodging ?? ""}
                invalid={proseNeeded.lodging}
                message={proseNeeded.lodging ? PROSE_REQUIRED : undefined}
                onChange={(value) => {
                  setComments((previous) => ({ ...previous, lodging: value }));
                  clearProse("lodging");
                }}
              />
            )}
          </div>

          {ALWAYS_RATED.map((aspect) => (
            <div
              key={aspect}
              className="grid gap-2"
            >
              <RatingField
                namePrefix={namePrefix}
                aspect={aspect}
                label={PERJADIN_ASPECT_LABELS[aspect]}
                value={others[aspect]}
                onValueChange={(value) => {
                  setOthers((previous) => ({ ...previous, [aspect]: value }));
                  clearProse(aspect);
                }}
              />
              <ProseField
                label={`Komentar ${PERJADIN_ASPECT_LABELS[aspect]}`}
                value={comments[aspect] ?? ""}
                invalid={proseNeeded[aspect]}
                message={proseNeeded[aspect] ? PROSE_REQUIRED : undefined}
                onChange={(value) => {
                  setComments((previous) => ({ ...previous, [aspect]: value }));
                  clearProse(aspect);
                }}
              />
            </div>
          ))}
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

/** One free-text field. An Aspect's Komentar carries the elaboration message when its own Rating is low. */
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
