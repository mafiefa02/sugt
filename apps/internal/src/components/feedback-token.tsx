"use client";

import { issueFeedbackTokenAction } from "-/app/(app)/sesi/[id]/actions";
import type { SessionDetail } from "@sugt/db/queries";
import type { SessionStatus } from "@sugt/domain";
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
import { type ReactElement, useState, useTransition } from "react";

/**
 * Two ways in, one behaviour. The Session detail page hands the whole `SessionDetail` it already
 * loaded; a card elsewhere (e.g. a `/pendamping` trip card) has only an id and a status and passes
 * those bare, plus its own labelled `trigger`. The prop is a union so neither caller carries what
 * it does not have, and both are normalized to `sessionId`/`status` at the top so the body reads
 * the same. With no `trigger`, the default button renders and the existing `session={session}`
 * mount behaves exactly as before.
 */
type FeedbackTokenDialogProps = (
  | { session: SessionDetail }
  | { sessionId: string; status: SessionStatus }
) & {
  trigger?: ReactElement;
};

/**
 * **The Participant Feedback QR.** Anyone signed in presses this at the end of a Session and
 * holds up the code; students in the room scan it and rate the Session without signing in.
 *
 * **Offered to everyone, not only Staff** — so it lives here rather than in the Staff-only
 * `SessionWrites`. It is **barred on a cancelled Session**: nobody sat in a room that never
 * happened, and `issueFeedbackToken` refuses one anyway.
 *
 * **"Tampilkan QR" shows the Session's one link, and never replaces it** (ADR-0049). Staff print
 * the QR the day before they leave and shorten the link by hand, so whoever presses it — a
 * colleague, another device, the same person after a reload — gets the same QR back from
 * `issueFeedbackToken`, which mints one only when the Session has none. There is no way to replace
 * or kill a link from here.
 */
function FeedbackTokenDialog(props: FeedbackTokenDialogProps) {
  const sessionId = "session" in props ? props.session.id : props.sessionId;
  const status = "session" in props ? props.session.status : props.status;
  const trigger = props.trigger;

  const [open, setOpen] = useState(false);
  const [issued, setIssued] = useState<{ url: string; qr: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  // Barred on a cancelled Session, and absent rather than disabled — there is nothing to explain
  // in a dialog nobody should open.
  if (status === "cancelled") return null;

  function issue() {
    startSaving(async () => {
      const result = await issueFeedbackTokenAction(sessionId);
      if (result.outcome === "issued") {
        setIssued({ url: result.url, qr: result.qr });
        setCopied(false);
      } else {
        setError("Sesi ini sudah dibatalkan. Muat ulang halaman untuk melihat keadaannya.");
      }
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
        if (!next) {
          setCopied(false);
          setError(null);
        }
      }}
    >
      <DialogTrigger render={trigger ?? <Button variant="outline">QR umpan balik</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>QR umpan balik</DialogTitle>
          <DialogDescription>
            {issued === null
              ? "Peserta memindai QR ini untuk menilai sesi tanpa perlu masuk."
              : "Tunjukkan QR ini kepada peserta untuk mereka pindai."}
          </DialogDescription>
        </DialogHeader>

        {error !== null && <p className="text-sm text-destructive">{error}</p>}

        {issued !== null && (
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
                className="aspect-square w-full max-w-64"
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
          </div>
        )}

        {/*
          Only before the QR is shown. Once it is, there is nothing left to do here but close: the
          link is the one link, and no button replaces it.
        */}
        {issued === null && (
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
        )}
      </DialogContent>
    </Dialog>
  );
}

export { FeedbackTokenDialog };
