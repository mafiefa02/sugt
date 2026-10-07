import { type DriveClient, DriveRequestError } from "./google";

/**
 * **Move a file to the Drive trash, unless it is there already or gone** — both count as done, so a
 * Hapus that failed after this step can simply be pressed again (ADR-0042). Shared by the Dokumen and
 * the Foto & Video Hapus.
 */
export async function trashIfLive(drive: DriveClient, driveFileId: string): Promise<void> {
  const file = await drive.getFile(driveFileId);
  if (!file || file.trashed) return;
  await drive.trashFile(driveFileId).catch((error: unknown) => {
    // Gone between the read and the trash: done all the same.
    if (error instanceof DriveRequestError && error.status === 404) return;
    throw error;
  });
}
