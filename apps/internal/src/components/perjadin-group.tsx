"use client";

import { replacePerjadinGroupAction } from "-/app/(app)/perjadin/[id]/actions";
import { PersonSelect } from "-/components/person-select";
import type { GroupMemberEntry, PlannedTeacher } from "@sugt/db/queries";
import { STREAMS, type Stream } from "@sugt/domain";
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
import { useId, useState, useTransition } from "react";

/**
 * The Group, and the one way it changes.
 *
 * **A substitution submits the whole Group**, never one member — which is not a UI choice
 * but the shape the rule needs. "At least one Teaching Team member per Stream" is a count
 * across sibling rows that no CHECK can see, so it is checked against the complete payload;
 * a form that removed one person and left would have no payload to check.
 *
 * The Perjadin keeps its id through the replacement, so its Sessions, its Advance and its
 * transactions are untouched. **The PIC is not offered here**: they are on their own Group
 * by a deferred foreign key, and a field with one legal value is not a choice.
 */
function PerjadinGroup({
  perjadinId,
  group,
  picPersonId,
  teachingTeam,
  staff,
  canSubstitute,
}: {
  perjadinId: string;
  group: GroupMemberEntry[];
  /** Which member is the PIC, so the extra-Staff slots exclude them. */
  picPersonId: string;
  teachingTeam: { id: string; fullName: string }[];
  staff: { id: string; fullName: string }[];
  canSubstitute: boolean;
}) {
  return (
    <div className="border-b border-border px-7 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-sm font-medium">Group</h2>
        {canSubstitute && (
          <Substitute
            perjadinId={perjadinId}
            group={group}
            picPersonId={picPersonId}
            teachingTeam={teachingTeam}
            staff={staff}
          />
        )}
      </div>

      <ul className="mt-2.5 space-y-1 text-sm">
        {group.map((member) => (
          <li
            key={member.personId}
            className="text-muted-foreground"
          >
            <span className="text-foreground">{member.fullName}</span>
            {/*
              Staff carry no Stream and Teaching Team always carry one, by
              `group_member_stream_iff_teaching`. A professor is labelled by their Stream; among
              the stream-less Staff, the PIC is named as such and the rest are extra Staff.
            */}
            {member.stream !== null
              ? ` · ${member.stream}`
              : member.personId === picPersonId
                ? " · PIC"
                : " · Staf"}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The substitution dialog: one picker per Stream, opening on whoever holds it now.
 *
 * A Group may legitimately carry more than one professor on a Stream — the write accepts
 * it — but this offers one each, because substitution is the case it exists for and a
 * roster of unbounded rows would make the common act the awkward one.
 */
function Substitute({
  perjadinId,
  group,
  picPersonId,
  teachingTeam,
  staff,
}: {
  perjadinId: string;
  group: GroupMemberEntry[];
  picPersonId: string;
  teachingTeam: { id: string; fullName: string }[];
  staff: { id: string; fullName: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Record<Stream, string>>(
    () =>
      Object.fromEntries(
        STREAMS.map((stream) => [
          stream,
          group.find((member) => member.stream === stream)?.personId ?? "",
        ]),
      ) as Record<Stream, string>,
  );
  // Three extra-Staff slots, seeded from the Group's current stream-less Staff other than the
  // PIC, so a substitution keeps them rather than dropping them. A set of up to three, padded to
  // three fixed slots.
  const [extraStaff, setExtraStaff] = useState<[string, string, string]>(() => {
    const current = group
      .filter((member) => member.role === "Staff" && member.personId !== picPersonId)
      .map((member) => member.personId);
    return [current[0] ?? "", current[1] ?? "", current[2] ?? ""];
  });
  const [refusal, setRefusal] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  // One prefix for the per-Stream ids: `useId` cannot be called inside a `map`.
  const fields = useId();

  /**
   * Professors this dialog **cannot represent** — not the ones being replaced.
   *
   * The write accepts more than one professor per Stream, and Rencanakan Perjadin does not
   * produce one, so this is a shape only raw SQL reaches today. It is said out loud rather
   * than dropped quietly: submitting replaces the whole Group, so anybody the two pickers
   * cannot hold would leave the trip without the dialog ever having mentioned them.
   *
   * Computed against the Group **as it was when the dialog opened**, never against live
   * `chosen`. Reading `chosen` would make this fire on every ordinary substitution — the
   * professor just swapped out also fails that comparison — and announce a deliberate act as
   * if it were an accident.
   */
  const [unrepresented] = useState(() => {
    const held = new Set(
      STREAMS.map((stream) => group.find((member) => member.stream === stream)?.personId).filter(
        (personId) => personId !== undefined,
      ),
    );
    return group.filter((member) => member.stream !== null && !held.has(member.personId));
  });

  function submit() {
    startSaving(async () => {
      const teachers: PlannedTeacher[] = STREAMS.filter((stream) => chosen[stream] !== "").map(
        (stream) => ({ stream, personId: chosen[stream] }),
      );

      const result = await replacePerjadinGroupAction(
        perjadinId,
        teachers,
        extraStaff.filter((personId) => personId !== ""),
      );
      if (result.outcome === "replaced") {
        setOpen(false);
        return;
      }
      setRefusal(REFUSALS[result.outcome]);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
          >
            Ganti anggota
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ganti anggota Group</DialogTitle>
          <DialogDescription>
            Group diganti seluruhnya. Sesi, uang muka dan transaksi Perjadin ini tidak ikut berubah,
            dan PIC tetap menjadi anggota.
          </DialogDescription>
        </DialogHeader>

        {refusal !== null && (
          <Alert variant="destructive">
            <AlertTitle>Group belum diganti.</AlertTitle>
            <AlertDescription>{refusal}</AlertDescription>
          </Alert>
        )}

        {unrepresented.length > 0 && (
          <Alert>
            <AlertTitle>Group ini punya pengajar lain.</AlertTitle>
            <AlertDescription>
              <p>
                Mengganti Group akan mengeluarkan{" "}
                {unrepresented.map((member) => member.fullName).join(", ")}.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3.5">
          {STREAMS.map((stream) => (
            <div
              key={stream}
              className="grid gap-1.5"
            >
              <Label htmlFor={`${fields}-${stream}`}>{stream}</Label>
              {/* Minus whoever holds the other Stream, for the reason the planning form gives. */}
              <PersonSelect
                id={`${fields}-${stream}`}
                people={teachingTeam.filter(
                  (entry) =>
                    entry.id === chosen[stream] ||
                    !STREAMS.some((other) => other !== stream && chosen[other] === entry.id),
                )}
                value={chosen[stream]}
                placeholder="Pilih pengajar"
                onSelect={(personId) => {
                  setChosen((previous) => ({ ...previous, [stream]: personId }));
                  setRefusal(null);
                }}
              />
            </div>
          ))}

          <div className="grid gap-1.5">
            <Label>Staf tambahan (opsional)</Label>
            <div className="grid gap-2">
              {extraStaff.map((chosen, slot) => (
                <PersonSelect
                  // Three fixed slots that are never reordered, so the position is a stable key.
                  key={`extra-staff-slot-${slot}`}
                  people={staff.filter(
                    (entry) =>
                      entry.id === chosen ||
                      (entry.id !== picPersonId &&
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
                    setRefusal(null);
                  }}
                />
              ))}
            </div>
          </div>
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
            disabled={saving}
            onClick={submit}
          >
            {saving ? "Menyimpan…" : "Ganti Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * What each refusal says. `no-such-perjadin` is the only one the dialog cannot have
 * predicted — somebody deleted the trip while this page was open — so it says to reload
 * rather than which field to fix.
 */
const REFUSALS = {
  "stream-uncovered": "Setiap Stream harus punya pengajar.",
  "duplicate-teacher": "Satu pengajar tidak bisa mengampu dua Stream sekaligus.",
  "duplicate-staff": "Setiap Staf tambahan harus berbeda, dan bukan PIC.",
  "no-such-perjadin": "Perjadin ini sudah tidak ada. Muat ulang halaman untuk melihat keadaannya.",
} as const;

export { PerjadinGroup };
