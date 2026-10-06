"use client";

import {
  openDocumentSessionAction,
  perjadinDokumenAction,
  recordDocumentAction,
} from "-/app/(app)/perjadin/[id]/dokumen/actions";
import {
  documentFields,
  DOCUMENT_ACCEPT,
  DOCUMENT_HINT,
  DOCUMENT_UNSYNCED_NOTE,
  EMPTY_DOCUMENT_FORM,
  pickDocument,
  recordRefusalText,
  sessionRefusalText,
  type DocumentForm,
} from "-/components/perjadin-dokumen-form";
import { PerjadinDokumenList } from "-/components/perjadin-dokumen-list";
import { RequiredLegend, RequiredMark } from "-/components/required-mark";
import { putToDriveSession } from "-/lib/drive/receipt-upload";
import type { UploadGate } from "-/lib/drive/upload-gate";
import type { PerjadinDokumen } from "@sugt/db/queries";
import {
  PERJADIN_DOCUMENT_KINDS,
  PERJADIN_DOCUMENT_PARTICIPANT_TYPES,
  timeZoneSuffix,
  type PerjadinDocumentKind,
  type PerjadinDocumentParticipantType,
} from "@sugt/domain";
import { Alert, AlertDescription, AlertTitle } from "@sugt/ui/components/alert";
import { Button } from "@sugt/ui/components/button";
import {
  Dialog,
  DialogBody,
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
import { TimeField } from "@sugt/ui/components/time-field";
import { type ReactElement, useId, useRef, useState, useTransition } from "react";

/**
 * **Dokumen — one trip's attendance sheets** (ADR-0042, #397), opened from a `/pendamping` trip
 * card. The sheets uploaded so far (`PerjadinDokumenList`), each with a Buka link to its file in
 * Drive and **Hapus** (#398); and the **Unggah dokumen** form: the kind, its fields, one PDF.
 *
 * The trip's sheets and Schools are fetched when the dialog opens (`perjadinDokumenAction`), and
 * again after each upload or Hapus, rather than riding on every card's payload. The upload is Catat
 * transaksi's: a session, the browser's `PUT` straight to Drive, then the record. **Any failure
 * keeps every value and the picked file**, so Unggah again retries against a fresh session.
 */
function PerjadinDokumenDialog({
  perjadinId,
  name,
  uploadGate,
  trigger,
}: {
  perjadinId: string;
  /** The trip's name (`perjadinName`, ADR-0044), for the title. */
  name: string;
  /** Closed while Drive cannot take an upload: the trigger is disabled, titled with the reason. */
  uploadGate: UploadGate;
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [dokumen, setDokumen] = useState<PerjadinDokumen | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [form, setForm] = useState<DocumentForm>(EMPTY_DOCUMENT_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [unsynced, setUnsynced] = useState(false);
  const [saving, startSaving] = useTransition();
  const picker = useRef<HTMLInputElement>(null);
  const ids = useId();

  const fields = documentFields(form);
  const isPeserta = form.kind === "Daftar Hadir Peserta";
  const school = dokumen?.schools.find((option) => option.id === form.schoolId) ?? null;

  async function load() {
    const loaded = await perjadinDokumenAction(perjadinId).catch(() => null);
    setDokumen(loaded);
    setLoadFailed(loaded === null);
  }

  function update(patch: Partial<DocumentForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function submit() {
    if (!fields || !file) return;
    startSaving(async () => {
      setRefusal(null);
      setUnsynced(false);

      const session = await openDocumentSessionAction(perjadinId, {
        size: file.size,
        contentType: file.type,
      });
      if (session.outcome !== "ready") return setRefusal(sessionRefusalText(session));

      const driveFileId = await putToDriveSession(session.sessionUri, file);
      if (!driveFileId) return setRefusal("Berkas gagal diunggah — coba lagi.");

      const result = await recordDocumentAction({ ...fields, perjadinId, driveFileId });
      if (result.outcome !== "recorded") return setRefusal(recordRefusalText(result));

      setForm(EMPTY_DOCUMENT_FORM);
      setFile(null);
      setUnsynced(!result.synced);
      await load();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setRefusal(null);
          setUnsynced(false);
          void load();
        }
      }}
    >
      <DialogTrigger
        disabled={!uploadGate.open}
        title={uploadGate.open ? undefined : uploadGate.reason}
        render={trigger}
      />
      <DialogContent size="panel">
        <DialogHeader>
          <DialogTitle>Dokumen — {name}</DialogTitle>
          <DialogDescription>
            Daftar hadir perjalanan ini, satu file PDF masing-masing.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {loadFailed && (
            <p className="text-sm text-destructive">
              Dokumen tidak dapat dimuat — tutup lalu buka lagi.
            </p>
          )}

          {dokumen && (
            <PerjadinDokumenList
              documents={dokumen.documents}
              hapus={{ gate: uploadGate, onDeleted: () => void load() }}
            />
          )}

          <div className="grid gap-3.5 border-t border-border pt-4">
            <div>
              <h3 className="text-sm font-medium">Unggah dokumen</h3>
              <RequiredLegend />
            </div>

            {refusal !== null && (
              <Alert variant="destructive">
                <AlertTitle>Dokumen belum tercatat.</AlertTitle>
                <AlertDescription>{refusal}</AlertDescription>
              </Alert>
            )}
            {unsynced && (
              <Alert>
                <AlertTitle>Dokumen tercatat.</AlertTitle>
                <AlertDescription>{DOCUMENT_UNSYNCED_NOTE}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-1.5">
              <Label
                htmlFor={`${ids}-kind`}
                className="gap-1"
              >
                Jenis dokumen
                <RequiredMark />
              </Label>
              <Select
                value={form.kind}
                onValueChange={(value) => {
                  update({ kind: value as PerjadinDocumentKind });
                }}
              >
                <SelectTrigger
                  id={`${ids}-kind`}
                  aria-required="true"
                >
                  <SelectValue placeholder="Pilih jenis dokumen" />
                </SelectTrigger>
                <SelectContent>
                  {PERJADIN_DOCUMENT_KINDS.map((kind) => (
                    <SelectItem
                      key={kind}
                      value={kind}
                    >
                      {kind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.kind !== "" && (
              <div className="grid gap-1.5">
                <Label
                  htmlFor={`${ids}-date`}
                  className="gap-1"
                >
                  {isPeserta ? "Tanggal Sesi" : "Tanggal Dokumen"}
                  <RequiredMark />
                </Label>
                <Input
                  id={`${ids}-date`}
                  aria-required="true"
                  type="date"
                  min={dokumen?.startsOn}
                  max={dokumen?.endsOn}
                  value={form.documentDate}
                  onChange={(event) => {
                    update({ documentDate: event.target.value });
                  }}
                />
              </div>
            )}

            {isPeserta && (
              <>
                <div className="grid gap-1.5">
                  <Label
                    htmlFor={`${ids}-school`}
                    className="gap-1"
                  >
                    Sekolah
                    <RequiredMark />
                  </Label>
                  {/* A plain select: a trip has few Schools, so nothing to search. */}
                  <Select
                    value={form.schoolId}
                    onValueChange={(value) => {
                      update({ schoolId: (value as string | null) ?? "" });
                    }}
                  >
                    <SelectTrigger
                      id={`${ids}-school`}
                      aria-required="true"
                    >
                      <SelectValue placeholder="Pilih sekolah">{school?.name}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(dokumen?.schools ?? []).map((option) => (
                        <SelectItem
                          key={option.id}
                          value={option.id}
                        >
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label
                      htmlFor={`${ids}-starts`}
                      className="gap-1"
                    >
                      Waktu Mulai{timeZoneSuffix(school?.timeZone)}
                      <RequiredMark />
                    </Label>
                    <TimeField
                      id={`${ids}-starts`}
                      aria-required="true"
                      value={form.startsAt}
                      onValueChange={(value) => {
                        update({ startsAt: value });
                      }}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label
                      htmlFor={`${ids}-ends`}
                      className="gap-1"
                    >
                      Waktu Selesai{timeZoneSuffix(school?.timeZone)}
                      <RequiredMark />
                    </Label>
                    <TimeField
                      id={`${ids}-ends`}
                      aria-required="true"
                      value={form.endsAt}
                      onValueChange={(value) => {
                        update({ endsAt: value });
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label
                    htmlFor={`${ids}-participant-type`}
                    className="gap-1"
                  >
                    Tipe Peserta
                    <RequiredMark />
                  </Label>
                  <Select
                    value={form.participantType}
                    onValueChange={(value) => {
                      update({ participantType: value as PerjadinDocumentParticipantType });
                    }}
                  >
                    <SelectTrigger
                      id={`${ids}-participant-type`}
                      aria-required="true"
                    >
                      <SelectValue placeholder="Pilih tipe peserta" />
                    </SelectTrigger>
                    <SelectContent>
                      {PERJADIN_DOCUMENT_PARTICIPANT_TYPES.map((option) => (
                        <SelectItem
                          key={option}
                          value={option}
                        >
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="grid gap-1.5">
              <Label className="gap-1">
                File
                <RequiredMark />
              </Label>
              <p className="-mt-0.5 text-xs text-muted-foreground">{DOCUMENT_HINT}</p>
              <input
                ref={picker}
                type="file"
                accept={DOCUMENT_ACCEPT}
                className="hidden"
                onChange={(event) => {
                  const picked = event.target.files?.[0];
                  event.target.value = "";
                  if (!picked) return;
                  const checked = pickDocument(picked);
                  if (typeof checked === "string") {
                    setFileNote(checked);
                    return;
                  }
                  setFile(checked);
                  setFileNote(null);
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => picker.current?.click()}
                >
                  Pilih file
                </Button>
                {file && (
                  <span className="truncate text-sm text-muted-foreground">{file.name}</span>
                )}
              </div>
              {fileNote !== null && <p className="text-sm text-destructive">{fileNote}</p>}
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            disabled={saving || !fields || !file || !dokumen}
            onClick={submit}
          >
            {saving ? "Mengunggah…" : "Unggah"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { PerjadinDokumenDialog };
