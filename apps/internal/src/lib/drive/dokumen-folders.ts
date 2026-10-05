import { claimDokumenFolder, dokumenFolderIds, type Person } from "@sugt/db/queries";

import { PELAKSANAAN_OFFLINE_FOLDER_NAME } from "./fixed-folders";
import type { DriveClient } from "./google";

/**
 * **`Dokumen/` and `Dokumen/Pelaksanaan Offline/`** (ADR-0042), the fixed part of the documents'
 * tree, under the root beside `Bukti Transaksi/`:
 *
 * ```
 * SUGT ITB 2026 Internal App Object Storage/
 * ├── Bukti Transaksi/Pelaksanaan Offline/
 * └── Dokumen/Pelaksanaan Offline/
 * ```
 *
 * **Ensured wherever a document needs them** — a connect, Periksa koneksi, and the document
 * reconcile — so a connection made before them gets them without reconnecting. They are kept out of
 * `ensureFixedFolders`' readiness on purpose: a receipt never waits on them.
 *
 * The rule is `Bukti Transaksi`'s: an id that is unset, missing or trashed gets a fresh folder, and
 * a fresh `Dokumen/` gets a fresh `Pelaksanaan Offline/` with it. Each id is claimed by
 * compare-and-set (`claimDokumenFolder`); a caller that lost trashes its own and uses the winner's.
 * A Drive failure throws, for the caller to answer.
 */

export const DOKUMEN_FOLDER_NAME = "Dokumen";

export type EnsuredDokumenFolders = {
  dokumenFolderId: string;
  pelaksanaanOfflineFolderId: string;
  /** Whether either folder had to be made just now — what Periksa koneksi reports. */
  created: boolean;
};

async function usable(drive: DriveClient, id: string | null): Promise<boolean> {
  if (!id) return false;
  const file = await drive.getFile(id);
  return Boolean(file && !file.trashed);
}

export async function ensureDokumenFolders(
  person: Person,
  drive: DriveClient,
  rootFolderId: string,
): Promise<EnsuredDokumenFolders> {
  const stored = (await dokumenFolderIds(person)) ?? {
    dokumenFolderId: null,
    dokumenPelaksanaanOfflineFolderId: null,
  };
  let created = false;

  let dokumenFolderId = stored.dokumenFolderId;
  let pelaksanaanId = stored.dokumenPelaksanaanOfflineFolderId;
  if (!dokumenFolderId || !(await usable(drive, dokumenFolderId))) {
    const made = await drive.createFolder({ name: DOKUMEN_FOLDER_NAME, parentId: rootFolderId });
    dokumenFolderId = await claimDokumenFolder(person, "dokumenFolderId", dokumenFolderId, made.id);
    if (dokumenFolderId !== made.id) await drive.trashFile(made.id);
    // Whichever `Dokumen/` won, its `Pelaksanaan Offline/` is read afresh below.
    pelaksanaanId = (await dokumenFolderIds(person))?.dokumenPelaksanaanOfflineFolderId ?? null;
    created = true;
  }

  if (!pelaksanaanId || !(await usable(drive, pelaksanaanId))) {
    const made = await drive.createFolder({
      name: PELAKSANAAN_OFFLINE_FOLDER_NAME,
      parentId: dokumenFolderId,
    });
    pelaksanaanId = await claimDokumenFolder(
      person,
      "dokumenPelaksanaanOfflineFolderId",
      pelaksanaanId,
      made.id,
    );
    if (pelaksanaanId !== made.id) await drive.trashFile(made.id);
    created = true;
  }

  return { dokumenFolderId, pelaksanaanOfflineFolderId: pelaksanaanId, created };
}
