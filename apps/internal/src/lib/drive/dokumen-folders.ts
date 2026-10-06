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
 * compare-and-set (`claimDokumenFolder`); a caller that lost trashes its own and reads the ids
 * again. **`null`** means it lost every time — another caller kept changing them — and the next
 * ensure tries again. A Drive failure throws, for the caller to answer.
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

/** How many times one ensure reads the ids again after losing a claim, before it gives up. */
const CLAIM_ATTEMPTS = 3;

export async function ensureDokumenFolders(
  person: Person,
  drive: DriveClient,
  rootFolderId: string,
): Promise<EnsuredDokumenFolders | null> {
  let created = false;
  for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt += 1) {
    const stored = (await dokumenFolderIds(person)) ?? {
      dokumenFolderId: null,
      dokumenPelaksanaanOfflineFolderId: null,
    };

    let dokumenFolderId = stored.dokumenFolderId;
    if (!dokumenFolderId || !(await usable(drive, dokumenFolderId))) {
      const made = await drive.createFolder({ name: DOKUMEN_FOLDER_NAME, parentId: rootFolderId });
      const won = await claimDokumenFolder(person, {
        folder: "dokumenFolderId",
        expected: dokumenFolderId,
        next: made.id,
      });
      if (!won) {
        await drive.trashFile(made.id);
        continue;
      }
      created = true;
      // The claim cleared `Pelaksanaan Offline/`: a new `Dokumen/` holds none yet.
      dokumenFolderId = made.id;
      stored.dokumenPelaksanaanOfflineFolderId = null;
    }

    const pelaksanaanId = stored.dokumenPelaksanaanOfflineFolderId;
    if (pelaksanaanId && (await usable(drive, pelaksanaanId))) {
      return { dokumenFolderId, pelaksanaanOfflineFolderId: pelaksanaanId, created };
    }
    const made = await drive.createFolder({
      name: PELAKSANAAN_OFFLINE_FOLDER_NAME,
      parentId: dokumenFolderId,
    });
    const won = await claimDokumenFolder(person, {
      folder: "dokumenPelaksanaanOfflineFolderId",
      expected: pelaksanaanId,
      next: made.id,
      parentId: dokumenFolderId,
    });
    if (!won) {
      await drive.trashFile(made.id);
      continue;
    }
    return { dokumenFolderId, pelaksanaanOfflineFolderId: made.id, created: true };
  }
  return null;
}
