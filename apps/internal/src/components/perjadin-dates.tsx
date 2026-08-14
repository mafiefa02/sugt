"use client";

import { movePerjadinDatesAction } from "-/app/(app)/perjadin/[id]/actions";
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
import { Input } from "@sugt/ui/components/input";
import { Label } from "@sugt/ui/components/label";
import { useId, useState, useTransition } from "react";

/**
 * A Perjadin's dates, and the one way Staff correct them.
 *
 * **Moving the trip moves its arranged Sessions.** `movePerjadinDates` offset-shifts each
 * arranged Session's `held_on` by the days `starts_on` moved, so a Session on day two of the trip
 * stays on day two; delivered and cancelled Sessions record something that already happened and do
 * not move; and a shrink that would leave an arranged Session outside the new window is refused
 * whole rather than stranding it. The Session's start time is untouched — only its date moves.
 *
 * The dates are shown for everyone; the edit is offered to Staff only, and `movePerjadinDates`
 * re-checks the role, since a Server Action is a public endpoint. A professor's page simply never
 * renders the trigger.
 */
function PerjadinDates({
  perjadinId,
  startsOn,
  endsOn,
  canEdit,
}: {
  perjadinId: string;
  startsOn: string;
  endsOn: string;
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p className="text-sm text-muted-foreground tabular-nums">
        {startsOn} – {endsOn}
      </p>
      {canEdit && (
        <MoveDates
          perjadinId={perjadinId}
          startsOn={startsOn}
          endsOn={endsOn}
        />
      )}
    </div>
  );
}

/**
 * The date-edit dialog: two date inputs, opening on the trip's current window.
 *
 * **An inverted window is caught here, visibly.** `movePerjadinDates` throws on `startsOn` after
 * `endsOn` — the database's `perjadin_dates_check` would refuse it too — so this refuses it before
 * the call rather than letting an honest typo become a 500. Empty inputs disable submit, as the
 * Session date edit does.
 *
 * The tagged-union refusals it cannot rule out — a shrink that would strand a Session, or a trip
 * deleted while the page was open — come back as values and read as sentences.
 */
function MoveDates({
  perjadinId,
  startsOn,
  endsOn,
}: {
  perjadinId: string;
  startsOn: string;
  endsOn: string;
}) {
  const [open, setOpen] = useState(false);
  const [starts, setStarts] = useState(startsOn);
  const [ends, setEnds] = useState(endsOn);
  const [inverted, setInverted] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const startsId = useId();
  const endsId = useId();

  function submit() {
    // Checked here so the message lands in the dialog, and enforced again by the write, which
    // throws on it — the two date inputs make an inverted window an honest typo a user can send.
    if (starts > ends) {
      setInverted(true);
      return;
    }

    startSaving(async () => {
      const result = await movePerjadinDatesAction(perjadinId, starts, ends);
      if (result.outcome === "moved") {
        setOpen(false);
        return;
      }
      if (result.outcome === "would-strand") {
        setRefusal(
          `Rentang baru mengeluarkan ${result.strandedCount} Sesi yang masih terjadwal. ` +
            "Perlebar rentangnya atau ubah tanggal Sesi tersebut lebih dulu.",
        );
      } else {
        setRefusal("Perjadin ini sudah tidak ada. Muat ulang halaman untuk melihat keadaannya.");
      }
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
            Ubah tanggal
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah tanggal Perjadin</DialogTitle>
          <DialogDescription>
            Sesi yang masih terjadwal ikut bergeser agar tetap berada dalam rentang. Sesi yang sudah
            terlaksana atau dibatalkan tidak ikut bergeser, dan jam Sesi tidak berubah.
          </DialogDescription>
        </DialogHeader>

        {refusal !== null && (
          <Alert variant="destructive">
            <AlertTitle>Tanggal belum diubah.</AlertTitle>
            <AlertDescription>{refusal}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3.5">
          <div className="grid gap-1.5">
            <Label htmlFor={startsId}>Tanggal mulai</Label>
            <Input
              id={startsId}
              type="date"
              value={starts}
              aria-invalid={inverted}
              onChange={(event) => {
                setStarts(event.target.value);
                setInverted(false);
                setRefusal(null);
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={endsId}>Tanggal selesai</Label>
            <Input
              id={endsId}
              type="date"
              value={ends}
              aria-invalid={inverted}
              onChange={(event) => {
                setEnds(event.target.value);
                setInverted(false);
                setRefusal(null);
              }}
            />
            {inverted && (
              <p className="text-sm text-destructive">
                Tanggal selesai tidak boleh sebelum tanggal mulai.
              </p>
            )}
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
            disabled={saving || starts === "" || ends === ""}
            onClick={submit}
          >
            {saving ? "Menyimpan…" : "Simpan tanggal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { PerjadinDates };
