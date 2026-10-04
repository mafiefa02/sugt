import { formatWib } from "-/lib/format-wib";
import { driveUploadState, type Person } from "@sugt/db/queries";

import { readyFolders } from "./fixed-folders";

/**
 * **Can a receipt be uploaded right now?** (ADR-0040, #373) Catat transaksi and every row's Unggah
 * bukti render disabled, with this reason, when it cannot — wherever the dialog renders: the
 * acquittal and the Staff Beranda's trip cards.
 *
 * The page's answer is a courtesy. The Server Actions refuse the same states themselves
 * (`driveAccessToken`), since nothing a page renders runs before a Server Action.
 */
export type ReceiptUploadGate = { open: true } | { open: false; reason: string };

export async function receiptUploadGate(person: Person): Promise<ReceiptUploadGate> {
  const state = await driveUploadState(person);
  if (!state) {
    return {
      open: false,
      reason: "Google Drive belum terhubung — minta Administrator menghubungkannya di Pengaturan.",
    };
  }
  if (state.status === "broken") {
    return {
      open: false,
      // `drive_connection_broken_at_check` guarantees a broken row has `broken_at`.
      reason: `Koneksi Google Drive terputus sejak ${formatWib(state.brokenAt!)} — minta Administrator menghubungkan ulang.`,
    };
  }
  if (!readyFolders(state)) {
    return {
      open: false,
      reason: "Folder Google Drive bermasalah — minta Administrator memeriksanya di Pengaturan.",
    };
  }
  return { open: true };
}
