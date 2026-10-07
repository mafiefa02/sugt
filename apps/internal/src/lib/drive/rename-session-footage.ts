import {
  driveCredentials,
  sessionFootageFolders,
  type Person,
  type SessionFootageFolder,
} from "@sugt/db/queries";

import { refreshDriveToken } from "./access-token";
import { footageFileName, sessionFootageFolderName } from "./footage-files";
import { type DriveClient, openDrive } from "./google";

/**
 * **Keep a Session's footage named for its date and start time** (#424, ADR-0046). The Session's
 * folder and every placed file in it carry the date; the folder carries the start time and the
 * School too. When a Session moves — `/sesi/[id]`'s "Ubah tanggal & jam", or Ubah Sesi on the trip —
 * `renameSessionFootage` renames them right after the change commits; Periksa koneksi re-asserts
 * every Session's (`reassertSessionFootageNames`), which also picks up a School renamed since.
 */

export type SessionFootageNameResult = {
  /** Names changed: the folder and the files together. */
  renamed: number;
  /** The folder could not be named, and so its files were left alone. */
  problem: "folder-trashed" | "folder-missing" | null;
};

/**
 * Put one Session's footage folder and its files under their right names. A file that has gone, or is
 * in the trash, is skipped: it has nothing to show under any name. A Drive failure throws, for the
 * caller to answer.
 */
export async function reassertSessionFootageNames(
  drive: DriveClient,
  folder: SessionFootageFolder,
): Promise<SessionFootageNameResult> {
  const { naming } = folder;
  const found = await drive.getFile(folder.folderId);
  if (!found) return { renamed: 0, problem: "folder-missing" };
  if (found.trashed) return { renamed: 0, problem: "folder-trashed" };

  let renamed = 0;
  const folderName = sessionFootageFolderName(naming);
  if (found.name !== folderName) {
    await drive.updateFile(folder.folderId, { name: folderName });
    renamed += 1;
  }
  for (const placed of folder.files) {
    const file = await drive.getFile(placed.driveFileId);
    if (!file || file.trashed) continue;
    const name = footageFileName({
      ...placed,
      heldOn: naming.heldOn,
      schoolName: naming.schoolName,
    });
    if (file.name !== name) {
      await drive.updateFile(placed.driveFileId, { name });
      renamed += 1;
    }
  }
  return { renamed, problem: null };
}

/**
 * **Rename one Session's footage after its date or time changed** — best effort, after the commit,
 * like `renamePerjadinFolder`: a Session with no footage folder costs one read, and any failure is
 * logged and left to Periksa koneksi. Never throws, so it cannot undo the change it follows.
 */
export async function renameSessionFootage(person: Person, sessionId: string): Promise<void> {
  try {
    const [folder] = await sessionFootageFolders(person, sessionId);
    if (!folder) return;

    const credentials = await driveCredentials(person);
    if (credentials?.status !== "connected") return;
    const token = await refreshDriveToken(person, credentials);
    if (token.outcome !== "ok") return;

    await reassertSessionFootageNames(openDrive(token.accessToken), folder);
  } catch (error) {
    console.error(`Renaming the footage of Session ${sessionId} in Drive failed.`, error);
  }
}
