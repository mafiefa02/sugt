"use client";

import { updatePerjadinDatesAction } from "-/app/(app)/perjadin/[id]/actions";
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
 * A Perjadin's date range, and the one way Staff correct it (ADR-0041).
 *
 * The range is two typed dates — Tanggal mulai and Tanggal selesai — since a Perjadin carries no
 * travel legs to derive it from. Staff get an **Ubah tanggal** editor beside it; anyone else (a
 * Pimpinan) reads it and nothing more. `updatePerjadinDates` re-checks the role — a Server Action is a
 * public endpoint, so a Pimpinan's page simply never renders the trigger.
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
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-muted-foreground tabular-nums">
        {startsOn} – {endsOn}
      </p>
      {canEdit && (
        <EditDates
          perjadinId={perjadinId}
          startsOn={startsOn}
          endsOn={endsOn}
        />
      )}
    </div>
  );
}

/**
 * The date-edit dialog, opening on the trip's current range each time.
 *
 * **Resize and clamp, never auto-shift** (ADR-0021, kept by ADR-0041): the write moves no Session, and
 * refuses the whole edit when a still-arranged Session would fall outside the new range. Both refusals
 * a date edit can hit — that one, and an inverted range — land under Tanggal selesai.
 */
function EditDates({
  perjadinId,
  startsOn,
  endsOn,
}: {
  perjadinId: string;
  startsOn: string;
  endsOn: string;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ startsOn, endsOn });
  const [refusal, setRefusal] = useState<string | null>(null);
  const [dateRefusal, setDateRefusal] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const fields = useId();

  const incomplete = form.startsOn === "" || form.endsOn === "";

  function set(patch: Partial<typeof form>) {
    setForm((previous) => ({ ...previous, ...patch }));
    setRefusal(null);
    setDateRefusal(null);
  }

  function submit() {
    if (incomplete) return;
    startSaving(async () => {
      const result = await updatePerjadinDatesAction(perjadinId, form);
      if (result.outcome === "updated") {
        setOpen(false);
        return;
      }
      if (result.outcome === "ends-before-starts") {
        setDateRefusal("Tanggal selesai tidak boleh lebih awal dari Tanggal mulai.");
        return;
      }
      if (result.outcome === "would-strand") {
        setDateRefusal(
          `Rentang baru mengeluarkan ${result.strandedCount} Sesi yang masih terjadwal. ` +
            "Perlebar rentangnya atau ubah tanggal Sesi tersebut lebih dulu.",
        );
        return;
      }
      setRefusal("Perjadin ini sudah tidak ada. Muat ulang halaman untuk melihat keadaannya.");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Reopening starts from the trip as it is now, not from an abandoned edit.
        if (next) {
          setForm({ startsOn, endsOn });
          setRefusal(null);
          setDateRefusal(null);
        }
        setOpen(next);
      }}
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
          <DialogTitle>Ubah tanggal</DialogTitle>
          <DialogDescription>
            Mengubah tanggal menggeser rentang Perjadin, tetapi tidak memindahkan Sesi — perubahan
            ditolak jika ada Sesi terjadwal yang jatuh di luar rentang baru.
          </DialogDescription>
        </DialogHeader>

        {refusal !== null && (
          <Alert variant="destructive">
            <AlertTitle>Tanggal belum diubah.</AlertTitle>
            <AlertDescription>{refusal}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`${fields}-starts-on`}>Tanggal mulai</Label>
            <Input
              id={`${fields}-starts-on`}
              type="date"
              value={form.startsOn}
              onChange={(event) => {
                set({ startsOn: event.target.value });
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${fields}-ends-on`}>Tanggal selesai</Label>
            <Input
              id={`${fields}-ends-on`}
              type="date"
              min={form.startsOn || undefined}
              value={form.endsOn}
              aria-invalid={dateRefusal !== null}
              onChange={(event) => {
                set({ endsOn: event.target.value });
              }}
            />
            {dateRefusal !== null && <p className="text-sm text-destructive">{dateRefusal}</p>}
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
            disabled={saving || incomplete}
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
