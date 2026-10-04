import {
  driveCredentials,
  markDriveConnectionBroken,
  touchDriveConnection,
  type Person,
} from "@sugt/db/queries";

import { readyFolders, type ReadyFolders } from "./fixed-folders";
import { refreshDriveAccessToken } from "./google";
import { decryptRefreshToken } from "./token-crypto";

export type DriveAccess =
  | { outcome: "ok"; accessToken: string; folders: ReadyFolders }
  /** No connection, or a broken one. Catat transaksi and Unggah bukti show the reason. */
  | { outcome: "drive-disconnected" }
  /**
   * The token is stored but the fixed tree is not usable — the root or `_staging` is trashed or
   * gone, or the last connect did not finish. An Administrator fixes it on `/pengaturan`.
   */
  | { outcome: "drive-folders-unresolved" }
  /** Google could not be reached. The token may be fine; nothing is marked. */
  | { outcome: "drive-unreachable" };

/**
 * **An access token for a Staff member's Drive call** (ADR-0040). Decrypts the stored refresh token
 * and refreshes it on every call — no access-token cache, which the ticket allows and which a
 * serverless function would rarely hit anyway.
 *
 * The first `invalid_grant`, or a token that will not decrypt, **marks the connection broken** and
 * answers `drive-disconnected` — a returned outcome, never a thrown 500. A broken connection stays
 * broken until an Administrator reconnects; nothing here retries it. A tree that is not usable
 * answers before Google is asked anything, so no upload is ever pointed at a trashed `_staging`.
 */
export async function driveAccessToken(person: Person): Promise<DriveAccess> {
  const credentials = await driveCredentials(person);
  if (!credentials || credentials.status === "broken") return { outcome: "drive-disconnected" };

  const folders = readyFolders(credentials);
  if (!folders) return { outcome: "drive-folders-unresolved" };

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
  return { outcome: "ok", accessToken: refreshed.accessToken, folders };
}
