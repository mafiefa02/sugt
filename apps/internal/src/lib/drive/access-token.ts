import {
  driveCredentials,
  markDriveConnectionBroken,
  touchDriveConnection,
  type DriveFolderIds,
  type Person,
} from "@sugt/db/queries";

import { refreshDriveAccessToken } from "./google";
import { decryptRefreshToken } from "./token-crypto";

export type DriveAccess =
  | { outcome: "ok"; accessToken: string; folders: DriveFolderIds }
  /** No connection, or a broken one. Catat transaksi and Unggah bukti show the reason. */
  | { outcome: "drive-disconnected" }
  /** Google could not be reached. The token may be fine; nothing is marked. */
  | { outcome: "drive-unreachable" };

/**
 * **An access token for a Staff member's Drive call** (ADR-0040). Decrypts the stored refresh token
 * and refreshes it on every call — no access-token cache, which the ticket allows and which a
 * serverless function would rarely hit anyway.
 *
 * The first `invalid_grant`, or a token that will not decrypt, **marks the connection broken** and
 * answers `drive-disconnected` — a returned outcome, never a thrown 500. A broken connection stays
 * broken until an Administrator reconnects; nothing here retries it.
 */
export async function driveAccessToken(person: Person): Promise<DriveAccess> {
  const credentials = await driveCredentials(person);
  if (!credentials || credentials.status === "broken") return { outcome: "drive-disconnected" };

  const refreshToken = decryptRefreshToken(credentials.refreshToken);
  if (refreshToken === null) {
    await markDriveConnectionBroken(person);
    return { outcome: "drive-disconnected" };
  }

  const refreshed = await refreshDriveAccessToken(refreshToken);
  if (!refreshed.ok) {
    if (refreshed.reason === "unreachable") return { outcome: "drive-unreachable" };
    await markDriveConnectionBroken(person);
    return { outcome: "drive-disconnected" };
  }

  await touchDriveConnection(person);
  return {
    outcome: "ok",
    accessToken: refreshed.accessToken,
    folders: {
      rootFolderId: credentials.rootFolderId,
      stagingFolderId: credentials.stagingFolderId,
      buktiTransaksiFolderId: credentials.buktiTransaksiFolderId,
      pelaksanaanOfflineFolderId: credentials.pelaksanaanOfflineFolderId,
      readmeFileId: credentials.readmeFileId,
    },
  };
}
