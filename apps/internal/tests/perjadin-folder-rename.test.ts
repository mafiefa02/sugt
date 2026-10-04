import { updatePerjadinLogisticsAction } from "-/app/(app)/perjadin/[id]/actions";
import { FakeDrive } from "-/lib/drive/fake-drive";
import type { ReadyFolders } from "-/lib/drive/fixed-folders";
import { DriveRequestError, openDrive } from "-/lib/drive/google";
import { reconcileTransaction } from "-/lib/drive/reconcile";
import { requirePerson } from "-/lib/person";
import { db, schema } from "@sugt/db";
import type { PerjadinLogisticsInput } from "@sugt/db/queries";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { connectDrive, jpeg, upload } from "./support/drive";
import {
  addCluster,
  addOfflineSession,
  addPerjadin,
  addPerson,
  addProvince,
  addSchool,
  addTransaction,
  resetDatabase,
} from "./support/fixtures";

/**
 * **A start-date correction renames the Perjadin's Drive folder** (#376, ADR-0040) — after the
 * commit, best effort — and the reconcile repairs a rename that did not happen. Against the real
 * database and the in-memory `FakeDrive`; Google's token endpoint is stubbed at the network boundary
 * and counted, so "no call to Google" is something a test can see.
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

let drive: FakeDrive;
let folders: ReadyFolders;
let tokenCalls: number;

function logistics(departureDate: string, returnDate: string): PerjadinLogisticsInput {
  return {
    departureDate,
    departureTime: "07:30",
    departureMode: "Pesawat",
    returnDate,
    returnTime: "18:00",
    returnMode: "Pesawat",
    returnZone: "WIB",
  };
}

/**
 * A Staff PIC and a trip `Kelompok 3: Garut` from the 12th to the 16th — with Drive connected and the
 * trip's folder made, unless told otherwise.
 */
async function scene(options: { connected?: boolean; folder?: boolean } = {}) {
  const pic = await addPerson({ fullName: "Rina", email: "rina@itb.ac.id", role: "Staff" });
  const trip = await addPerjadin({
    advanceIdr: 5_000_000,
    picPersonId: pic.id,
    destination: "Kelompok 3: Garut",
    startsOn: "2026-10-12",
    endsOn: "2026-10-16",
  });
  if (options.connected ?? true) folders = await connectDrive(drive, pic.id);
  let folderId: string | null = null;
  if (options.folder ?? true) {
    folderId = (
      await drive.createFolder({
        name: "Kelompok 3 · Garut · 2026-10-12",
        parentId: folders?.pelaksanaanOfflineFolderId,
      })
    ).id;
    await db
      .update(schema.perjadin)
      .set({ driveFolderId: folderId })
      .where(eq(schema.perjadin.id, trip.id));
  }
  drive.calls = 0;
  tokenCalls = 0;
  vi.mocked(requirePerson).mockResolvedValue(pic);
  return { pic, trip, folderId };
}

const startsOnOf = async (id: string) =>
  (await db.select().from(schema.perjadin).where(eq(schema.perjadin.id, id)))[0]!.startsOn;

beforeEach(async () => {
  await resetDatabase();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  drive = new FakeDrive();
  vi.mocked(openDrive).mockReturnValue(drive);
  vi.stubGlobal("fetch", async () => {
    tokenCalls += 1;
    return Response.json({ access_token: "access" });
  });
});

describe("a start-date correction", () => {
  it("renames the Perjadin's Drive folder", async () => {
    const { trip, folderId } = await scene();

    await expect(
      updatePerjadinLogisticsAction(trip.id, logistics("2026-10-13", "2026-10-16")),
    ).resolves.toEqual({ outcome: "updated", startsOnMoved: true });

    await expect(drive.getFile(folderId!)).resolves.toMatchObject({
      name: "Kelompok 3 · Garut · 2026-10-13",
    });
  });

  it("makes no Drive call when the start date does not move", async () => {
    const { trip } = await scene();

    await expect(
      updatePerjadinLogisticsAction(trip.id, logistics("2026-10-12", "2026-10-15")),
    ).resolves.toEqual({ outcome: "updated", startsOnMoved: false });

    expect(drive.calls).toBe(0);
    expect(tokenCalls).toBe(0);
  });

  it.each([
    ["no Drive folder yet", { folder: false }],
    ["no connection", { connected: false, folder: true }],
  ] as const)("does nothing with %s, and the correction still succeeds", async (_, options) => {
    const { trip } = await scene(options);

    await expect(
      updatePerjadinLogisticsAction(trip.id, logistics("2026-10-13", "2026-10-16")),
    ).resolves.toMatchObject({ outcome: "updated" });

    expect(drive.calls).toBe(0);
    expect(tokenCalls).toBe(0);
    await expect(startsOnOf(trip.id)).resolves.toBe("2026-10-13");
  });

  it("keeps the correction when the rename fails", async () => {
    const { trip } = await scene();
    vi.spyOn(drive, "updateFile").mockRejectedValue(new DriveRequestError("files.update", 503));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      updatePerjadinLogisticsAction(trip.id, logistics("2026-10-13", "2026-10-16")),
    ).resolves.toEqual({ outcome: "updated", startsOnMoved: true });

    await expect(startsOnOf(trip.id)).resolves.toBe("2026-10-13");
  });

  it("makes no Drive call when the correction is refused", async () => {
    const { trip } = await scene();
    await addProvince("JB", "Jawa Barat");
    const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
    const school = await addSchool({
      slug: "sman-1-garut",
      name: "SMAN 1 Garut",
      clusterId: cluster.id,
      provinceCode: "JB",
    });
    await addOfflineSession({ schoolId: school.id, heldOn: "2026-10-12", perjadinId: trip.id });

    await expect(
      updatePerjadinLogisticsAction(trip.id, logistics("2026-10-13", "2026-10-16")),
    ).resolves.toMatchObject({ outcome: "would-strand" });

    expect(drive.calls).toBe(0);
    expect(tokenCalls).toBe(0);
    await expect(startsOnOf(trip.id)).resolves.toBe("2026-10-12");
  });
});

describe("the reconcile", () => {
  it("re-asserts a stale Perjadin folder name", async () => {
    const { pic, trip, folderId } = await scene();
    await db
      .update(schema.perjadin)
      .set({ startsOn: "2026-10-13" })
      .where(eq(schema.perjadin.id, trip.id));
    const line = await addTransaction({
      perjadinId: trip.id,
      amountIdr: 10_000,
      createdByPersonId: pic.id,
    });
    const [fileId] = await upload(drive, trip.id, [jpeg()]);
    await db.insert(schema.transactionEvidence).values({
      transactionId: line.id,
      driveFileId: fileId!,
      contentType: "image/jpeg",
      byteSize: 4096,
      uploadedByPersonId: pic.id,
    });

    await expect(reconcileTransaction(pic, drive, folders, line.id)).resolves.toEqual({
      outcome: "synced",
    });

    await expect(drive.getFile(folderId!)).resolves.toMatchObject({
      name: "Kelompok 3 · Garut · 2026-10-13",
    });
  });
});
