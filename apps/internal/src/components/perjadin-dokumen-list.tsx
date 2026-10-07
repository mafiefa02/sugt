"use client";

import { deleteDocumentAction } from "-/app/(app)/perjadin/[id]/dokumen/actions";
import {
  DOCUMENT_UNSYNCED_TOOLTIP,
  deleteRefusalText,
  documentRowText,
  sppdSummary,
} from "-/components/perjadin-dokumen-form";
import { UnsyncedMarker } from "-/components/unsynced-marker";
import { driveFileUrl } from "-/lib/drive/receipt-files";
import type { UploadGate } from "-/lib/drive/upload-gate";
import type { DocumentSchool, PerjadinDocumentRow } from "@sugt/db/queries";
import { PERJADIN_DOCUMENT_KINDS } from "@sugt/domain";
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
 * **A trip's Perjadin Documents, grouped by kind** (ADR-0042): four headings, each document with a
 * **Buka** link to its PDF in Drive and "belum tersinkron" while it is not yet in place. One list
 * for both places that show it — the Dokumen dialog on a `/pendamping` card, and the read-only
 * section on `/perjadin/[id]` (#398). The SPPD heading carries **SPPD: x/y sekolah** (#441), so a
 * School still missing its SPPD shows.
 *
 * With `hapus`, each row also carries **Hapus** — the dialog passes it, the trip page does not.
 */
function PerjadinDokumenList({
  documents,
  schools,
  hapus,
}: {
  documents: PerjadinDocumentRow[];
  /** The trip's Schools, which the SPPD summary counts against. */
  schools: DocumentSchool[];
  /** Hapus on every row: closed with the gate's reason while Drive cannot take it. */
  hapus?: { gate: UploadGate; onDeleted: () => void };
}) {
  return (
    <div className="grid gap-4">
      {PERJADIN_DOCUMENT_KINDS.map((kind) => {
        const rows = documents.filter((row) => row.kind === kind);
        return (
          <section key={kind}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 className="text-sm font-medium">{kind}</h3>
              {kind === "SPPD" && (
                <span className="text-sm text-muted-foreground tabular-nums">
                  {sppdSummary(schools)}
                </span>
              )}
            </div>
            {rows.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">Belum ada</p>
            ) : (
              <ul className="mt-1 grid gap-1 text-sm">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1"
                  >
                    <span className="tabular-nums">{documentRowText(row)}</span>
                    <a
                      href={driveFileUrl(row.driveFileId)}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4"
                    >
                      Buka
                    </a>
                    {row.unsynced && <UnsyncedMarker explanation={DOCUMENT_UNSYNCED_TOOLTIP} />}
                    {hapus && (
                      <Hapus
                        row={row}
                        gate={hapus.gate}
                        onDeleted={hapus.onDeleted}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/**
 * **Hapus** behind a confirmation (#398). The file goes to the Drive trash first, then the row; a
 * refusal — Drive disconnected, or unreachable — leaves the sheet listed and says why.
 */
function Hapus({
  row,
  gate,
  onDeleted,
}: {
  row: PerjadinDocumentRow;
  gate: UploadGate;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [deleting, startDeleting] = useTransition();

  function submit() {
    startDeleting(async () => {
      setRefusal(null);
      const result = await deleteDocumentAction(row.id);
      if (result.outcome === "deleted" || result.outcome === "no-such-document") {
        setOpen(false);
        onDeleted();
        return;
      }
      setRefusal(deleteRefusalText(result));
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setRefusal(null);
      }}
    >
      <DialogTrigger
        disabled={!gate.open}
        title={gate.open ? undefined : gate.reason}
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Hapus ${row.kind} ${documentRowText(row)}`}
          >
            Hapus
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus dokumen</DialogTitle>
          <DialogDescription>
            Hapus dokumen ini? File akan dipindahkan ke Sampah Google Drive.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          {row.kind} · {documentRowText(row)}
        </p>
        {refusal !== null && <p className="text-sm text-destructive">{refusal}</p>}
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
            variant="destructive"
            disabled={deleting}
            onClick={submit}
          >
            {deleting ? "Menghapus…" : "Hapus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { PerjadinDokumenList };
