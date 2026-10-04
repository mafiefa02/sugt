import { perjadinDriveFolder, type Person } from "@sugt/db/queries";

import { driveAccessToken } from "./access-token";
import { openDrive } from "./google";
import { perjadinFolderName } from "./receipt-files";

/**
 * **Rename a Perjadin's Drive folder after its start date was corrected** (#376, ADR-0040), so the
 * company Drive never shows a stale `{destination} · {starts_on}`.
 *
 * **Best effort, after the commit.** The correction has already been written; nothing here can fail
 * it or roll it back. A trip with no Drive folder yet, or a connection that cannot be used, makes no
 * call to Google at all. A rename that fails is logged and left: the next reconcile on that Perjadin
 * — Catat transaksi, Unggah bukti, or Periksa koneksi's sweep — re-asserts the name, because names
 * are app-owned.
 */
export async function renamePerjadinFolder(person: Person, perjadinId: string): Promise<void> {
  try {
    const trip = await perjadinDriveFolder(person, perjadinId);
    if (!trip?.driveFolderId) return;

    const access = await driveAccessToken(person);
    if (access.outcome !== "ok") return;

    await openDrive(access.accessToken).updateFile(trip.driveFolderId, {
      name: perjadinFolderName(trip.destination, trip.startsOn),
    });
  } catch (error) {
    console.error(`Renaming the Drive folder of Perjadin ${perjadinId} failed.`, error);
  }
}
