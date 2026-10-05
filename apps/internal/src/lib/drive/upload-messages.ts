/**
 * **The sentences a receipt control says when Drive cannot take an upload** (ADR-0040) — one place,
 * because the page's gate (`upload-gate.ts`, on the server) and the dialog's refusals (in the
 * browser) say them both. Plain strings, nothing server-only, so the client can import it.
 */

export const DRIVE_NOT_CONNECTED =
  "Google Drive belum terhubung — minta Administrator menghubungkannya di Pengaturan.";

/** `since` is already formatted, `2026-10-05 09:30 WIB`. */
export function driveBrokenSince(since: string): string {
  return `Koneksi Google Drive terputus sejak ${since} — minta Administrator menghubungkan ulang.`;
}

export const DRIVE_FOLDERS_UNRESOLVED =
  "Folder Google Drive bermasalah — minta Administrator memeriksanya di Pengaturan.";

export const DRIVE_UNREACHABLE = "Google Drive tidak dapat dihubungi — coba lagi.";
