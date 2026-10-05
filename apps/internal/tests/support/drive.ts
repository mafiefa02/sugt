import { openReceiptSessionsAction } from "-/app/(app)/perjadin/[id]/laporan/actions";
import type { FakeDrive } from "-/lib/drive/fake-drive";
import { ensureFixedFolders, readyFolders, type ReadyFolders } from "-/lib/drive/fixed-folders";
import { encryptRefreshToken } from "-/lib/drive/token-crypto";
import { db, schema } from "@sugt/db";
import { vi } from "vitest";

/**
 * **What a receipt test needs of Google Drive** (ADR-0040): the token endpoint, a connected Drive
 * with its fixed tree, receipt bytes, and the browser's upload. Shared by the Catat transaksi and
 * Unggah bukti tests, which each mock `openDrive` to hand back their own `FakeDrive` — a `vi.mock`
 * has to sit in the test file, so it is not here.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** Google's token endpoint, answering every refresh with an access token. Anything else throws. */
export function stubTokenEndpoint() {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url !== TOKEN_ENDPOINT) throw new Error(`Unexpected outbound request: ${url}`);
    return Response.json({ access_token: "access" });
  });
}

/** Bytes that sniff as a JPEG, `size` long. */
export function jpeg(size = 4096) {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  return bytes;
}

/** Bytes that sniff as a PDF, `size` long. */
export function pdf(size = 2048) {
  const bytes = new Uint8Array(size);
  bytes.set(new TextEncoder().encode("%PDF-1.7"));
  return bytes;
}

/**
 * The company Drive connection, with its fixed tree built in `drive` and a token that decrypts —
 * `connected` by default, or `broken`. Answers the tree's ids. `Dokumen/` and its `Pelaksanaan
 * Offline/` (ADR-0042) are built too, as a connect now builds them, unless `dokumen` is false — a
 * connection made before them.
 */
export async function connectDrive(
  drive: FakeDrive,
  connectedByPersonId: string,
  status: "connected" | "broken" = "connected",
  { dokumen = true }: { dokumen?: boolean } = {},
): Promise<ReadyFolders> {
  const ensured = await ensureFixedFolders(drive, {
    rootFolderId: null,
    stagingFolderId: null,
    buktiTransaksiFolderId: null,
    pelaksanaanOfflineFolderId: null,
    readmeFileId: null,
  });
  const folders = readyFolders(ensured)!;
  const dokumenFolderId = dokumen
    ? (await drive.createFolder({ name: "Dokumen", parentId: folders.rootFolderId })).id
    : null;
  const dokumenPelaksanaanOfflineFolderId = dokumenFolderId
    ? (await drive.createFolder({ name: "Pelaksanaan Offline", parentId: dokumenFolderId })).id
    : null;
  const token = encryptRefreshToken("refresh");
  await db.insert(schema.driveConnection).values({
    accountEmail: "bukti@perusahaan.test",
    refreshTokenCiphertext: token.ciphertext,
    refreshTokenIv: token.iv,
    refreshTokenTag: token.tag,
    ...folders,
    dokumenFolderId,
    dokumenPelaksanaanOfflineFolderId,
    status,
    brokenAt: status === "broken" ? new Date() : null,
    connectedByPersonId,
  });
  return folders;
}

/**
 * A receipt control's upload, as the browser does it: open a session per file — for a row's line
 * when `transactionId` is given — then `PUT` each file's bytes (`FakeDrive.land`). Answers the ids.
 */
export async function upload(
  drive: FakeDrive,
  perjadinId: string,
  files: Uint8Array[],
  options: { contentType?: string; transactionId?: string } = {},
): Promise<string[]> {
  const opened = await openReceiptSessionsAction(
    perjadinId,
    files.map((bytes) => ({
      size: bytes.length,
      contentType: options.contentType ?? "image/jpeg",
    })),
    options.transactionId,
  );
  if (opened.outcome !== "ready") throw new Error(`Sessions refused: ${opened.outcome}`);
  return opened.sessionUris.map((uri, index) => drive.land(uri, files[index]!).id);
}

/** The digest a refused Server Action threw — `NEXT_HTTP_ERROR_FALLBACK;403` for `forbidden()`. */
export async function digestOf(call: Promise<unknown>) {
  const thrown = await call.then(
    () => null,
    (error: unknown) => error,
  );
  return (thrown as { digest?: string } | null)?.digest;
}

export const FORBIDDEN = "NEXT_HTTP_ERROR_FALLBACK;403";
