"use client";

import {
  cancelOnlineSessionAction,
  markOnlineSessionDeliveredAction,
} from "-/app/(app)/sesi-daring/[id]/actions";
import type { OnlineSessionDetail } from "@sugt/db/queries";
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
import { Textarea } from "@sugt/ui/components/textarea";
import { useId, useState, useTransition } from "react";

/**
 * The status writes an online Session offers Staff — Tandai terlaksana and Batalkan Sesi — mirroring
 * the offline detail's controls (`session-writes.tsx`). Both are offered only while `arranged`; a
 * cancelled Session offers nothing, and a delivered one is terminal. The Session's fields and its
 * Pengajar are edited in their own sections above, so this carries only the two status acts.
 *
 * Each rule is also held by the write function, which is why each dialog has a branch for a refusal
 * it believes it cannot provoke — a page opened before somebody else acted on the same Session is
 * what those branches are for. Rendered only for Staff, whom the writes re-check.
 */
function OnlineSessionWrites({ session }: { session: OnlineSessionDetail }) {
  return (
    <div className="flex flex-wrap gap-2.5 px-7 py-5">
      {session.status === "arranged" && (
        <>
          <MarkDelivered session={session} />
          <Cancel session={session} />
        </>
      )}

      {session.status === "cancelled" && (
        <p className="text-sm text-muted-foreground">
          Sesi yang dibatalkan tidak bisa diubah lagi.
        </p>
      )}
    </div>
  );
}

/**
 * **Tandai terlaksana** — status only (#152). No who-taught prompt: the Pengajar are session-scoped
 * names edited in their own section, and no `session_teacher` row is written. The confirmation exists
 * only so a delivered Session is a deliberate act; the sole refusal it can meet is a Session someone
 * else already moved.
 */
function MarkDelivered({ session }: { session: OnlineSessionDetail }) {
  const [open, setOpen] = useState(false);
  const [stale, setStale] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function submit() {
    startSaving(async () => {
      const result = await markOnlineSessionDeliveredAction(session.id);
      if (result.outcome === "delivered") {
        setOpen(false);
        return;
      }
      if (result.outcome === "not-arranged") setStale(STALE_MESSAGES[result.status]);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger render={<Button>Tandai terlaksana</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tandai Sesi terlaksana</DialogTitle>
          <DialogDescription>
            Tandai Sesi daring ini sebagai terlaksana. Pengajarnya dicatat di bagian Pengajar, bukan
            di sini.
          </DialogDescription>
        </DialogHeader>

        {stale !== null && <StaleAlert message={stale} />}

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
            {saving ? "Menyimpan…" : "Tandai terlaksana"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * **Batalkan Sesi** — the reason is in the same dialog because it is in the same write.
 * `session_cancelled_iff_reason` refuses the pair apart, so asking for the reason afterwards would be
 * asking for something that cannot be stored afterwards. A slipped date is not a cancellation — that
 * is an edit in the Sesi section above.
 */
function Cancel({ session }: { session: OnlineSessionDetail }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [blank, setBlank] = useState(false);
  const [stale, setStale] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const reasonId = useId();

  function submit() {
    if (reason.trim() === "") {
      setBlank(true);
      return;
    }

    startSaving(async () => {
      const result = await cancelOnlineSessionAction(session.id, reason);
      if (result.outcome === "cancelled") {
        setOpen(false);
        return;
      }
      if (result.outcome === "reason-required") setBlank(true);
      else setStale(STALE_MESSAGES[result.status]);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger render={<Button variant="outline">Batalkan Sesi</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batalkan Sesi</DialogTitle>
          <DialogDescription>
            Sesi yang dibatalkan tetap terlihat di daftar dan tidak dihitung sebagai terlaksana.
            Kalau tanggalnya hanya bergeser, ubah tanggalnya saja di bagian Sesi.
          </DialogDescription>
        </DialogHeader>

        {stale !== null && <StaleAlert message={stale} />}

        <div className="grid gap-1.5">
          <Label htmlFor={reasonId}>Alasan</Label>
          <Textarea
            id={reasonId}
            value={reason}
            aria-invalid={blank}
            onChange={(event) => {
              setReason(event.target.value);
              setBlank(false);
            }}
          />
          {blank && <p className="text-sm text-destructive">Alasan wajib diisi.</p>}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false);
            }}
          >
            Kembali
          </Button>
          <Button
            variant="destructive"
            disabled={saving}
            onClick={submit}
          >
            {saving ? "Menyimpan…" : "Batalkan Sesi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * What a refusal that the screen could not have predicted says — somebody else changed this Session
 * while the page was open, which is a user state and reads as a sentence, not an error page.
 */
function StaleAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Tidak jadi disimpan.</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

const STALE_MESSAGES = {
  delivered: "Sesi ini sudah ditandai terlaksana. Muat ulang halaman untuk melihat keadaannya.",
  cancelled: "Sesi ini sudah dibatalkan. Muat ulang halaman untuk melihat keadaannya.",
  arranged: "Sesi ini sudah berubah. Muat ulang halaman untuk melihat keadaannya.",
} as const;

export { OnlineSessionWrites };
