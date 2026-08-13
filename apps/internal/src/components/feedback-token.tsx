"use client";

import { issueFeedbackTokenAction } from "-/app/(app)/sesi/[id]/actions";
import type { SessionDetail } from "@sugt/db/queries";
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
import { useState, useTransition } from "react";

/**
 * **The Participant Feedback QR.** Anyone signed in presses this at the end of a Session and
 * holds up the code; students in the room scan it and rate three Aspects without signing in.
 *
 * **Offered to everyone, not only Staff** — so it lives here rather than in the Staff-only
 * `SessionWrites`. It is **barred on a cancelled Session**: nobody sat in a room that never
 * happened, and `issueFeedbackToken` refuses one anyway.
 *
 * **Issuing confirms first, and reissuing is a distinct act.** The table is keyed on
 * `session_id`, so a new token invalidates every link already handed out. Once a QR is shown it
 * **stays shown** across closing and reopening the dialog — re-viewing it must not silently
 * replace it while half the room is still scanning. Replacing it is *Tampilkan QR baru*, which
 * routes back through the confirm step, so a reissue is always a second, deliberate act.
 */
function FeedbackTokenDialog({ session }: { session: SessionDetail }) {
  const [open, setOpen] = useState(false);
  const [issued, setIssued] = useState<{ url: string; qr: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  // Barred on a cancelled Session, and absent rather than disabled — there is nothing to explain
  // in a dialog nobody should open.
  if (session.status === "cancelled") return null;

  function issue() {
    startSaving(async () => {
      const result = await issueFeedbackTokenAction(session.id);
      if (result.outcome === "issued") setIssued({ url: result.url, qr: result.qr });
      else setError("Sesi ini sudah dibatalkan. Muat ulang halaman untuk melihat keadaannya.");
    });
  }

  async function copy() {
    if (!issued) return;
    await navigator.clipboard.writeText(issued.url);
    setCopied(true);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // The QR persists across close — reopening re-views it rather than reissuing. Only the
        // transient copy/error hints are cleared.
        if (!next) {
          setCopied(false);
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline">QR umpan balik</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>QR umpan balik</DialogTitle>
          <DialogDescription>
            Peserta memindai QR ini untuk menilai sesi tanpa perlu masuk. Menampilkan QR baru akan
            menonaktifkan tautan yang sudah dibagikan sebelumnya.
          </DialogDescription>
        </DialogHeader>

        {error !== null && <p className="text-sm text-destructive">{error}</p>}

        {issued === null ? (
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
              onClick={issue}
            >
              {saving ? "Menyiapkan…" : "Tampilkan QR"}
            </Button>
          </DialogFooter>
        ) : (
          <div className="grid gap-4">
            {/*
              Black on white regardless of the theme. The colours are baked into the image by the
              action, and this container is `bg-white` with no `dark:` variant, so its quiet zone
              stays white even inside a dialog that flips under `.dark`. The QR arrives as a data
              URL, so it is a plain `<img>` — there is no file for `next/image` to optimise.
            */}
            <div className="flex justify-center rounded-lg bg-white p-4">
              <img
                src={issued.qr}
                alt="QR umpan balik"
                width={256}
                height={256}
                className="size-64"
              />
            </div>

            <div className="grid gap-1.5">
              <p className="text-xs break-all text-muted-foreground">{issued.url}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={copy}
              >
                {copied ? "Tersalin" : "Salin tautan"}
              </Button>
            </div>

            <DialogFooter>
              {/*
                Reissue is a second act, back through the confirm step: it clears the shown QR,
                which returns to the "Tampilkan QR" button whose warning is the confirmation.
              */}
              <Button
                variant="ghost"
                onClick={() => {
                  setIssued(null);
                  setCopied(false);
                }}
              >
                Tampilkan QR baru
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { FeedbackTokenDialog };
