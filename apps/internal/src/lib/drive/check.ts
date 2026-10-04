import { driveCredentials, unsyncedTransactions, type Person } from "@sugt/db/queries";

import { refreshDriveToken } from "./access-token";
import { readyFolders, type ReadyFolders } from "./fixed-folders";
import { type DriveClient, isDriveFailure, openDrive } from "./google";
import { reconcileTransaction, type UnsyncedReason } from "./reconcile";

/**
 * **Periksa koneksi** (ADR-0040, #375): whether the company Drive connection works, whether its tree
 * is safe, and finishing what is still owed to it. An Administrator presses it on `/pengaturan`; the
 * reconnect callback runs the sweep half of it too.
 */

/** How many unsynced transactions one press reconciles — sized to fit a Vercel function's limit. */
export const SWEEP_LIMIT = 25;

export type SweepFailure = {
  transactionId: string;
  spentOn: string;
  description: string;
  reason: UnsyncedReason | "no-such-transaction";
};

export type SweepReport = { synced: number; waiting: number; failures: SweepFailure[] };

/**
 * **The sweep**: reconcile the unsynced transactions, oldest first, at most `limit`, one at a time.
 * A trashed folder is reported, never recreated (the reconcile's own rule). `waiting` is what is
 * still owed afterwards — the failures, and anything past the bound.
 */
export async function sweepUnsynced(
  person: Person,
  drive: DriveClient,
  folders: ReadyFolders,
  limit = SWEEP_LIMIT,
): Promise<SweepReport> {
  const owed = await unsyncedTransactions(person, limit);
  const failures: SweepFailure[] = [];
  let synced = 0;
  for (const line of owed.lines) {
    const result = await reconcileTransaction(person, drive, folders, line.id);
    if (result.outcome === "synced") synced += 1;
    else {
      failures.push({
        transactionId: line.id,
        spentOn: line.spentOn,
        description: line.description,
        reason: result.outcome === "unsynced" ? result.reason : result.outcome,
      });
    }
  }
  return { synced, waiting: owed.total - synced, failures };
}

/** One of the four fixed folders, as Periksa koneksi found it. */
export type FolderCheck = {
  folder: "root" | "staging" | "bukti-transaksi" | "pelaksanaan-offline";
  state: "ok" | "trashed" | "missing";
};

export type DriveCheckReport =
  /** No connection to check. */
  | { token: "not-connected" }
  /** Google refused the token, or it would not decrypt: the connection is now marked broken. */
  | { token: "broken" }
  /** Google could not be reached. Nothing was concluded or changed. */
  | { token: "unreachable" }
  | {
      token: "ok";
      folders: FolderCheck[];
      /** Which of the root and `_staging` an `anyone` permission reaches, inherited or direct. */
      exposed: ("root" | "staging")[];
      /** The sweep, or `null` when the tree is not usable and it was not run. */
      sweep: SweepReport | null;
    };

/**
 * Run Periksa koneksi, **in order**, stopping where there is nothing more to learn:
 *
 * 1. **Refresh the token.** `invalid_grant` marks the connection broken (`refreshDriveToken`) and
 *    stops. A successful refresh updates `last_used_at`.
 * 2. **`files.get` on the root, `_staging`, `Bukti Transaksi` and `Pelaksanaan Offline`**, each
 *    reported ok, trashed or missing.
 * 3. **The safety check**: `permissions.list` on the root and on `_staging`. An `anyone` permission
 *    on either — inherited or direct — means the folder has been moved under a link-shared folder, or
 *    shared by hand, and files nobody should see can be opened by link.
 * 4. **The sweep** (`sweepUnsynced`), only when the tree is usable.
 *
 * The caller has already checked the Administrator Grant.
 */
export async function checkDriveConnection(person: Person): Promise<DriveCheckReport> {
  const credentials = await driveCredentials(person);
  if (!credentials) return { token: "not-connected" };
  const token = await refreshDriveToken(person, credentials);
  if (token.outcome === "drive-unreachable") return { token: "unreachable" };
  if (token.outcome === "drive-disconnected") return { token: "broken" };

  const drive = openDrive(token.accessToken);
  const stored = token.credentials;
  try {
    const named = [
      ["root", stored.rootFolderId],
      ["staging", stored.stagingFolderId],
      ["bukti-transaksi", stored.buktiTransaksiFolderId],
      ["pelaksanaan-offline", stored.pelaksanaanOfflineFolderId],
    ] as const;
    const folders = await Promise.all(
      named.map(async ([folder, id]): Promise<FolderCheck> => {
        const file = id ? await drive.getFile(id) : null;
        return { folder, state: !file ? "missing" : file.trashed ? "trashed" : "ok" };
      }),
    );
    const isOk = (folder: FolderCheck["folder"]) =>
      folders.some((check) => check.folder === folder && check.state === "ok");

    const exposed: ("root" | "staging")[] = [];
    for (const [folder, id] of [
      ["root", stored.rootFolderId],
      ["staging", stored.stagingFolderId],
    ] as const) {
      if (!id || !isOk(folder)) continue;
      const permissions = await drive.listPermissions(id);
      if (permissions.some((permission) => permission.type === "anyone")) exposed.push(folder);
    }

    const ready = readyFolders(stored);
    const usable = ready && folders.every((check) => check.state === "ok");
    const sweep = usable ? await sweepUnsynced(person, drive, ready) : null;
    return { token: "ok", folders, exposed, sweep };
  } catch (error) {
    if (isDriveFailure(error)) return { token: "unreachable" };
    throw error;
  }
}
