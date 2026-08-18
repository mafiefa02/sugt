"use client";

import {
  CONCERN_AT_OR_BELOW,
  PARTICIPANT_FEEDBACK_ASPECTS,
  RATING_MAX,
  RATING_MIN,
  type ClassKind,
  type ParticipantFeedbackAspect,
} from "@sugt/domain";
import { Button } from "@sugt/ui/components/button";
import { Input } from "@sugt/ui/components/input";
import { Label } from "@sugt/ui/components/label";
import { RatingInput } from "@sugt/ui/components/rating-input";
import { Textarea } from "@sugt/ui/components/textarea";
import { useId, useState, useTransition } from "react";

import { submitFeedbackAction } from "./actions";
import { GoneNotice } from "./gone-notice";

/**
 * The phone form a Participant fills after scanning the QR. Three Aspects, the Class they sat
 * in, a name they type themselves, and an optional comment. **No elaboration rule** — a
 * Participant owes nothing, so a low Rating needs no sentence.
 *
 * Client-side because it holds a rubric's worth of state and swaps itself for a thank-you on
 * submit. The token is the only credential it carries; the submit re-resolves it server-side.
 *
 * The Rating cells are `size="sm"` — 23px — because this is filled on a phone in a classroom,
 * which is the one surface `RatingInput`'s small size exists for.
 */

/** GTK and MS are Indonesian initialisms already; only *Student* translates, to *Siswa*. */
const CLASS_LABELS: Record<ClassKind, string> = { GTK: "GTK", MS: "MS", Student: "Siswa" };

const CLASS_KINDS_ORDERED = Object.keys(CLASS_LABELS) as ClassKind[];

/** The Aspect names in Indonesian — form copy around the English domain terms (`CONTEXT.md`). */
const ASPECT_LABELS: Record<ParticipantFeedbackAspect, string> = {
  materials: "Materi",
  instructor: "Pengajar",
  relevance: "Relevansi",
};

function FeedbackForm({ token }: { token: string }) {
  const [classKind, setClassKind] = useState<ClassKind | undefined>(undefined);
  const [name, setName] = useState("");
  const [ratings, setRatings] = useState<Partial<Record<ParticipantFeedbackAspect, number>>>({});
  const [comments, setComments] = useState<Partial<Record<ParticipantFeedbackAspect, string>>>({});
  const [nameError, setNameError] = useState(false);
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);
  const [saving, startSaving] = useTransition();
  const namePrefix = useId();
  const nameId = useId();

  const rated = PARTICIPANT_FEEDBACK_ASPECTS.every((aspect) => ratings[aspect] !== undefined);
  const canSubmit = classKind !== undefined && name.trim() !== "" && rated;

  function submit() {
    if (name.trim() === "") {
      setNameError(true);
      return;
    }
    if (classKind === undefined || !rated) return;

    startSaving(async () => {
      const result = await submitFeedbackAction(token, {
        classKind,
        name: name.trim(),
        ratings: {
          materials: ratings.materials!,
          instructor: ratings.instructor!,
          relevance: ratings.relevance!,
        },
        comments: {
          materials: comments.materials?.trim() || null,
          instructor: comments.instructor?.trim() || null,
          relevance: comments.relevance?.trim() || null,
        },
      });
      if (result.outcome === "submitted") setDone(true);
      else if (result.outcome === "name-required") setNameError(true);
      else setGone(true);
    });
  }

  // The link died while the form was open — a reissue, or the 24 hours ran out. The same notice
  // a fresh dead load shows, and no form: there is nothing a second try here would reach.
  if (gone) return <GoneNotice />;

  // A thank-you and no form. A second submission is not prevented, so the page must not invite
  // one — there is no button back to the form.
  if (done) {
    return (
      <div className="text-center">
        <h1 className="font-heading text-lg font-medium">Terima kasih!</h1>
        <p className="mt-2 text-sm text-muted-foreground">Masukanmu sudah tercatat.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-heading text-lg font-medium">Umpan balik sesi</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Beri nilai {RATING_MIN}–{RATING_MAX} untuk tiap aspek. Masukanmu membantu kami memperbaiki
        sesi berikutnya.
      </p>

      <div className="mt-5 grid gap-5">
        <div className="grid gap-1.5">
          <Label>Kelas yang kamu ikuti</Label>
          <div className="flex gap-2">
            {CLASS_KINDS_ORDERED.map((kind) => (
              <Button
                key={kind}
                type="button"
                variant={classKind === kind ? "default" : "outline"}
                onClick={() => {
                  setClassKind(kind);
                }}
              >
                {CLASS_LABELS[kind]}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={nameId}>Nama</Label>
          <Input
            id={nameId}
            value={name}
            aria-invalid={nameError}
            onChange={(event) => {
              setName(event.target.value);
              setNameError(false);
            }}
          />
          {nameError && <p className="text-sm text-destructive">Nama wajib diisi.</p>}
        </div>

        {PARTICIPANT_FEEDBACK_ASPECTS.map((aspect) => {
          const labelId = `${namePrefix}-${aspect}-label`;
          const commentId = `${namePrefix}-${aspect}-comment`;
          return (
            <div
              key={aspect}
              className="grid gap-2"
            >
              <div className="flex items-center justify-between gap-3">
                <Label id={labelId}>{ASPECT_LABELS[aspect]}</Label>
                <RatingInput
                  name={`${namePrefix}-${aspect}`}
                  aria-labelledby={labelId}
                  size="sm"
                  min={RATING_MIN}
                  max={RATING_MAX}
                  concernAtOrBelow={CONCERN_AT_OR_BELOW}
                  value={ratings[aspect]}
                  onValueChange={(value) => {
                    setRatings((previous) => ({ ...previous, [aspect]: value }));
                  }}
                />
              </div>
              {/* One optional comment per Aspect, so it belongs to the Rating it explains (#102). */}
              <Label
                htmlFor={commentId}
                className="text-xs text-muted-foreground"
              >
                Komentar {ASPECT_LABELS[aspect]} (opsional)
              </Label>
              <Textarea
                id={commentId}
                value={comments[aspect] ?? ""}
                onChange={(event) => {
                  setComments((previous) => ({ ...previous, [aspect]: event.target.value }));
                }}
              />
            </div>
          );
        })}

        <Button
          disabled={saving || !canSubmit}
          onClick={submit}
        >
          {saving ? "Mengirim…" : "Kirim"}
        </Button>
      </div>
    </div>
  );
}

export { FeedbackForm };
