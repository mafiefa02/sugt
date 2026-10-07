import type { TransactionCategory } from "@sugt/domain";

/**
 * **What a receipt in the company Drive is called, and what it is** (ADR-0040) — pure functions, no
 * Google, so every name and every sniff is unit-tested on its own.
 *
 * The tree they name:
 *
 * ```
 * Pelaksanaan Offline/
 * └── {name} · {the trip's Schools} · P-{perjadin8}/              ← Perjadin folder, private
 *     └── {spent_on} · {category} · T-{txn8}/                    ← transaction folder, shared
 *         └── {spent_on} · {category} · T-{txn8} · {ev8}.{ext}
 * ```
 *
 * Dates are ISO; the separator is ` · ` (U+00B7 with a space each side) everywhere; `/` becomes
 * `-` in the two categories that hold one. The Perjadin folder is named by `perjadinFolderName` in
 * `../perjadin-name.ts`, the one place a Perjadin's name is put together (ADR-0044).
 * `txn8`/`ev8` are the first 8 hex characters of the
 * transaction and evidence uuids, and the extension comes from the **sniffed** type, never the
 * browser's word. Names are app-owned: the database holds ids, so a rename by hand breaks nothing.
 */

/** The four types a receipt may be, as the server sniffs them. `transaction_evidence` CHECKs them. */
export const RECEIPT_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type ReceiptContentType = (typeof RECEIPT_CONTENT_TYPES)[number];

const EXTENSIONS: Record<ReceiptContentType, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isReceiptContentType(value: string): value is ReceiptContentType {
  return (RECEIPT_CONTENT_TYPES as readonly string[]).includes(value);
}

export function receiptExtension(contentType: ReceiptContentType): string {
  return EXTENSIONS[contentType];
}

/** The separator in every app-made name. Shared with the Dokumen names (`document-files.ts`). */
export const SEPARATOR = " · ";

/** The first 8 hex characters of a uuid — its first group. */
export function short(uuid: string): string {
  return uuid.replaceAll("-", "").slice(0, 8);
}

/** `2026-10-13 · Transport Bandara-Stasiun · T-1a2b3c4d` */
export function transactionFolderName(
  spentOn: string,
  category: TransactionCategory,
  transactionId: string,
): string {
  return [spentOn, category.replaceAll("/", "-"), `T-${short(transactionId)}`].join(SEPARATOR);
}

/** `2026-10-13 · Transport Bandara-Stasiun · T-1a2b3c4d · 5e6f7a8b.jpg` */
export function evidenceFileName(
  spentOn: string,
  category: TransactionCategory,
  transactionId: string,
  evidenceId: string,
  contentType: ReceiptContentType,
): string {
  const stem = transactionFolderName(spentOn, category, transactionId);
  return `${stem}${SEPARATOR}${short(evidenceId)}.${receiptExtension(contentType)}`;
}

/** Bytes to read from a file's start: enough for every signature below. */
export const SNIFF_LENGTH = 16;

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

const ascii = (text: string) => [...text].map((character) => character.charCodeAt(0));

/**
 * What a file really is, from its first bytes — Drive inspects nothing, so this is the only check
 * that a "receipt" is a PDF or an image and not anything else. `null` for anything outside the four.
 */
export function sniffReceiptType(bytes: Uint8Array): ReceiptContentType | null {
  if (startsWith(bytes, ascii("%PDF-"))) return "application/pdf";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp";
  return null;
}

/**
 * A file in Drive, as a link — a receipt, which anyone holding it can open once its transaction
 * folder is shared, or a Perjadin Document, shared file by file (ADR-0042).
 */
export function driveFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}

/** A Drive folder, as a link. */
export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`;
}
