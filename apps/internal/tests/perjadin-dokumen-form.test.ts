import {
  DOCUMENT_HINT,
  documentFields,
  documentRowText,
  EMPTY_DOCUMENT_FORM,
  ONLY_PDF,
  pickDocument,
  recordRefusalText,
} from "-/components/perjadin-dokumen-form";
import { documentFileName } from "-/lib/drive/document-files";
import { UPLOAD_TOO_LARGE } from "-/lib/drive/receipt-upload";
import type { PerjadinDocumentRow } from "@sugt/db/queries";
import { MAX_UPLOAD_BYTES } from "@sugt/domain";
import { describe, expect, it } from "vitest";

/**
 * **The Dokumen dialog's plain rules** (#397): what a pick is refused for, when Unggah may run, how
 * a sheet reads in its list, and the name its file gets in Drive.
 */

function file(type: string, size = 10): File {
  const picked = new File(["x"], "daftar-hadir.pdf", { type });
  Object.defineProperty(picked, "size", { value: size });
  return picked;
}

describe("picking a file", () => {
  it("takes one PDF within the cap, and refuses anything else in the browser", () => {
    const pdf = file("application/pdf", MAX_UPLOAD_BYTES);
    expect(pickDocument(pdf)).toBe(pdf);
    expect(pickDocument(file("image/jpeg"))).toBe(ONLY_PDF);
    expect(pickDocument(file("application/pdf", MAX_UPLOAD_BYTES + 1))).toBe(UPLOAD_TOO_LARGE);
    expect(ONLY_PDF).toBe("Hanya file .pdf");
    expect(DOCUMENT_HINT).toBe("1 file .pdf, maks. 50 MB");
  });
});

describe("the form's fields", () => {
  it("needs only a date for a Pendamping or Narasumber sheet", () => {
    expect(documentFields({ ...EMPTY_DOCUMENT_FORM, kind: "Daftar Hadir Narasumber" })).toBeNull();
    expect(
      documentFields({
        ...EMPTY_DOCUMENT_FORM,
        kind: "Daftar Hadir Narasumber",
        documentDate: "2026-10-13",
        schoolId: "left-over",
      }),
    ).toEqual({ kind: "Daftar Hadir Narasumber", documentDate: "2026-10-13" });
  });

  it("needs all four Peserta fields for a Peserta sheet", () => {
    const form = {
      kind: "Daftar Hadir Peserta" as const,
      documentDate: "2026-10-14",
      schoolId: "school-1",
      participantType: "GTK-MS" as const,
      startsAt: "08:00",
      endsAt: "11:30",
    };
    expect(documentFields({ ...form, endsAt: "" })).toBeNull();
    expect(documentFields(form)).toEqual({
      kind: "Daftar Hadir Peserta",
      documentDate: "2026-10-14",
      peserta: {
        schoolId: "school-1",
        participantType: "GTK-MS",
        startsAt: "08:00",
        endsAt: "11:30",
      },
    });
  });

  it("says why a date was refused, with the trip's window", () => {
    expect(
      recordRefusalText({
        outcome: "date-outside-perjadin",
        startsOn: "2026-10-12",
        endsOn: "2026-10-16",
      }),
    ).toBe("Tanggal harus di antara 2026-10-12 dan 2026-10-16.");
  });

  it("says why a School was refused: it has no Session on this trip (#410)", () => {
    expect(recordRefusalText({ outcome: "school-not-on-perjadin" })).toBe(
      "Sekolah ini tidak punya Sesi di Perjadin ini.",
    );
  });
});

describe("a sheet, as it reads", () => {
  const row: PerjadinDocumentRow = {
    id: "1a2b3c4d-0000-0000-0000-000000000000",
    kind: "Daftar Hadir Peserta",
    documentDate: "2026-10-14",
    schoolName: "SMA Y",
    participantType: "Siswa",
    startsAt: "08:00:00",
    endsAt: "11:30:00",
    timeZone: "WITA",
    driveFileId: "f",
    unsynced: false,
  };

  it("lists a Peserta sheet with its School, cohort and span, and the others by date", () => {
    expect(documentRowText(row)).toBe("2026-10-14 · SMA Y · Siswa · 08.00–11.30 WITA");
    expect(
      documentRowText({
        ...row,
        kind: "Daftar Hadir Pendamping",
        schoolName: null,
        participantType: null,
        startsAt: null,
        endsAt: null,
        timeZone: null,
      }),
    ).toBe("2026-10-14");
  });

  it("names its file in Drive with the D- marker", () => {
    expect(documentFileName({ ...row, documentId: row.id })).toBe(
      "2026-10-14 · SMA Y · Siswa · Daftar Hadir Peserta · D-1a2b3c4d.pdf",
    );
    expect(
      documentFileName({
        documentId: row.id,
        kind: "Daftar Hadir Narasumber",
        documentDate: "2026-10-13",
        schoolName: null,
        participantType: null,
      }),
    ).toBe("2026-10-13 · Daftar Hadir Narasumber · D-1a2b3c4d.pdf");
  });
});
