import { driveCredentials, perjadinDriveFolder, type Person } from "@sugt/db/queries";

import { refreshDriveToken } from "./access-token";
import { openDrive } from "./google";
import { perjadinFolderName } from "./receipt-files";

/**
 * **Rename a Perjadin's Drive folder after its start date was corrected** (#376, ADR-0040), so the
 * company Drive shows `{destination} · {new starts_on}`.
 *
 * **Best effort, after the commit.** The correction has already been written; nothing here can fail
 * it or roll it back. A trip with no Drive folder yet, or a connection that is not `connected`, makes
 * no call to Google at all. The fixed tree need not be resolved — renaming one folder by its id needs
 * none of it. A rename that fails is logged and left: the next reconcile that touches this Perjadin —
 * a Catat transaksi or Unggah bukti on it, or a sweep that reaches one of its unsynced lines —
 * re-asserts the name, because names are app-owned. Until one does, the folder keeps the old date.
 */
export async function renamePerjadinFolder(person: Person, perjadinId: string): Promise<void> {
  try {
    const trip = await perjadinDriveFolder(person, perjadinId);
    if (!trip?.driveFolderId) return;

    const credentials = await driveCredentials(person);
    if (credentials?.status !== "connected") return;
    const token = await refreshDriveToken(person, credentials);
    if (token.outcome !== "ok") return;

    await openDrive(token.accessToken).updateFile(trip.driveFolderId, {
      name: perjadinFolderName(trip.destination, trip.startsOn),
    });
  } catch (error) {
    console.error(`Renaming the Drive folder of Perjadin ${perjadinId} failed.`, error);
  }
}
