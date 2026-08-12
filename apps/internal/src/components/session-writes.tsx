"use client";

import {
  cancelSessionAction,
  correctSessionTeachersAction,
  markSessionDeliveredAction,
  moveSessionDateAction,
} from "-/app/(app)/sesi/[id]/actions";
import type {
  CorrectTeachersResult,
  MarkDeliveredResult,
  SessionDetail,
  TaughtBy,
} from "@sugt/db/queries";
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
import { Input } from "@sugt/ui/components/input";
import { Label } from "@sugt/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sugt/ui/components/select";
import { Textarea } from "@sugt/ui/components/textarea";
import { useId, useState, useTransition } from "react";

/**
 * Everything Staff can do to a Session, and nothing else can.
 *
 * **What is offered turns on the status, and that is the enforcement's shape rather than
 * its substance.** Tandai terlaksana, Batalkan Sesi and the date edit are offered only
 * while `arranged`; after delivery the only thing offered is correcting who taught,
 * because `delivered` is terminal; a cancelled Session offers nothing.
 *
 * Every one of those rules is also held by the write function, which is why each dialog
 * below has a branch for a refusal it believes it cannot provoke. A screen that merely
 * declines to show a button protects nothing against a page opened before somebody else
 * acted on the same Session — and that page is what those branches are for.
 *
 * A client component because four dialogs hold form state, and none of that state is
 * worth a URL. The rosters arrive as props; nothing here fetches.
 */
function SessionWrites({ session }: { session: SessionDetail }) {
  return (
    <div className="flex flex-wrap gap-2.5 px-7 py-5">
      {session.status === "arranged" && (
        <>
          <MarkDelivered session={session} />
          <MoveDate session={session} />
          <Cancel session={session} />
        </>
      )}

      {/*
        Offered after delivery and only then. Until a mis-named professor is removed they
        owe three Class Records they cannot honestly file, and `delivered` being terminal
        means there is no un-delivering the Session to fix it.
      */}
      {session.status === "delivered" && <CorrectTeachers session={session} />}

      {session.status === "cancelled" && (
        <p className="text-sm text-muted-foreground">
          Sesi yang dibatalkan tidak bisa diubah lagi.
        </p>
      )}
    </div>
  );
}

/**
 * **Tandai terlaksana** — the status and who taught, in one dialog and one call.
 *
 * The pickers open on `suggestedTeachers`, which is the Group's Stream assignments on an
 * offline Session and nobody on an online one. It is a **suggestion**: Staff confirm or
 * change it, and what they submit is what is written.
 */
function MarkDelivered({ session }: { session: SessionDetail }) {
  return (
    <TeachersDialog
      session={session}
      trigger={<Button>Tandai terlaksana</Button>}
      title="Tandai Sesi terlaksana"
      description="Sebutkan pengajar tiap Stream. Daftar inilah yang menentukan siapa yang diharapkan mengisi Catatan Kelas."
      confirm="Tandai terlaksana"
      save={(teachers) => markSessionDeliveredAction(session.id, teachers)}
    />
  );
}

/**
 * Correcting who taught, after delivery.
 *
 * The both-Streams rule still applies. Without it, removing a professor would be the way
 * out of the rule Tandai terlaksana had just enforced.
 */
function CorrectTeachers({ session }: { session: SessionDetail }) {
  return (
    <TeachersDialog
      session={session}
      trigger={<Button variant="outline">Perbaiki pengajar</Button>}
      title="Perbaiki pengajar"
      description="Catatan Kelas yang sudah diisi tidak ikut terhapus — daftar ini hanya menentukan siapa yang diharapkan mengisi."
      confirm="Simpan"
      save={(teachers) => correctSessionTeachersAction(session.id, teachers)}
    />
  );
}

/**
 * The one dialog behind both of the writes that name who taught.
 *
 * They differ in four strings and which action they call, and in nothing else: the same
 * two pickers, the same both-Streams check before submit, the same three ways a save can
 * come back. **They are one component because the check is the part worth having once** —
 * two copies of "refuse to submit with a Stream unnamed" is two places for the rule to
 * drift, and the rule is the reason marking delivered and naming who taught are one act.
 *
 * `save` is a function rather than an action name so the two results can differ. Both
 * unions carry `stream-unnamed`; everything else is read through `outcome` and `status`,
 * which both share.
 */
function TeachersDialog({
  session,
  trigger,
  title,
  description,
  confirm,
  save,
}: {
  session: SessionDetail;
  trigger: React.ReactElement;
  title: string;
  description: string;
  confirm: string;
  save: (teachers: TaughtBy[]) => Promise<MarkDeliveredResult | CorrectTeachersResult>;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Record<Stream, string>>(() => prefill(session));
  const [missing, setMissing] = useState<Stream[]>([]);
  const [stale, setStale] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function submit() {
    // Checked here so the message lands on the field, and checked again in the write
    // function so it is a rule rather than a convenience.
    const unnamed = STREAMS.filter((stream) => chosen[stream] === "");
    if (unnamed.length > 0) {
      setMissing(unnamed);
      return;
    }

    startSaving(async () => {
      const result = await save(taughtBy(chosen));
      if (result.outcome === "delivered" || result.outcome === "corrected") {
        setOpen(false);
        return;
      }
      if (result.outcome === "stream-unnamed") setMissing(result.missing);
      else setStale(STALE_MESSAGES[result.status]);
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {stale !== null && <StaleAlert message={stale} />}

        <div className="grid gap-3.5">
          {STREAMS.map((stream) => (
            <TeacherField
              key={stream}
              stream={stream}
              session={session}
              value={chosen[stream]}
              invalid={missing.includes(stream)}
              onSelect={(personId) => {
                setChosen((previous) => ({ ...previous, [stream]: personId }));
                setMissing((previous) => previous.filter((entry) => entry !== stream));
              }}
            />
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
            disabled={saving}
            onClick={submit}
          >
            {saving ? "Menyimpan…" : confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * **Batalkan Sesi** — the reason is in the same dialog because it is in the same write.
 *
 * `session_cancelled_iff_reason` refuses the pair apart, so asking for the reason
 * afterwards would be asking for something that cannot be stored afterwards.
 */
function Cancel({ session }: { session: SessionDetail }) {
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
      const result = await cancelSessionAction(session.id, reason);
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
            Sesi yang dibatalkan tetap terlihat di daftar Sekolah dan tidak dihitung sebagai
            terlaksana. Kalau tanggalnya hanya bergeser, ubah tanggalnya saja.
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
 * Moving the date. **A slipped date is not a cancellation**, so this asks for no reason
 * and leaves no dead row on the School's list.
 *
 * Two things can refuse it, and they are different sentences: another online Session for
 * this School already stands on that day, or an offline Session was moved outside the
 * trip it happens on.
 */
function MoveDate({ session }: { session: SessionDetail }) {
  const [open, setOpen] = useState(false);
  const [heldOn, setHeldOn] = useState(session.heldOn);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const dateId = useId();

  function submit() {
    startSaving(async () => {
      const result = await moveSessionDateAction(session.id, heldOn);
      if (result.outcome === "moved") {
        setOpen(false);
        return;
      }
      if (result.outcome === "collided") {
        setRefusal("Sekolah ini sudah punya Sesi daring pada tanggal tersebut.");
      } else if (result.outcome === "outside-perjadin") {
        setRefusal(
          `Sesi luring harus berada dalam rentang Perjadin, ${result.startsOn} – ${result.endsOn}.`,
        );
      } else {
        setRefusal(STALE_MESSAGES[result.status]);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger render={<Button variant="outline">Ubah tanggal</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah tanggal Sesi</DialogTitle>
          <DialogDescription>
            {session.perjadin === null
              ? "Tanggal baru tidak boleh bentrok dengan Sesi daring lain di Sekolah ini."
              : `Tanggal baru harus berada dalam rentang Perjadin, ${session.perjadin.startsOn} – ${session.perjadin.endsOn}.`}
          </DialogDescription>
        </DialogHeader>

        {refusal !== null && <StaleAlert message={refusal} />}

        <div className="grid gap-1.5">
          <Label htmlFor={dateId}>Tanggal</Label>
          <Input
            id={dateId}
            type="date"
            value={heldOn}
            onChange={(event) => {
              setHeldOn(event.target.value);
              setRefusal(null);
            }}
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
            disabled={saving || heldOn === ""}
            onClick={submit}
          >
            {saving ? "Menyimpan…" : "Simpan tanggal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One Stream's picker, with the roster the payload carries. */
function TeacherField({
  stream,
  session,
  value,
  invalid,
  onSelect,
}: {
  stream: Stream;
  session: SessionDetail;
  value: string;
  invalid: boolean;
  onSelect: (personId: string) => void;
}) {
  const id = useId();

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{stream}</Label>
      <Select
        items={Object.fromEntries(session.teachingTeam.map((entry) => [entry.id, entry.fullName]))}
        value={value === "" ? null : value}
        onValueChange={(selected) => {
          onSelect((selected as string | null) ?? "");
        }}
      >
        <SelectTrigger
          id={id}
          aria-invalid={invalid}
        >
          <SelectValue placeholder="Pilih pengajar" />
        </SelectTrigger>
        <SelectContent>
          {session.teachingTeam.map((entry) => (
            <SelectItem
              key={entry.id}
              value={entry.id}
            >
              {entry.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {invalid && <p className="text-sm text-destructive">Pengajar {stream} wajib disebut.</p>}
    </div>
  );
}

/**
 * What a refusal that the screen could not have predicted says.
 *
 * Every one of these means somebody else changed this Session while the page was open.
 * That is a user state and not a bug, so it reads as a sentence rather than as an error
 * page — but it is worth saying plainly, because the button that produced it was one this
 * screen had offered.
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

/**
 * What the two pickers open on: whoever is already recorded, falling back to the Group's
 * Stream assignments. `""` is the unset value, and the one the both-Streams check reads.
 */
function prefill(session: SessionDetail): Record<Stream, string> {
  const named = session.teachers.length > 0 ? session.teachers : session.suggestedTeachers;

  return Object.fromEntries(
    STREAMS.map((stream) => [
      stream,
      named.find((teacher) => teacher.stream === stream)?.personId ?? "",
    ]),
  ) as Record<Stream, string>;
}

/** The pickers' state as the write function wants it: `""` is nobody and travels as nothing. */
function taughtBy(chosen: Record<Stream, string>): TaughtBy[] {
  return STREAMS.filter((stream) => chosen[stream] !== "").map((stream) => ({
    stream,
    personId: chosen[stream],
  }));
}

export { SessionWrites };
