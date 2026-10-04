import {
  claimPerjadinDriveFolder,
  claimTransactionDriveFolder,
  markTransactionSyncFailed,
  markTransactionSynced,
  reconcileTarget,
  type Person,
} from "@sugt/db/queries";

import type { ReadyFolders } from "./fixed-folders";
import { type DriveClient, isDriveFailure } from "./google";
import {
  evidenceFileName,
  isReceiptContentType,
  perjadinFolderName,
  transactionFolderName,
} from "./receipt-files";

/**
 * **The reconcile** (ADR-0040, #373): put one recorded transaction in its place in the company
 * Drive, and say when it is done. Idempotent — run it again and it does only what is still owed —
 * and tracked by `transaction.drive_synced_at`. It runs inline after Catat transaksi and (#374) after
 * Unggah bukti, and is what Periksa koneksi's sweep and a reconnect re-run (#375).
 *
 * In order:
 * 1. **The Perjadin folder.** Created under `Pelaksanaan Offline` if the Perjadin has none, private,
 *    and claimed by compare-and-set; a caller that lost trashes its own and uses the winner's. An
 *    existing one whose name is stale — its start date corrected since — is renamed back (#376).
 * 2. **The transaction folder.** Created straight in the Perjadin folder if the line has none (a line
 *    from before Drive), by the same compare-and-set. One still in `_staging` — where Catat builds
 *    it — moves into the Perjadin folder. **One a person has moved elsewhere stays there.**
 * 3. **Each receipt still in `_staging`** is renamed and moved into the transaction folder.
 * 4. **The transaction folder is shared** — anyone, reader — if it is not already. Last, so nothing
 *    is public before it is named and in place. Only transaction folders are ever shared.
 * 5. `drive_synced_at` is set — **only if** no Drive receipt on the line arrived after step 3 read
 *    them (`markTransactionSynced`).
 *
 * **A trashed or missing folder — the Perjadin's or the line's — is never recreated**: the line stays
 * unsynced and the answer says why. Any failure from Drive does the same — the database already
 * holds the line, so a failed reconcile costs only the sync, which the next run finishes.
 *
 * **It assumes a usable connection**: its `drive` and `folders` are what `driveAccessToken` answers
 * with `ok`, and only then. A caller holding neither cannot call it — that is how "not connected
 * touches nothing" is held.
 */

/** Why a line is still owed after a reconcile. */
export type UnsyncedReason =
  | "folder-trashed"
  | "folder-missing"
  | "drive-failed"
  /** A receipt committed while this ran is still owed; its own run, or the next sweep, does it. */
  | "newer-receipts";

export type ReconcileResult =
  | { outcome: "synced" }
  | { outcome: "unsynced"; reason: UnsyncedReason }
  | { outcome: "no-such-transaction" };

export async function reconcileTransaction(
  person: Person,
  drive: DriveClient,
  folders: ReadyFolders,
  transactionId: string,
): Promise<ReconcileResult> {
  const result = await reconcileOnce(person, drive, folders, transactionId);
  // A failure is remembered so the sweep tries other lines first next time (#375). `newer-receipts`
  // is not one: the line is fine, and the newer receipt's own run is under way.
  if (result.outcome === "unsynced" && result.reason !== "newer-receipts") {
    await markTransactionSyncFailed(person, transactionId);
  }
  return result;
}

async function reconcileOnce(
  person: Person,
  drive: DriveClient,
  folders: ReadyFolders,
  transactionId: string,
): Promise<ReconcileResult> {
  const target = await reconcileTarget(person, transactionId);
  if (!target) return { outcome: "no-such-transaction" };

  try {
    // 1. The Perjadin folder.
    let perjadinFolderId = target.perjadinDriveFolderId;
    if (!perjadinFolderId) {
      const made = await drive.createFolder({
        name: perjadinFolderName(target.destination, target.startsOn),
        parentId: folders.pelaksanaanOfflineFolderId,
        appProperties: { sugtPerjadinId: target.perjadinId },
      });
      perjadinFolderId = await claimPerjadinDriveFolder(person, target.perjadinId, made.id);
      if (perjadinFolderId !== made.id) await drive.trashFile(made.id);
    }
    // An existing Perjadin folder is checked like the transaction's below: nothing is put into a
    // folder that is in the trash or gone, and neither is recreated.
    const perjadinFolder = await drive.getFile(perjadinFolderId);
    if (!perjadinFolder) return { outcome: "unsynced", reason: "folder-missing" };
    if (perjadinFolder.trashed) return { outcome: "unsynced", reason: "folder-trashed" };
    // Names are app-owned: a stale one — a start date corrected while the rename failed, or a
    // rename by hand — is set back to what the database says (#376).
    const expectedName = perjadinFolderName(target.destination, target.startsOn);
    if (perjadinFolder.name !== expectedName) {
      await drive.updateFile(perjadinFolderId, { name: expectedName });
    }

    // 2. The transaction folder.
    let transactionFolderId = target.driveFolderId;
    if (!transactionFolderId) {
      const made = await drive.createFolder({
        name: transactionFolderName(target.spentOn, target.category, target.transactionId),
        parentId: perjadinFolderId,
        appProperties: {
          sugtPerjadinId: target.perjadinId,
          sugtTransactionId: target.transactionId,
        },
      });
      transactionFolderId = await claimTransactionDriveFolder(
        person,
        target.transactionId,
        made.id,
      );
      if (transactionFolderId !== made.id) await drive.trashFile(made.id);
    }

    const folder = await drive.getFile(transactionFolderId);
    if (!folder) return { outcome: "unsynced", reason: "folder-missing" };
    if (folder.trashed) return { outcome: "unsynced", reason: "folder-trashed" };
    if (folder.parents.includes(folders.stagingFolderId)) {
      await drive.updateFile(transactionFolderId, {
        addParent: perjadinFolderId,
        removeParent: folders.stagingFolderId,
      });
    }

    // 3. Receipts still in `_staging`.
    await Promise.all(
      target.evidence.map(async (receipt) => {
        const file = await drive.getFile(receipt.driveFileId);
        if (!file || !file.parents.includes(folders.stagingFolderId)) return;
        if (!isReceiptContentType(receipt.contentType)) return;
        await drive.updateFile(receipt.driveFileId, {
          name: evidenceFileName(
            target.spentOn,
            target.category,
            target.transactionId,
            receipt.id,
            receipt.contentType,
          ),
          addParent: transactionFolderId,
          removeParent: folders.stagingFolderId,
          appProperties: { sugtTransactionId: target.transactionId },
        });
      }),
    );

    // 4. Share, last.
    const permissions = await drive.listPermissions(transactionFolderId);
    const shared = permissions.some(
      (permission) =>
        !permission.inherited && permission.type === "anyone" && permission.role === "reader",
    );
    if (!shared) {
      await drive.createPermission(transactionFolderId, { type: "anyone", role: "reader" });
    }
  } catch (error) {
    if (isDriveFailure(error)) return { outcome: "unsynced", reason: "drive-failed" };
    throw error;
  }

  // 5. Only for the receipts handled here — a newer one, committed meanwhile, keeps the line owed.
  const synced = await markTransactionSynced(
    person,
    target.transactionId,
    target.evidence.map((receipt) => receipt.id),
  );
  return synced ? { outcome: "synced" } : { outcome: "unsynced", reason: "newer-receipts" };
}
