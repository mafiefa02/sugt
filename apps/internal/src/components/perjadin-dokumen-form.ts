import type {
  DeleteDocumentActionResult,
  OpenDocumentSessionResult,
  RecordDocumentActionResult,
} from "-/app/(app)/perjadin/[id]/dokumen/action-types";
import { MAX_UPLOAD_MEGABYTES, UPLOAD_TOO_LARGE } from "-/lib/drive/receipt-upload";
import { driveRefusalText, STALE_PAGE } from "-/lib/drive/upload-messages";
import type { DocumentFields, PerjadinDocumentRow } from "@sugt/db/queries";
import {
  formatTimeRange,
  MAX_UPLOAD_BYTES,
  type PerjadinDocumentKind,
  type PerjadinDocumentParticipantType,
} from "@sugt/domain";

/**
 * **What the Dokumen dialog says and checks** (ADR-0042, #397) — plain functions, kept apart from
 * the `"use client"` dialog so each is tested without mounting it, as `table-sort.ts` is.
 */

/** The picker's `accept`: one PDF. A multi-page sheet is scanned to one PDF by the uploader. */
export const DOCUMENT_ACCEPT = "application/pdf";

export const DOCUMENT_HINT = `1 file .pdf, maks. ${MAX_UPLOAD_MEGABYTES} MB`;

export const ONLY_PDF = "Hanya file .pdf";

/** The sheet is recorded, but the reconcile did not finish in Drive; the next one will. */
export const DOCUMENT_UNSYNCED_NOTE =
  "Dokumen belum tersinkron ke Google Drive. Sinkronisasi akan diselesaikan kemudian; tidak ada yang perlu diulang.";

/** What the "belum tersinkron" marker on a sheet says, in full. */
export const DOCUMENT_UNSYNCED_TOOLTIP =
  "Dokumen belum tersinkron ke Google Drive — Administrator dapat menyelesaikannya lewat Periksa koneksi.";

/** A picked file, or why it is refused in the browser — before anything is uploaded. */
export function pickDocument(file: File): File | string {
  if (file.type !== DOCUMENT_ACCEPT) return ONLY_PDF;
  if (file.size > MAX_UPLOAD_BYTES) return UPLOAD_TOO_LARGE;
  return file;
}

/** One sheet as its row reads: the date, and for a Peserta sheet its School, cohort and span. */
export function documentRowText(row: PerjadinDocumentRow): string {
  if (row.schoolName && row.participantType && row.startsAt && row.endsAt && row.timeZone) {
    return [
      row.documentDate,
      row.schoolName,
      row.participantType,
      formatTimeRange(row.startsAt, row.endsAt, row.timeZone),
    ].join(" · ");
  }
  return row.documentDate;
}

/** The Unggah dokumen form as typed: every field a string, empty until chosen. */
export type DocumentForm = {
  kind: PerjadinDocumentKind | "";
  documentDate: string;
  schoolId: string;
  participantType: PerjadinDocumentParticipantType | "";
  startsAt: string;
  endsAt: string;
};

export const EMPTY_DOCUMENT_FORM: DocumentForm = {
  kind: "",
  documentDate: "",
  schoolId: "",
  participantType: "",
  startsAt: "",
  endsAt: "",
};

/**
 * The form's fields as the server takes them, or `null` while one is missing — so Unggah stays
 * disabled, and a sheet the server would refuse for a blank is never uploaded first. A Peserta
 * sheet needs all four of its own fields; the other two need only the date.
 */
export function documentFields(form: DocumentForm): DocumentFields | null {
  if (form.kind === "" || form.documentDate === "") return null;
  if (form.kind !== "Daftar Hadir Peserta") {
    return { kind: form.kind, documentDate: form.documentDate };
  }
  if (
    form.schoolId === "" ||
    form.participantType === "" ||
    form.startsAt === "" ||
    form.endsAt === ""
  ) {
    return null;
  }
  return {
    kind: form.kind,
    documentDate: form.documentDate,
    peserta: {
      schoolId: form.schoolId,
      participantType: form.participantType,
      startsAt: form.startsAt,
      endsAt: form.endsAt,
    },
  };
}

/** Why no upload session opened. Nothing has been uploaded yet. */
export function sessionRefusalText(
  result: Exclude<OpenDocumentSessionResult, { outcome: "ready" }>,
): string {
  switch (result.outcome) {
    case "no-such-perjadin":
      return STALE_PAGE;
    case "not-pdf":
      return ONLY_PDF;
    case "too-large":
      return UPLOAD_TOO_LARGE;
    default:
      return driveRefusalText(result);
  }
}

/** Why the sheet was not recorded. Nothing was written, so the form keeps every value. */
export function recordRefusalText(
  result: Exclude<RecordDocumentActionResult, { outcome: "recorded" }>,
): string {
  switch (result.outcome) {
    case "no-such-perjadin":
      return STALE_PAGE;
    case "invalid-fields":
      return "Lengkapi isian sesuai jenis dokumen.";
    case "date-outside-perjadin":
      return `Tanggal harus di antara ${result.startsOn} dan ${result.endsOn}.`;
    case "school-not-on-perjadin":
      return "Sekolah ini tidak punya Sesi di Perjadin ini.";
    case "times-out-of-order":
      return "Waktu Selesai harus setelah Waktu Mulai.";
    case "file-unverified":
      return "Berkas tidak dapat diperiksa di Google Drive — unggah ulang.";
    case "not-pdf":
      return ONLY_PDF;
    default:
      return driveRefusalText(result);
  }
}

/** Why Hapus did not go through. The sheet is still listed, and its file still where it was. */
export function deleteRefusalText(
  result: Exclude<DeleteDocumentActionResult, { outcome: "deleted" | "no-such-document" }>,
): string {
  return driveRefusalText(result);
}
