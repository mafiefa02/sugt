import {
  claimDocumentKindFolder,
  claimPerjadinDokumenFolder,
  documentReconcileTarget,
  markDocumentSynced,
  markDocumentSyncFailed,
  perjadinDriveFolder,
  type Person,
} from "@sugt/db/queries";

import { documentFileName, documentKindFolderName } from "./document-files";
import { ensureDokumenFolders } from "./dokumen-folders";
import type { ReadyFolders } from "./fixed-folders";
import { type DriveClient, isDriveFailure, isLinkShared } from "./google";
import { perjadinFolderName } from "./receipt-files";

/**
 * **The document reconcile** (ADR-0042, #397): put one recorded Perjadin Document in its place in
 * the company Drive, and say when it is done. Idempotent — run it again and it does only what is
 * still owed — and tracked by `perjadin_document.drive_synced_at`. It runs inline after an upload
 * is recorded, and Periksa koneksi's sweep and a reconnect re-run it.
 *
 * In order:
 * 1. **The fixed Dokumen folders** (`ensureDokumenFolders`), made if a connection predates them.
 * 2. **The Perjadin's Dokumen folder**, created under `Dokumen/Pelaksanaan Offline` if it has none,
 *    private, claimed by compare-and-set; its name is re-asserted as the receipts folder's is.
 * 3. **The kind folder**, created in it if the trip has none for this kind, by the same claim.
 * 4. **The file**, still in `_staging`, is named and moved into the kind folder. One a person has
 *    moved elsewhere stays there.
 * 5. **The file is shared** — anyone, reader — if it is not already. Last, so nothing is public
 *    before it is named and in place. **Only the file**: every folder stays private.
 * 6. `drive_synced_at` is set.
 *
 * **A trashed or missing Perjadin or kind folder is never recreated**, nor is a file gone from
 * Drive: the document stays unsynced and the answer says why. Any failure from Drive does the same
 * — the row already stands, so a failed reconcile costs only the sync, which the next run finishes.
 */

export type DocumentUnsyncedReason =
  | "folder-trashed"
  | "folder-missing"
  /** The uploaded file itself is in the Drive trash, or gone. */
  | "file-trashed"
  | "file-missing"
  | "drive-failed";

export type DocumentReconcileResult =
  | { outcome: "synced" }
  | { outcome: "unsynced"; reason: DocumentUnsyncedReason }
  | { outcome: "no-such-document" };

export async function reconcileDocument(
  person: Person,
  drive: DriveClient,
  folders: ReadyFolders,
  documentId: string,
): Promise<DocumentReconcileResult> {
  const result = await reconcileOnce(person, drive, folders, documentId);
  if (result.outcome === "unsynced") await markDocumentSyncFailed(person, documentId);
  return result;
}

async function reconcileOnce(
  person: Person,
  drive: DriveClient,
  folders: ReadyFolders,
  documentId: string,
): Promise<DocumentReconcileResult> {
  const target = await documentReconcileTarget(person, documentId);
  if (!target) return { outcome: "no-such-document" };

  try {
    // 1. The fixed Dokumen folders.
    const fixed = await ensureDokumenFolders(person, drive, folders.rootFolderId);

    // 2. The Perjadin's Dokumen folder.
    let tripFolderId = target.dokumenFolderId;
    if (!tripFolderId) {
      const made = await drive.createFolder({
        name: perjadinFolderName(target.destination, target.startsOn),
        parentId: fixed.pelaksanaanOfflineFolderId,
        appProperties: { sugtPerjadinId: target.perjadinId },
      });
      tripFolderId = await claimPerjadinDokumenFolder(person, target.perjadinId, made.id);
      if (tripFolderId !== made.id) await drive.trashFile(made.id);
    }
    const tripFolder = await drive.getFile(tripFolderId);
    if (!tripFolder) return { outcome: "unsynced", reason: "folder-missing" };
    if (tripFolder.trashed) return { outcome: "unsynced", reason: "folder-trashed" };
    await reassertTripFolderName(person, drive, target.perjadinId, tripFolder.id, tripFolder.name);

    // 3. The kind folder.
    let kindFolderId = target.kindFolderId;
    if (!kindFolderId) {
      const made = await drive.createFolder({
        name: documentKindFolderName(target.kind),
        parentId: tripFolderId,
        appProperties: { sugtPerjadinId: target.perjadinId },
      });
      kindFolderId = await claimDocumentKindFolder(person, target.perjadinId, target.kind, made.id);
      if (kindFolderId !== made.id) await drive.trashFile(made.id);
    }
    const kindFolder = await drive.getFile(kindFolderId);
    if (!kindFolder) return { outcome: "unsynced", reason: "folder-missing" };
    if (kindFolder.trashed) return { outcome: "unsynced", reason: "folder-trashed" };

    // 4. The file, out of `_staging`.
    const file = await drive.getFile(target.driveFileId);
    if (!file) return { outcome: "unsynced", reason: "file-missing" };
    if (file.trashed) return { outcome: "unsynced", reason: "file-trashed" };
    if (file.parents.includes(folders.stagingFolderId)) {
      await drive.updateFile(target.driveFileId, {
        name: documentFileName(target),
        addParent: kindFolderId,
        removeParent: folders.stagingFolderId,
        appProperties: { sugtPerjadinId: target.perjadinId, sugtDocumentId: target.documentId },
      });
    }

    // 5. Share the file, last — and only the file.
    const shared = isLinkShared(await drive.listPermissions(target.driveFileId));
    if (!shared) {
      await drive.createPermission(target.driveFileId, { type: "anyone", role: "reader" });
    }
  } catch (error) {
    if (isDriveFailure(error)) return { outcome: "unsynced", reason: "drive-failed" };
    throw error;
  }

  // 6.
  await markDocumentSynced(person, documentId);
  return { outcome: "synced" };
}

/**
 * Names are app-owned: a stale Dokumen folder name — a start date corrected while its rename
 * failed, or a rename by hand — is set back to what the database says, read fresh, as the receipts
 * folder's is (#376). A failed rename is logged and left; it is cosmetic.
 */
async function reassertTripFolderName(
  person: Person,
  drive: DriveClient,
  perjadinId: string,
  folderId: string,
  current: string,
): Promise<void> {
  const trip = await perjadinDriveFolder(person, perjadinId);
  if (!trip) return;
  const name = perjadinFolderName(trip.destination, trip.startsOn);
  if (current === name) return;
  await drive.updateFile(folderId, { name }).catch((error: unknown) => {
    console.error(
      `Re-asserting the name of Perjadin ${perjadinId}'s Dokumen folder failed.`,
      error,
    );
  });
}
