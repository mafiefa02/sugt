import type { PerjadinDocumentKind, PerjadinDocumentParticipantType } from "@sugt/domain";

import { SEPARATOR, short } from "./receipt-files";

/**
 * **What a Perjadin Document in the company Drive is called** (ADR-0042) — pure functions beside
 * `receipt-files.ts`, sharing its separator and its short ids. The tree they name:
 *
 * ```
 * Dokumen/Pelaksanaan Offline/
 * └── {destination} · {starts_on}/                       ← the Perjadin's Dokumen folder, private
 *     └── Daftar Hadir Peserta/                          ← one folder per kind, private
 *         └── {date} · {school} · {Siswa|GTK-MS} · Daftar Hadir Peserta · D-{doc8}.pdf
 * ```
 *
 * The Perjadin's folder is named as its receipts folder is (`perjadinFolderName`). Only the file is
 * ever shared. `D-{doc8}` — the first 8 hex characters of the document's uuid — tells apart two
 * sheets Drive would otherwise show under one name: a re-upload, or two Peserta sheets for one
 * School, date and cohort.
 */

/** A kind's folder is named for the kind. */
export function documentKindFolderName(kind: PerjadinDocumentKind): string {
  return kind;
}

/** What a document's file name is built from. The School and cohort are a Peserta sheet's only. */
export type DocumentNameParts = {
  documentId: string;
  kind: PerjadinDocumentKind;
  documentDate: string;
  schoolName: string | null;
  participantType: PerjadinDocumentParticipantType | null;
};

/**
 * `2026-10-14 · SMAN 1 Bontang · Siswa · Daftar Hadir Peserta · D-1a2b3c4d.pdf`, or
 * `2026-10-14 · Daftar Hadir Pendamping · D-1a2b3c4d.pdf`. A `/` in a School's name becomes `-`.
 */
export function documentFileName(parts: DocumentNameParts): string {
  const peserta =
    parts.schoolName && parts.participantType
      ? [parts.schoolName.replaceAll("/", "-"), parts.participantType]
      : [];
  const stem = [parts.documentDate, ...peserta, parts.kind, `D-${short(parts.documentId)}`];
  return `${stem.join(SEPARATOR)}.pdf`;
}
