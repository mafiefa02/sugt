import { FakeDrive } from "-/lib/drive/fake-drive";
import type { ReadyFolders } from "-/lib/drive/fixed-folders";
import { DriveRequestError, openDrive } from "-/lib/drive/google";
import {
  migrateLegacyReceipts,
  verifyMigration,
  type MigrationDeps,
} from "-/lib/drive/migrate-receipts";
import { requirePerson } from "-/lib/person";
import { db, schema } from "@sugt/db";
import type { Person } from "@sugt/db/queries";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { reencodeImage } from "../scripts/reencode-image";
import { connectDrive, jpeg, pdf, stubTokenEndpoint, upload } from "./support/drive";
import {
  addGrant,
  addPerjadin,
  addPerson,
  addTransaction,
  addTransactionEvidence,
  resetDatabase,
} from "./support/fixtures";

/**
 * **Moving the legacy receipts into Drive** (#377, ADR-0040): `migrateLegacyReceipts` and
 * `verifyMigration`, the logic of `drive:migrate-receipts`, against the real database and the
 * in-memory `FakeDrive`. The Supabase download is a map of fake objects, and the report is collected
 * in memory; the re-encode is the script's own `sharp` call, so what it does to a photograph is real.
 */

vi.mock("-/lib/drive/google", async (importOriginal) => ({
  ...(await importOriginal<typeof import("-/lib/drive/google")>()),
  openDrive: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ origin: "https://preview-42.sugt.test" })),
}));
vi.mock("-/lib/person", () => ({ requirePerson: vi.fn() }));

let drive: FakeDrive;
let folders: ReadyFolders;
/** The fake `receipts` bucket: object key → bytes. */
let bucket: Map<string, Uint8Array>;
let reportLines: { evidenceId: string; storagePath: string; driveFileId: string }[];

/** A photograph with EXIF — a camera make and a GPS position — as a phone would send it. */
async function phonePhoto(width = 3000, height = 2000) {
  return new Uint8Array(
    await sharp({ create: { width, height, channels: 3, background: "#d0d0d0" } })
      .jpeg()
      .withExif({ IFD0: { Make: "Camera" }, IFD3: { GPSLatitudeRef: "S" } })
      .toBuffer(),
  );
}

async function scene() {
  const admin = await addPerson({ fullName: "Admin", email: "admin@itb.ac.id", role: "Staff" });
  await addGrant(admin.id, "Administrator");
  const person = { ...admin, grants: ["Administrator"] } as Person;
  const trip = await addPerjadin({
    advanceIdr: 5_000_000,
    picPersonId: admin.id,
    destination: "Kelompok 3: Garut",
    startsOn: "2026-10-12",
    endsOn: "2026-10-14",
  });
  const line = await addTransaction({
    perjadinId: trip.id,
    amountIdr: 10_000,
    category: "Konsumsi",
    spentOn: "2026-10-12",
    createdByPersonId: admin.id,
  });
  folders = await connectDrive(drive, admin.id);
  vi.mocked(requirePerson).mockResolvedValue(person);
  return { person, trip, line };
}

/** A legacy receipt on `transactionId`, its object in the fake bucket holding `bytes`. */
async function aLegacyReceipt(
  transactionId: string,
  uploadedByPersonId: string,
  bytes: Uint8Array,
) {
  const row = await addTransactionEvidence({ transactionId, uploadedByPersonId });
  bucket.set(row.storagePath!, bytes);
  return row;
}

function deps(person: Person): MigrationDeps {
  return {
    person,
    drive,
    folders,
    download: async (path) => bucket.get(path) ?? null,
    reencodeImage,
    appendReport: async (line) => {
      reportLines.push(line);
    },
  };
}

const evidenceRow = async (id: string) =>
  (
    await db.select().from(schema.transactionEvidence).where(eq(schema.transactionEvidence.id, id))
  )[0]!;

beforeEach(async () => {
  await resetDatabase();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  drive = new FakeDrive();
  vi.mocked(openDrive).mockReturnValue(drive);
  stubTokenEndpoint();
  bucket = new Map();
  reportLines = [];
});

describe("migrating a legacy receipt", () => {
  it("moves a JPEG into its shared transaction folder, re-encoded, with a report line", async () => {
    const { person, line } = await scene();
    const legacy = await aLegacyReceipt(line.id, person.id, await phonePhoto());

    const report = await migrateLegacyReceipts(deps(person));

    expect(report).toMatchObject({
      migrated: [{ evidenceId: legacy.id }],
      skipped: [],
      unsynced: [],
    });
    const row = await evidenceRow(legacy.id);
    expect(row).toMatchObject({ storagePath: null, contentType: "image/jpeg" });
    expect(reportLines).toEqual([
      { evidenceId: legacy.id, storagePath: legacy.storagePath, driveFileId: row.driveFileId },
    ]);

    const [after] = await db
      .select()
      .from(schema.transaction)
      .where(eq(schema.transaction.id, line.id));
    expect(after!.driveSyncedAt).toBeInstanceOf(Date);
    const file = (await drive.getFile(row.driveFileId!))!;
    expect(file.parents).toEqual([after!.driveFolderId]);
    expect(file.name).toBe(
      `2026-10-12 · Konsumsi · T-${line.id.slice(0, 8)} · ${legacy.id.slice(0, 8)}.jpg`,
    );
    await expect(drive.listPermissions(after!.driveFolderId!)).resolves.toEqual([
      expect.objectContaining({ type: "anyone", role: "reader" }),
    ]);

    // Re-encoded the way the browser does: long edge 2400, and the EXIF — GPS included — gone.
    const sent = await sharp(drive.files.get(row.driveFileId!)!.content).metadata();
    expect([sent.width, sent.height, sent.format, sent.exif]).toEqual([
      2400,
      1600,
      "jpeg",
      undefined,
    ]);
    expect(row.byteSize).toBe(file.size);
  });

  it("keeps a PDF as it is", async () => {
    const { person, line } = await scene();
    const bytes = pdf(3000);
    const legacy = await aLegacyReceipt(line.id, person.id, bytes);

    await migrateLegacyReceipts(deps(person));

    const row = await evidenceRow(legacy.id);
    expect(row).toMatchObject({ contentType: "application/pdf", byteSize: 3000 });
    expect(drive.files.get(row.driveFileId!)!.content).toEqual(bytes);
  });

  it("skips what a second run finds already migrated", async () => {
    const { person, line } = await scene();
    await aLegacyReceipt(line.id, person.id, await phonePhoto(400, 300));
    await migrateLegacyReceipts(deps(person));
    const uploadsBefore = drive.files.size;

    const second = await migrateLegacyReceipts(deps(person));

    expect(second).toEqual({ migrated: [], skipped: [], unsynced: [], failed: [] });
    expect(drive.files.size).toBe(uploadsBefore);
    expect(reportLines).toHaveLength(1);
  });

  it("skips and lists an unsupported type, and --replace migrates it", async () => {
    const { person, line } = await scene();
    const heic = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode("ftypheic")]);
    const legacy = await aLegacyReceipt(line.id, person.id, heic);

    const first = await migrateLegacyReceipts(deps(person));

    expect(first.skipped).toEqual([
      { evidenceId: legacy.id, storagePath: legacy.storagePath, reason: "unsupported-type" },
    ]);
    expect((await evidenceRow(legacy.id)).storagePath).toBe(legacy.storagePath);

    const replaced = await migrateLegacyReceipts(deps(person), {
      replacements: new Map([[legacy.id, await phonePhoto(800, 600)]]),
    });

    expect(replaced.migrated).toHaveLength(1);
    expect(await evidenceRow(legacy.id)).toMatchObject({
      storagePath: null,
      contentType: "image/jpeg",
    });
  });

  it("writes nothing on a dry run", async () => {
    const { person, line } = await scene();
    const legacy = await aLegacyReceipt(line.id, person.id, await phonePhoto(400, 300));
    drive.calls = 0;

    const report = await migrateLegacyReceipts(deps(person), { dryRun: true });

    expect(report.migrated).toMatchObject([{ evidenceId: legacy.id, contentType: "image/jpeg" }]);
    expect(drive.calls).toBe(0);
    expect(reportLines).toEqual([]);
    expect((await evidenceRow(legacy.id)).storagePath).toBe(legacy.storagePath);
  });

  it("puts a line's legacy and Drive receipts in one folder", async () => {
    const { person, trip, line } = await scene();
    const legacy = await aLegacyReceipt(line.id, person.id, await phonePhoto(400, 300));
    const [driveFileId] = await upload(drive, trip.id, [jpeg()], { transactionId: line.id });
    await db.insert(schema.transactionEvidence).values({
      transactionId: line.id,
      driveFileId: driveFileId!,
      contentType: "image/jpeg",
      byteSize: 4096,
      uploadedByPersonId: person.id,
    });

    await migrateLegacyReceipts(deps(person));

    const [after] = await db
      .select()
      .from(schema.transaction)
      .where(eq(schema.transaction.id, line.id));
    const migrated = await evidenceRow(legacy.id);
    for (const id of [migrated.driveFileId!, driveFileId!]) {
      await expect(drive.getFile(id)).resolves.toMatchObject({ parents: [after!.driveFolderId] });
    }
  });

  it("skips an image that will not decode, and carries on with the rest", async () => {
    const { person, line } = await scene();
    const broken = await aLegacyReceipt(line.id, person.id, jpeg());
    const good = await aLegacyReceipt(line.id, person.id, await phonePhoto(400, 300));

    const report = await migrateLegacyReceipts(deps(person));

    expect(report.skipped).toEqual([
      { evidenceId: broken.id, storagePath: broken.storagePath, reason: "unreadable" },
    ]);
    expect(report.migrated).toMatchObject([{ evidenceId: good.id }]);
  });
});

describe("--verify", () => {
  /** The bucket as `--verify` reads it, against the report collected so far. */
  const bucketAgainstReport = () => ({
    keys: [...bucket.keys()],
    reportedKeys: reportLines.map((line) => line.storagePath),
  });

  it("fails while a row still holds a storage_path, and passes once all are moved", async () => {
    const { person, line } = await scene();
    await aLegacyReceipt(line.id, person.id, await phonePhoto(400, 300));

    await expect(verifyMigration(deps(person))).resolves.toEqual([
      { problem: "legacy-remaining", count: 1 },
    ]);

    await migrateLegacyReceipts(deps(person));

    await expect(verifyMigration(deps(person), bucketAgainstReport())).resolves.toEqual([]);
  });

  it("passes with a report line written twice by an interrupted run", async () => {
    const { person, line } = await scene();
    await aLegacyReceipt(line.id, person.id, await phonePhoto(400, 300));
    await migrateLegacyReceipts(deps(person));
    reportLines.push({ ...reportLines[0]!, driveFileId: "an-orphan-in-staging" });

    await expect(verifyMigration(deps(person), bucketAgainstReport())).resolves.toEqual([]);
  });

  it("names a misplaced file, an unshared folder, and an object the report does not account for", async () => {
    const { person, line } = await scene();
    const legacy = await aLegacyReceipt(line.id, person.id, await phonePhoto(400, 300));
    await migrateLegacyReceipts(deps(person));
    bucket.set("never-migrated", jpeg());
    const row = await evidenceRow(legacy.id);
    const [after] = await db
      .select()
      .from(schema.transaction)
      .where(eq(schema.transaction.id, line.id));
    await drive.updateFile(row.driveFileId!, {
      addParent: folders.stagingFolderId,
      removeParent: after!.driveFolderId!,
    });
    drive.files.get(after!.driveFolderId!)!.permissions.length = 0;

    await expect(verifyMigration(deps(person), bucketAgainstReport())).resolves.toEqual([
      { problem: "file-misplaced", evidenceId: legacy.id },
      { problem: "not-shared", transactionId: line.id },
      { problem: "unreported-objects", storagePaths: ["never-migrated"] },
    ]);
  });

  it("names a missing, a trashed and a resized file, an unsynced line, and a missing report", async () => {
    const { person, trip, line } = await scene();
    const other = await addTransaction({
      perjadinId: trip.id,
      amountIdr: 5_000,
      createdByPersonId: person.id,
    });
    const third = await addTransaction({
      perjadinId: trip.id,
      amountIdr: 7_000,
      createdByPersonId: person.id,
    });
    const gone = await aLegacyReceipt(line.id, person.id, await phonePhoto(400, 300));
    const trashed = await aLegacyReceipt(other.id, person.id, await phonePhoto(400, 300));
    const resized = await aLegacyReceipt(third.id, person.id, pdf(3000));
    await migrateLegacyReceipts(deps(person));
    drive.remove((await evidenceRow(gone.id)).driveFileId!);
    drive.trash((await evidenceRow(trashed.id)).driveFileId!);
    await db
      .update(schema.transactionEvidence)
      .set({ byteSize: 1 })
      .where(eq(schema.transactionEvidence.id, resized.id));
    await db
      .update(schema.transaction)
      .set({ driveSyncedAt: null })
      .where(eq(schema.transaction.id, third.id));

    const problems = await verifyMigration(deps(person), { keys: [], reportedKeys: null });

    expect(problems).toEqual(
      expect.arrayContaining([
        { problem: "file-missing", evidenceId: gone.id },
        { problem: "file-trashed", evidenceId: trashed.id },
        { problem: "size-mismatch", evidenceId: resized.id },
        { problem: "unsynced", transactionId: third.id },
        { problem: "report-missing" },
      ]),
    );
  });
});

describe("the edges of a run", () => {
  it("skips an object that is not in the bucket", async () => {
    const { person, line } = await scene();
    const legacy = await addTransactionEvidence({
      transactionId: line.id,
      uploadedByPersonId: person.id,
    });

    await expect(migrateLegacyReceipts(deps(person))).resolves.toMatchObject({
      skipped: [{ evidenceId: legacy.id, reason: "not-in-bucket" }],
    });
  });

  it("lists a row Drive failed on, leaves it as it was, and carries on", async () => {
    const { person, line } = await scene();
    const failing = await aLegacyReceipt(line.id, person.id, await phonePhoto(400, 300));
    const fine = await aLegacyReceipt(line.id, person.id, pdf());
    vi.spyOn(drive, "uploadFile").mockRejectedValueOnce(
      new DriveRequestError("files.create(upload)", 503),
    );

    const report = await migrateLegacyReceipts(deps(person));

    expect(report.failed).toEqual([{ evidenceId: failing.id, storagePath: failing.storagePath }]);
    expect(report.migrated).toMatchObject([{ evidenceId: fine.id }]);
    expect((await evidenceRow(failing.id)).storagePath).toBe(failing.storagePath);
    expect(reportLines.map((line) => line.evidenceId)).toEqual([fine.id]);
  });

  it("applies a photo's EXIF orientation as it re-encodes", async () => {
    const sideways = new Uint8Array(
      await sharp({ create: { width: 400, height: 300, channels: 3, background: "#808080" } })
        .jpeg()
        .withMetadata({ orientation: 6 })
        .toBuffer(),
    );

    const upright = await sharp(await reencodeImage(sideways)).metadata();

    expect([upright.width, upright.height, upright.orientation]).toEqual([300, 400, undefined]);
  });
});

describe("the real Drive upload", () => {
  it("sends multipart/related: the JSON metadata, then the bytes, between the boundaries", async () => {
    const { openDrive: realOpenDrive } =
      await vi.importActual<typeof import("-/lib/drive/google")>("-/lib/drive/google");
    let sent: { url: string; contentType: string; body: Uint8Array } | null = null;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      sent = {
        url: String(input),
        contentType: new Headers(init?.headers).get("content-type")!,
        body: new Uint8Array(await new Response(init?.body).arrayBuffer()),
      };
      return Response.json({ id: "drive-id" });
    });
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0xff, 0x00, 0x0d, 0x0a]);

    const file = await realOpenDrive("token").uploadFile({
      name: "a.pdf",
      parentId: "staging",
      mimeType: "application/pdf",
      bytes,
      appProperties: { sugtPerjadinId: "p1" },
    });

    expect(file).toEqual({ id: "drive-id" });
    const { url, contentType, body } = sent!;
    expect(url).toBe(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    );
    const boundary = /boundary=(.+)$/.exec(contentType)![1]!;
    const text = Buffer.from(body).toString("latin1");
    const parts = text.split(`--${boundary}`);
    expect(parts[0]).toBe("");
    expect(parts.at(-1)).toBe("--");
    expect(JSON.parse(parts[1]!.split("\r\n\r\n")[1]!)).toEqual({
      name: "a.pdf",
      mimeType: "application/pdf",
      parents: ["staging"],
      appProperties: { sugtPerjadinId: "p1" },
    });
    // The bytes themselves may hold a CRLF, so cut at the first blank line only.
    const binary = parts[2]!.slice(parts[2]!.indexOf("\r\n\r\n") + 4, -2);
    expect(Buffer.from(binary, "latin1")).toEqual(Buffer.from(bytes));
  });
});
