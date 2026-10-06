import { randomUUID } from "node:crypto";

import { db, schema } from "@sugt/db";
import {
  isNotStaffError,
  perjadinDokumen,
  recordPerjadinDocument,
  type NewPerjadinDocument,
  type Person,
} from "@sugt/db/queries";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addCluster,
  addPerjadin,
  addPerson,
  addProvince,
  addSchool,
  addSubCluster,
  refusedBy,
  resetDatabase,
} from "./support/fixtures";

/**
 * **Perjadin Documents, the database half** (#397, ADR-0042): the CHECKs that keep a Peserta
 * sheet's four fields on Peserta sheets only, the rules the application holds — the date inside the
 * trip, the School inside its Sub-Cluster — and the record and its Activity Log entry, written
 * together.
 */

/** A trip to a Sub-Cluster in WITA with one School in it, and one School outside it. */
async function scene() {
  const staff = await addPerson({ fullName: "Rina", email: "rina@itb.ac.id", role: "Staff" });
  await addProvince("KT", "Kalimantan Timur", "WITA");
  const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
  const subCluster = await addSubCluster({
    slug: "kelompok-18",
    name: "Kelompok 18",
    clusterId: cluster.id,
  });
  const inside = await addSchool({
    slug: "sman-1-bontang",
    name: "SMAN 1 Bontang",
    clusterId: cluster.id,
    subClusterId: subCluster.id,
    provinceCode: "KT",
    kabupatenKota: "Kota Bontang",
  });
  const outside = await addSchool({
    slug: "sman-2-samarinda",
    name: "SMAN 2 Samarinda",
    clusterId: cluster.id,
    provinceCode: "KT",
    kabupatenKota: "Kota Samarinda",
  });
  const trip = await addPerjadin({
    advanceIdr: 1_000_000,
    picPersonId: staff.id,
    subClusterId: subCluster.id,
    destination: "Kelompok 18: Kota Bontang",
    startsOn: "2026-10-12",
    endsOn: "2026-10-15",
  });
  return { staff: staff as Person, trip, inside, outside };
}

/** A Daftar Hadir Peserta for `schoolId`, valid unless the overrides spoil it. */
function peserta(
  perjadinId: string,
  schoolId: string,
  overrides: Partial<NewPerjadinDocument> = {},
): NewPerjadinDocument {
  return {
    perjadinId,
    documentId: randomUUID(),
    driveFileId: randomUUID(),
    byteSize: 2048,
    kind: "Daftar Hadir Peserta",
    documentDate: "2026-10-14",
    peserta: { schoolId, participantType: "Siswa", startsAt: "08:00", endsAt: "11:30" },
    ...overrides,
  };
}

/** A Daftar Hadir Pendamping for one day. */
function pendamping(perjadinId: string, documentDate = "2026-10-13"): NewPerjadinDocument {
  return {
    perjadinId,
    documentId: randomUUID(),
    driveFileId: randomUUID(),
    byteSize: 2048,
    kind: "Daftar Hadir Pendamping",
    documentDate,
  };
}

const documents = () => db.select().from(schema.perjadinDocument);
const logged = () => db.select().from(schema.activityLog);

beforeEach(resetDatabase);

describe("the CHECKs", () => {
  /** A row written straight to the table, bypassing the application's checks. */
  async function insert(
    perjadinId: string,
    uploadedByPersonId: string,
    row: Partial<typeof schema.perjadinDocument.$inferInsert>,
  ) {
    return db.insert(schema.perjadinDocument).values({
      perjadinId,
      kind: "Daftar Hadir Narasumber",
      documentDate: "2026-10-13",
      driveFileId: randomUUID(),
      contentType: "application/pdf",
      byteSize: 1,
      uploadedByPersonId,
      ...row,
    });
  }

  it("requires a Peserta sheet's four fields, and refuses any of them on the other two kinds", async () => {
    const { staff, trip, inside } = await scene();
    const all = {
      schoolId: inside.id,
      participantType: "Siswa" as const,
      startsAt: "08:00",
      endsAt: "11:30",
    };

    await expect(
      refusedBy(
        insert(trip.id, staff.id, { kind: "Daftar Hadir Peserta", ...all, startsAt: null }),
      ),
    ).resolves.toBe("perjadin_document_peserta_fields_check");
    // All four on another kind breaks both CHECKs; Postgres names whichever it evaluates first.
    await expect(
      refusedBy(insert(trip.id, staff.id, { kind: "Daftar Hadir Pendamping", ...all })),
    ).resolves.toMatch(/^perjadin_document_(peserta_fields|other_fields_null)_check$/);
    await expect(refusedBy(insert(trip.id, staff.id, { schoolId: inside.id }))).resolves.toBe(
      "perjadin_document_other_fields_null_check",
    );
    await expect(
      refusedBy(insert(trip.id, staff.id, { kind: "Daftar Hadir Peserta", ...all })),
    ).resolves.toBeNull();
    await expect(refusedBy(insert(trip.id, staff.id, {}))).resolves.toBeNull();
  });

  it("holds Waktu Selesai after Waktu Mulai, and the PDF-only type", async () => {
    const { staff, trip, inside } = await scene();
    const sheet = {
      kind: "Daftar Hadir Peserta" as const,
      schoolId: inside.id,
      participantType: "GTK-MS" as const,
    };

    await expect(
      refusedBy(insert(trip.id, staff.id, { ...sheet, startsAt: "11:30", endsAt: "11:30" })),
    ).resolves.toBe("perjadin_document_times_check");
    await expect(refusedBy(insert(trip.id, staff.id, { contentType: "image/jpeg" }))).resolves.toBe(
      "perjadin_document_content_type_check",
    );
  });
});

describe("recordPerjadinDocument", () => {
  it("records a Peserta sheet and its Activity Log entry, with the School's name and zone", async () => {
    const { staff, trip, inside } = await scene();
    const input = peserta(trip.id, inside.id);

    await expect(recordPerjadinDocument(staff, input)).resolves.toEqual({ outcome: "recorded" });

    const [row] = await documents();
    expect(row).toMatchObject({
      id: input.documentId,
      kind: "Daftar Hadir Peserta",
      documentDate: "2026-10-14",
      schoolId: inside.id,
      participantType: "Siswa",
      startsAt: "08:00:00",
      endsAt: "11:30:00",
      contentType: "application/pdf",
      uploadedByPersonId: staff.id,
      driveSyncedAt: null,
    });
    const [entry] = await logged();
    expect(entry).toMatchObject({
      actorPersonId: staff.id,
      perjadinId: trip.id,
      action: "document_uploaded",
      details: {
        documentId: input.documentId,
        kind: "Daftar Hadir Peserta",
        documentDate: "2026-10-14",
        schoolName: "SMAN 1 Bontang",
        participantType: "Siswa",
        startsAt: "08:00",
        endsAt: "11:30",
        timeZone: "WITA",
      },
      searchText:
        "dokumen diunggah · daftar hadir peserta · 2026-10-14 · sman 1 bontang · siswa · 08.00–11.30 wita",
    });
  });

  it("records a Pendamping sheet with only its date", async () => {
    const { staff, trip } = await scene();
    const input = pendamping(trip.id);

    await expect(recordPerjadinDocument(staff, input)).resolves.toEqual({ outcome: "recorded" });

    const [entry] = await logged();
    expect(entry?.details).toEqual({
      documentId: input.documentId,
      kind: "Daftar Hadir Pendamping",
      documentDate: "2026-10-13",
    });
    expect(entry?.searchText).toBe("dokumen diunggah · daftar hadir pendamping · 2026-10-13");
  });

  it("allows two sheets of one kind and date — the D- marker tells them apart", async () => {
    const { staff, trip, inside } = await scene();

    await recordPerjadinDocument(staff, peserta(trip.id, inside.id));
    await recordPerjadinDocument(staff, peserta(trip.id, inside.id));

    await expect(documents()).resolves.toHaveLength(2);
    await expect(logged()).resolves.toHaveLength(2);
  });

  it.each([
    ["before the trip", "2026-10-11"],
    ["after the trip", "2026-10-16"],
    ["not a date", "kemarin"],
  ])("refuses a date %s, and writes and logs nothing", async (_case, documentDate) => {
    const { staff, trip } = await scene();

    await expect(recordPerjadinDocument(staff, pendamping(trip.id, documentDate))).resolves.toEqual(
      {
        outcome: "date-outside-perjadin",
        startsOn: "2026-10-12",
        endsOn: "2026-10-15",
      },
    );
    await expect(documents()).resolves.toHaveLength(0);
    await expect(logged()).resolves.toHaveLength(0);
  });

  it("refuses a School outside the trip's Sub-Cluster, and writes and logs nothing", async () => {
    const { staff, trip, outside } = await scene();

    await expect(recordPerjadinDocument(staff, peserta(trip.id, outside.id))).resolves.toEqual({
      outcome: "school-outside-sub-cluster",
    });
    await expect(recordPerjadinDocument(staff, peserta(trip.id, "not-a-uuid"))).resolves.toEqual({
      outcome: "school-outside-sub-cluster",
    });
    await expect(documents()).resolves.toHaveLength(0);
    await expect(logged()).resolves.toHaveLength(0);
  });

  it("refuses times out of order, and Peserta fields on the wrong kind", async () => {
    const { staff, trip, inside } = await scene();
    const sheet = peserta(trip.id, inside.id);

    await expect(
      recordPerjadinDocument(staff, {
        ...sheet,
        peserta: { ...sheet.peserta!, startsAt: "11:30", endsAt: "08:00" },
      }),
    ).resolves.toEqual({ outcome: "times-out-of-order" });
    await expect(
      recordPerjadinDocument(staff, { ...sheet, kind: "Daftar Hadir Narasumber" }),
    ).resolves.toEqual({ outcome: "invalid-fields" });
    await expect(recordPerjadinDocument(staff, { ...sheet, peserta: undefined })).resolves.toEqual({
      outcome: "invalid-fields",
    });
    await expect(logged()).resolves.toHaveLength(0);
  });

  it("refuses a non-Staff caller before anything is written", async () => {
    const { trip } = await scene();
    const pimpinan = await addPerson({ fullName: "Pim", email: "pim@itb.ac.id", role: "Pimpinan" });

    await expect(recordPerjadinDocument(pimpinan as Person, pendamping(trip.id))).rejects.toSatisfy(
      isNotStaffError,
    );
    await expect(documents()).resolves.toHaveLength(0);
  });
});

describe("perjadinDokumen — the dialog's read", () => {
  it("lists the trip's window, its Sub-Cluster's Schools and its sheets, unsynced flagged", async () => {
    const { staff, trip, inside } = await scene();
    const first = peserta(trip.id, inside.id);
    const second = pendamping(trip.id, "2026-10-12");
    await recordPerjadinDocument(staff, first);
    await recordPerjadinDocument(staff, second);
    await db
      .update(schema.perjadinDocument)
      .set({ driveSyncedAt: new Date() })
      .where(eq(schema.perjadinDocument.id, second.documentId));

    const read = await perjadinDokumen(staff, trip.id);

    expect(read).toMatchObject({
      perjadinId: trip.id,
      startsOn: "2026-10-12",
      endsOn: "2026-10-15",
      schools: [{ id: inside.id, name: "SMAN 1 Bontang", timeZone: "WITA" }],
    });
    expect(read?.documents).toEqual([
      expect.objectContaining({
        id: second.documentId,
        kind: "Daftar Hadir Pendamping",
        schoolName: null,
        unsynced: false,
      }),
      expect.objectContaining({
        id: first.documentId,
        schoolName: "SMAN 1 Bontang",
        participantType: "Siswa",
        timeZone: "WITA",
        unsynced: true,
      }),
    ]);
    await expect(perjadinDokumen(staff, randomUUID())).resolves.toBeNull();
  });
});
