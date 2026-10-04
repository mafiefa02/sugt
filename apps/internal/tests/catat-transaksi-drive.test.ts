import {
  openReceiptSessionsAction,
  recordTransactionAction,
} from "-/app/(app)/perjadin/[id]/laporan/actions";
import { FakeDrive } from "-/lib/drive/fake-drive";
import { ensureFixedFolders, readyFolders, type ReadyFolders } from "-/lib/drive/fixed-folders";
import { DriveRequestError, FOLDER_MIME_TYPE, openDrive } from "-/lib/drive/google";
import { reconcileTransaction } from "-/lib/drive/reconcile";
import { encryptRefreshToken } from "-/lib/drive/token-crypto";
import { requirePerson } from "-/lib/person";
import { db, schema } from "@sugt/db";
import type { Person } from "@sugt/db/queries";
import { MAX_RECEIPT_BYTES, MAX_RECEIPTS_PER_TRANSACTION } from "@sugt/domain";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addPerjadin, addPerson, resetDatabase } from "./support/fixtures";

/**
 * **Catat transaksi uploads its receipts to Google Drive** (#373, ADR-0040), against the real
 * database and the in-memory `FakeDrive`.
 *
 * Faked, each because no test can reach it: Google's token endpoint (stubbed at the network
 * boundary), Drive itself (`FakeDrive` swapped in for `openDrive`), the browser's `PUT` (the fake's
 * `land`, which keeps Drive's size enforcement), the signed-in Person, the request's `Origin`, and
 * `next/cache`. The checks, the names, the write order and the reconcile are the real code.
 */

vi.mock("-/lib/person", () => ({ requirePerson: vi.fn() }));
vi.mock("-/lib/drive/google", async (importOriginal) => ({
  ...(await importOriginal<typeof import("-/lib/drive/google")>()),
  openDrive: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ origin: "https://preview-42.sugt.test" })),
}));

const FORBIDDEN = "NEXT_HTTP_ERROR_FALLBACK;403";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

async function digestOf(call: Promise<unknown>) {
  const thrown = await call.then(
    () => null,
    (error: unknown) => error,
  );
  return (thrown as { digest?: string } | null)?.digest;
}

/** Google's token endpoint, answering every refresh with an access token. */
function stubTokenEndpoint() {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url !== TOKEN_ENDPOINT) throw new Error(`Unexpected outbound request: ${url}`);
    return Response.json({ access_token: "access" });
  });
}

/** Bytes that sniff as a JPEG, `size` long. */
function jpeg(size = 4096) {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  return bytes;
}
const pdf = (size = 2048) => {
  const bytes = new Uint8Array(size);
  bytes.set(new TextEncoder().encode("%PDF-1.7"));
  return bytes;
};

let drive: FakeDrive;
let folders: ReadyFolders;

/** A Staff PIC, a Pimpinan, a trip, and Drive connected with its fixed tree built in the fake. */
async function scene(options: { connection?: "connected" | "broken" | "none" } = {}) {
  const staff = await addPerson({ fullName: "Rina", email: "rina@itb.ac.id", role: "Staff" });
  const pimpinan = await addPerson({
    fullName: "Fatimah",
    email: "fa@itb.ac.id",
    role: "Pimpinan",
  });
  const trip = await addPerjadin({
    advanceIdr: 5_000_000,
    picPersonId: staff.id,
    destination: "Kelompok 18: Samarinda, Bontang dan Balikpapan",
    startsOn: "2026-10-12",
    endsOn: "2026-10-16",
  });

  const connection = options.connection ?? "connected";
  if (connection !== "none") {
    const ensured = await ensureFixedFolders(drive, {
      rootFolderId: null,
      stagingFolderId: null,
      buktiTransaksiFolderId: null,
      pelaksanaanOfflineFolderId: null,
      readmeFileId: null,
    });
    folders = readyFolders(ensured)!;
    const token = encryptRefreshToken("refresh");
    await db.insert(schema.driveConnection).values({
      accountEmail: "bukti@perusahaan.test",
      refreshTokenCiphertext: token.ciphertext,
      refreshTokenIv: token.iv,
      refreshTokenTag: token.tag,
      ...folders,
      status: connection,
      brokenAt: connection === "broken" ? new Date() : null,
      connectedByPersonId: staff.id,
    });
  }
  drive.calls = 0;
  vi.mocked(requirePerson).mockResolvedValue(staff);
  return { staff, pimpinan, trip };
}

/** The dialog's upload: open a session per file, then the browser's `PUT` to each. */
async function upload(perjadinId: string, files: Uint8Array[], contentType = "image/jpeg") {
  const opened = await openReceiptSessionsAction(
    perjadinId,
    files.map((bytes) => ({ size: bytes.length, contentType })),
  );
  if (opened.outcome !== "ready") throw new Error(`Sessions refused: ${opened.outcome}`);
  return opened.sessionUris.map((uri, index) => drive.land(uri, files[index]!).id);
}

function aLine(perjadinId: string, driveFileIds: string[]) {
  return {
    perjadinId,
    spentOn: "2026-10-13",
    description: "Taksi bandara",
    amountIdr: 150_000,
    category: "Transport Bandara/Stasiun" as const,
    participantType: "Siswa" as const,
    receipts: driveFileIds.map((driveFileId) => ({ driveFileId })),
  };
}

const lines = () => db.select().from(schema.transaction);
const evidenceRows = () => db.select().from(schema.transactionEvidence);

beforeEach(async () => {
  await resetDatabase();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.stubEnv("__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS", "1");
  drive = new FakeDrive();
  vi.mocked(openDrive).mockReturnValue(drive);
  stubTokenEndpoint();
});

describe("no Drive call before the guard", () => {
  it("refuses a non-Staff caller with zero Drive calls", async () => {
    const { pimpinan, trip } = await scene();
    vi.mocked(requirePerson).mockResolvedValue(pimpinan as Person);

    await expect(
      digestOf(openReceiptSessionsAction(trip.id, [{ size: 10, contentType: "image/jpeg" }])),
    ).resolves.toBe(FORBIDDEN);
    await expect(digestOf(recordTransactionAction(aLine(trip.id, ["x"])))).resolves.toBe(FORBIDDEN);

    expect(drive.calls).toBe(0);
    await expect(lines()).resolves.toHaveLength(0);
  });

  it.each(["none", "broken"] as const)(
    "answers drive-disconnected with zero Drive calls when the connection is %s",
    async (connection) => {
      const { trip } = await scene({ connection });

      await expect(
        openReceiptSessionsAction(trip.id, [{ size: 10, contentType: "image/jpeg" }]),
      ).resolves.toEqual({ outcome: "drive-disconnected" });
      await expect(recordTransactionAction(aLine(trip.id, ["x"]))).resolves.toEqual({
        outcome: "drive-disconnected",
      });

      expect(drive.calls).toBe(0);
      await expect(lines()).resolves.toHaveLength(0);
    },
  );

  it("refuses 0 and 6 files, an unknown type and an over-cap size, before Drive", async () => {
    const { trip } = await scene();
    const one = { size: 10, contentType: "image/jpeg" };

    await expect(openReceiptSessionsAction(trip.id, [])).resolves.toEqual({
      outcome: "evidence-missing",
    });
    await expect(
      openReceiptSessionsAction(trip.id, Array(MAX_RECEIPTS_PER_TRANSACTION + 1).fill(one)),
    ).resolves.toMatchObject({ outcome: "too-many-receipts" });
    await expect(
      openReceiptSessionsAction(trip.id, [{ size: 10, contentType: "image/heic" }]),
    ).resolves.toEqual({ outcome: "unsupported-type" });
    await expect(
      openReceiptSessionsAction(trip.id, [
        { size: MAX_RECEIPT_BYTES + 1, contentType: "image/jpeg" },
      ]),
    ).resolves.toEqual({ outcome: "too-large", limit: MAX_RECEIPT_BYTES });
    await expect(recordTransactionAction(aLine(trip.id, []))).resolves.toEqual({
      outcome: "evidence-missing",
    });
    await expect(
      recordTransactionAction(aLine(trip.id, ["1", "2", "3", "4", "5", "6"])),
    ).resolves.toMatchObject({ outcome: "too-many-receipts" });

    expect(drive.calls).toBe(0);
  });
});

describe("opening upload sessions", () => {
  it("opens one in _staging per file, named {uuid}.{ext}, with the declared size and the page's Origin", async () => {
    const { trip } = await scene();

    const opened = await openReceiptSessionsAction(trip.id, [
      { size: 4096, contentType: "image/jpeg" },
      { size: 2048, contentType: "application/pdf" },
    ]);

    expect(opened.outcome).toBe("ready");
    const sessions = [...drive.sessions.values()];
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({
      parentId: folders.stagingFolderId,
      size: 4096,
      origin: "https://preview-42.sugt.test",
      appProperties: { sugtPerjadinId: trip.id },
    });
    expect(sessions[0]!.name).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(sessions[1]!.name).toMatch(/\.pdf$/);
  });
});

describe("recording a line with its Drive receipts", () => {
  it.each([1, 5])(
    "records %i receipts: rows written, folder moved out, shared, synced",
    async (count) => {
      const { trip } = await scene();
      const files = Array.from({ length: count }, (_, i) => (i % 2 ? pdf() : jpeg()));
      const ids = await Promise.all(
        files.map((bytes) => upload(trip.id, [bytes]).then(([id]) => id!)),
      );

      const result = await recordTransactionAction(aLine(trip.id, ids));

      expect(result).toMatchObject({ outcome: "recorded", synced: true });
      const [line] = await lines();
      expect(line!.driveSyncedAt).toBeInstanceOf(Date);
      const evidence = await evidenceRows();
      expect(evidence).toHaveLength(count);
      for (const row of evidence) {
        expect(row.storagePath).toBeNull();
        expect(ids).toContain(row.driveFileId);
        // From the sniff and from Drive, never from the browser.
        const sent = files[ids.indexOf(row.driveFileId!)]!;
        expect(row.contentType).toBe(sent[0] === 0xff ? "image/jpeg" : "application/pdf");
        expect(row.byteSize).toBe(sent.length);
      }

      // The tree: Pelaksanaan Offline / Perjadin folder / transaction folder / receipts.
      const [trip_] = await db
        .select()
        .from(schema.perjadin)
        .where(eq(schema.perjadin.id, trip.id));
      const perjadinFolder = (await drive.getFile(trip_!.driveFolderId!))!;
      expect(perjadinFolder.name).toBe(
        "Kelompok 18 · Samarinda, Bontang dan Balikpapan · 2026-10-12",
      );
      expect(perjadinFolder.parents).toEqual([folders.pelaksanaanOfflineFolderId]);

      const folder = (await drive.getFile(line!.driveFolderId!))!;
      expect(folder.mimeType).toBe(FOLDER_MIME_TYPE);
      expect(folder.parents).toEqual([perjadinFolder.id]);
      expect(folder.name).toBe(
        `2026-10-13 · Transport Bandara-Stasiun · T-${line!.id.slice(0, 8)}`,
      );
      expect(folder.appProperties).toEqual({
        sugtPerjadinId: trip.id,
        sugtTransactionId: line!.id,
      });

      for (const row of evidence) {
        const file = (await drive.getFile(row.driveFileId!))!;
        expect(file.parents).toEqual([folder.id]);
        const ext = row.contentType === "image/jpeg" ? "jpg" : "pdf";
        expect(file.name).toBe(`${folder.name} · ${row.id.slice(0, 8)}.${ext}`);
        expect(file.appProperties.sugtTransactionId).toBe(line!.id);
      }

      // Only the transaction folder is shared; the Perjadin folder and _staging stay private.
      await expect(drive.listPermissions(folder.id)).resolves.toEqual([
        expect.objectContaining({ type: "anyone", role: "reader", inherited: false }),
      ]);
      await expect(drive.listPermissions(perjadinFolder.id)).resolves.toEqual([]);
      await expect(drive.listPermissions(folders.stagingFolderId)).resolves.toEqual([]);
    },
  );

  it("puts a second line in the same Perjadin folder", async () => {
    const { trip } = await scene();
    await recordTransactionAction(aLine(trip.id, await upload(trip.id, [jpeg()])));
    await recordTransactionAction(aLine(trip.id, await upload(trip.id, [jpeg()])));

    const [first, second] = await lines();
    const [a, b] = await Promise.all([
      drive.getFile(first!.driveFolderId!),
      drive.getFile(second!.driveFolderId!),
    ]);
    expect(a!.parents).toEqual(b!.parents);
    expect(
      drive.named("Kelompok 18 · Samarinda, Bontang dan Balikpapan · 2026-10-12"),
    ).toHaveLength(1);
  });
});

describe("a receipt that is not what it claims records nothing", () => {
  it("refuses another Perjadin's file", async () => {
    const { trip, staff } = await scene();
    const other = await addPerjadin({ advanceIdr: 1_000_000, picPersonId: staff.id });
    const [theirs] = await upload(other.id, [jpeg()]);

    await expect(recordTransactionAction(aLine(trip.id, [theirs!]))).resolves.toEqual({
      outcome: "receipt-unverified",
      failed: 1,
    });
    await expect(lines()).resolves.toHaveLength(0);
  });

  it("refuses wrong first bytes", async () => {
    const { trip } = await scene();
    const [id] = await upload(trip.id, [new TextEncoder().encode("MZ not a receipt at all")]);

    await expect(recordTransactionAction(aLine(trip.id, [id!]))).resolves.toEqual({
      outcome: "unsupported-type",
    });
    await expect(lines()).resolves.toHaveLength(0);
  });

  it("refuses a file over the cap as Drive holds it", async () => {
    const { trip } = await scene();
    const [id] = await upload(trip.id, [jpeg()]);
    drive.files.get(id!)!.size = MAX_RECEIPT_BYTES + 1;

    await expect(recordTransactionAction(aLine(trip.id, [id!]))).resolves.toMatchObject({
      outcome: "receipt-unverified",
    });
    await expect(lines()).resolves.toHaveLength(0);
  });

  it("refuses a file no longer in _staging, a trashed one, and the same file twice", async () => {
    const { trip } = await scene();
    const [moved, trashed, twice] = await upload(trip.id, [jpeg(), jpeg(), jpeg()]);
    await drive.updateFile(moved!, {
      addParent: folders.rootFolderId,
      removeParent: folders.stagingFolderId,
    });
    drive.trash(trashed!);

    for (const ids of [[moved!], [trashed!], [twice!, twice!]]) {
      await expect(recordTransactionAction(aLine(trip.id, ids))).resolves.toMatchObject({
        outcome: "receipt-unverified",
      });
    }
    await expect(lines()).resolves.toHaveLength(0);
    await expect(evidenceRows()).resolves.toHaveLength(0);
  });

  it("refuses an upload Drive held to its declared size", async () => {
    const { trip } = await scene();
    const opened = await openReceiptSessionsAction(trip.id, [
      { size: 100, contentType: "image/jpeg" },
    ]);
    if (opened.outcome !== "ready") throw new Error(opened.outcome);

    expect(() => drive.land(opened.sessionUris[0]!, jpeg(101))).toThrow(DriveRequestError);
  });
});

describe("after the commit", () => {
  it("keeps the line when sharing fails, and a second reconcile finishes it", async () => {
    const { staff, trip } = await scene();
    const ids = await upload(trip.id, [jpeg()]);
    vi.spyOn(drive, "createPermission").mockRejectedValueOnce(
      new DriveRequestError("permissions.create", 500),
    );

    await expect(recordTransactionAction(aLine(trip.id, ids))).resolves.toMatchObject({
      outcome: "recorded",
      synced: false,
    });
    const [line] = await lines();
    expect(line!.driveSyncedAt).toBeNull();
    await expect(evidenceRows()).resolves.toHaveLength(1);

    await expect(reconcileTransaction(staff, drive, folders, line!.id)).resolves.toEqual({
      outcome: "synced",
    });
    const [after] = await lines();
    expect(after!.driveSyncedAt).toBeInstanceOf(Date);
    await expect(drive.listPermissions(after!.driveFolderId!)).resolves.toHaveLength(1);
  });

  it("never recreates a trashed transaction folder", async () => {
    const { staff, trip } = await scene();
    await recordTransactionAction(aLine(trip.id, await upload(trip.id, [jpeg()])));
    const [line] = await lines();
    drive.trash(line!.driveFolderId!);
    await db.update(schema.transaction).set({ driveSyncedAt: null });
    const before = drive.files.size;

    await expect(reconcileTransaction(staff, drive, folders, line!.id)).resolves.toEqual({
      outcome: "unsynced",
      reason: "folder-trashed",
    });
    expect(drive.files.size).toBe(before);
    const [after] = await lines();
    expect(after!.driveSyncedAt).toBeNull();
  });

  it("leaves one Perjadin folder when two first transactions race, trashing the other", async () => {
    const { trip } = await scene();
    const [a, b] = await Promise.all([upload(trip.id, [jpeg()]), upload(trip.id, [jpeg()])]);

    const results = await Promise.all([
      recordTransactionAction(aLine(trip.id, a)),
      recordTransactionAction(aLine(trip.id, b)),
    ]);

    expect(results.map((result) => result.outcome)).toEqual(["recorded", "recorded"]);
    const made = drive.named("Kelompok 18 · Samarinda, Bontang dan Balikpapan · 2026-10-12");
    // Both reconciles found no folder and made one; the compare-and-set kept exactly one.
    expect(made).toHaveLength(2);
    const live = made.filter((folder) => !folder.trashed);
    expect(live).toHaveLength(1);
    const [stored] = await db.select().from(schema.perjadin).where(eq(schema.perjadin.id, trip.id));
    expect(stored!.driveFolderId).toBe(live[0]!.id);
    for (const line of await lines()) {
      await expect(drive.getFile(line.driveFolderId!)).resolves.toMatchObject({
        parents: [live[0]!.id],
      });
    }
  });
});
