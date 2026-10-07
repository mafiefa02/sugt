import type {
  DeleteDocumentActionResult,
  OpenDocumentSessionResult,
  RecordDocumentActionResult,
} from "-/app/(app)/perjadin/[id]/dokumen/action-types";
import { MAX_UPLOAD_MEGABYTES, UPLOAD_TOO_LARGE } from "-/lib/drive/receipt-upload";
import { driveRefusalText, STALE_PAGE } from "-/lib/drive/upload-messages";
import type { DocumentFields, DocumentFieldsRefusal, PerjadinDocumentRow } from "@sugt/db/queries";
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

/** The picker's `accept`: one PDF. A multi-page document is scanned to one PDF by the uploader. */
export const DOCUMENT_ACCEPT = "application/pdf";

export const DOCUMENT_HINT = `1 file .pdf, maks. ${MAX_UPLOAD_MEGABYTES} MB`;

export const ONLY_PDF = "Hanya file .pdf";

/** The document is recorded, but the reconcile did not finish in Drive; the next one will. */
export const DOCUMENT_UNSYNCED_NOTE =
  "Dokumen belum tersinkron ke Google Drive. Sinkronisasi akan diselesaikan kemudian; tidak ada yang perlu diulang.";

/** What the "belum tersinkron" marker on a document says, in full. */
export const DOCUMENT_UNSYNCED_TOOLTIP =
  "Dokumen belum tersinkron ke Google Drive — Administrator dapat menyelesaikannya lewat Periksa koneksi.";

/** A picked file, or why it is refused in the browser — before anything is uploaded. */
export function pickDocument(file: File): File | string {
  if (file.type !== DOCUMENT_ACCEPT) return ONLY_PDF;
  if (file.size > MAX_UPLOAD_BYTES) return UPLOAD_TOO_LARGE;
  return file;
}

/**
 * One document as its row reads: the date, for a Peserta sheet its School, cohort and span, and for
 * an SPPD its School alone (#441).
 */
export function documentRowText(row: PerjadinDocumentRow): string {
  if (row.kind === "SPPD") return row.schoolName ?? "";
  if (row.schoolName && row.participantType && row.startsAt && row.endsAt && row.timeZone) {
    return [
      row.documentDate,
      row.schoolName,
      row.participantType,
      formatTimeRange(row.startsAt, row.endsAt, row.timeZone),
    ].join(" · ");
  }
  return row.documentDate ?? "";
}

/**
 * **`SPPD: x/y sekolah`** (#441): how many of the trip's Schools have their SPPD, so a missing one
 * shows. An SPPD for a School that has since left the trip still stands, but is not counted.
 */
export function sppdSummary(schools: { hasSppd: boolean }[]): string {
  return `SPPD: ${schools.filter((school) => school.hasSppd).length}/${schools.length} sekolah`;
}

/** What the SPPD picker marks a School that already has its SPPD on this trip. */
export const SPPD_EXISTS_MARK = "sudah ada";

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
 * disabled, and a document the server would refuse for a blank is never uploaded first. A Peserta
 * sheet needs all four of its own fields and the date; an SPPD only its School, and never a date;
 * Narasumber and Pendamping sheets need only the date.
 */
export function documentFields(form: DocumentForm): DocumentFields | null {
  if (form.kind === "SPPD") {
    if (form.schoolId === "") return null;
    return { kind: form.kind, documentDate: null, sppd: { schoolId: form.schoolId } };
  }
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

/** Every refusal of a document's fields, so one guard tells them from the actions' own. */
const FIELDS_REFUSALS: Record<DocumentFieldsRefusal["outcome"], true> = {
  "no-such-perjadin": true,
  "invalid-fields": true,
  "date-outside-perjadin": true,
  "school-not-on-perjadin": true,
  "times-out-of-order": true,
  "sppd-exists": true,
};

function isFieldsRefusal(result: { outcome: string }): result is DocumentFieldsRefusal {
  return Object.hasOwn(FIELDS_REFUSALS, result.outcome);
}

/** Why the document's fields are refused — before the upload opens, or again at the record. */
function fieldsRefusalText(result: DocumentFieldsRefusal): string {
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
    case "sppd-exists":
      return `${result.schoolName} sudah punya SPPD untuk Perjadin ini. Hapus dulu untuk menggantinya.`;
  }
}

/** Why no upload session opened. Nothing has been uploaded yet. */
export function sessionRefusalText(
  result: Exclude<OpenDocumentSessionResult, { outcome: "ready" }>,
): string {
  if (isFieldsRefusal(result)) return fieldsRefusalText(result);
  switch (result.outcome) {
    case "not-pdf":
      return ONLY_PDF;
    case "too-large":
      return UPLOAD_TOO_LARGE;
    default:
      return driveRefusalText(result);
  }
}

/** Why the document was not recorded. Nothing was written, so the form keeps every value. */
export function recordRefusalText(
  result: Exclude<RecordDocumentActionResult, { outcome: "recorded" }>,
): string {
  if (isFieldsRefusal(result)) return fieldsRefusalText(result);
  switch (result.outcome) {
    case "file-unverified":
      return "Berkas tidak dapat diperiksa di Google Drive — unggah ulang.";
    case "not-pdf":
      return ONLY_PDF;
    default:
      return driveRefusalText(result);
  }
}

/** Why Hapus did not go through. The document is still listed, and its file still where it was. */
export function deleteRefusalText(
  result: Exclude<DeleteDocumentActionResult, { outcome: "deleted" | "no-such-document" }>,
): string {
  return driveRefusalText(result);
}
