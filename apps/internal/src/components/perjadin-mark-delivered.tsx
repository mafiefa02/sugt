"use client";

import { markSessionDeliveredFromDashboardAction } from "-/app/(app)/actions";
import type { MyPerjadinSchool, MyPerjadinSession } from "@sugt/db/queries";
import { formatSessionStartTimeWithWib } from "@sugt/domain";
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
import { type ReactElement, useState, useTransition } from "react";

/**
 * **Tandai, one offline Session from the dashboard card** ([#209](https://github.com/mafiefa02/sugt/issues/209),
 * per Session since [#349](https://github.com/sugt-itb/sugt-itb-26/issues/349)). Each `arranged`
 * Session on a trip's timeline opens this from its own Tandai pill, so a trip's Sessions are marked
 * without walking into each `/sesi/[id]`.
 *
 * **`delivered` is terminal** (`docs/data-model.md`; there is deliberately no un-deliver), so a
 * misclick here would be permanent. The dialog therefore **names the exact Session** before it
 * writes, mirroring `OfflineMarkDelivered` on `/sesi/[id]` — the confirmation is the whole
 * safeguard. The only refusal it can meet is a Session someone else already moved (`not-arranged`),
 * surfaced as a stale message rather than thrown, exactly as `OfflineMarkDelivered` does. It closes
 * itself once the write lands.
 *
 * The `trigger` is required (the #198 pattern): the timeline row's pill is the whole reason this
 * dialog exists, so there is no default surface for it.
 */
function SessionMarkDeliveredDialog({
  school,
  session,
  trigger,
}: {
  school: MyPerjadinSchool;
  session: MyPerjadinSession;
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [stale, setStale] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const label = sessionLabel(school, session);

  function submit() {
    startSaving(async () => {
      const result = await markSessionDeliveredFromDashboardAction(session.sessionId);
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
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tandai Sesi terlaksana</DialogTitle>
          <DialogDescription>
            Tandai Sesi ini sebagai terlaksana:{" "}
            <span className="font-medium text-foreground">{label}</span>. Tindakan ini tidak bisa
            dibatalkan.
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

/** The Session's one-line name the confirmation repeats: `School · date · time+tz`. */
function sessionLabel(school: MyPerjadinSchool, session: MyPerjadinSession): string {
  return `${school.name} · ${session.heldOn} · ${formatSessionStartTimeWithWib(session.startsAt, school.timeZone)}`;
}

/**
 * A refusal the screen could not have predicted: somebody else delivered or cancelled this Session
 * while the dialog was open. A user state, not a bug — so it reads as a sentence, the same way
 * `session-writes.tsx` shows it.
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
} as const;

export { SessionMarkDeliveredDialog };
