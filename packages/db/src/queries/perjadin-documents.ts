import {
  PERJADIN_DOCUMENT_KINDS,
  PERJADIN_DOCUMENT_PARTICIPANT_TYPES,
  type PerjadinDocumentKind,
  type PerjadinDocumentParticipantType,
  type TimeZone,
} from "@sugt/domain";
import { asc, eq, sql } from "drizzle-orm";

import { db } from "../client";
import { province, school } from "../schema/reference";
import { perjadin, perjadinDocument } from "../schema/travel";
import { logActivity, type DocumentLogDetails } from "./activity-log";
import type { Person } from "./caller";
import { requireStaff } from "./staff-only";

/**
 * **Perjadin Documents** (#397, ADR-0042) — a trip's attendance sheets, one PDF each in the company
 * Google Drive. This module is the database half: recording one, and the Dokumen dialog's read. The
 * upload, the checks on the file and the reconcile talk to Google and live in `@sugt/internal`;
 * their bookkeeping is `./document-drive-sync.ts`.
 *
 * **Any Staff member records one**, as any Staff member records a transaction; a Pimpinan reads
 * only.
 */

/** A Daftar Hadir Peserta's four extra fields: one School, one cohort, one session's local span. */
export type PesertaFields = {
  schoolId: string;
  participantType: PerjadinDocumentParticipantType;
  /** `HH:MM`, local to the School. */
  startsAt: string;
  /** `HH:MM`, local to the School; after `startsAt`. */
  endsAt: string;
};

/** What the Unggah dokumen form says about a sheet. Only a Peserta sheet carries `peserta`. */
export type DocumentFields = {
  kind: PerjadinDocumentKind;
  /** Tanggal Sesi or Tanggal Dokumen, `YYYY-MM-DD`, inside the trip. */
  documentDate: string;
  peserta?: PesertaFields;
};

/** A document whose file is already in Drive, checked by the app (ADR-0042). */
export type NewPerjadinDocument = DocumentFields & {
  perjadinId: string;
  /** Generated before the insert: the file's name carries it (`D-{doc8}`). */
  documentId: string;
  driveFileId: string;
  /** Read back from Drive, never the browser's word. */
  byteSize: number;
};

/** Why the form's fields cannot be recorded. Each points at a field, so each is a value. */
export type DocumentFieldsRefusal =
  /** The id names no Perjadin — a stale card, which is reachable. */
  | { outcome: "no-such-perjadin" }
  /** Not one of the three kinds, or a Peserta's fields on another kind, or missing from one. */
  | { outcome: "invalid-fields" }
  /** The date is outside the trip — Tanggal Sesi and Tanggal Dokumen both lie inside it. */
  | { outcome: "date-outside-perjadin"; startsOn: string; endsOn: string }
  /** A School that is not in the trip's Sub-Cluster — the rule offline Sessions hold too. */
  | { outcome: "school-outside-sub-cluster" }
  /** Waktu Selesai is not after Waktu Mulai, or either is not a time. */
  | { outcome: "times-out-of-order" };

export type RecordPerjadinDocumentResult = { outcome: "recorded" } | DocumentFieldsRefusal;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const WALL_CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * **Check a sheet's fields against its trip** — in the caller's transaction when it has one, so the
 * record checks and writes against one view of the trip. Answers the School's name and Time Zone a
 * Peserta sheet's Log entry needs, or why the fields are refused.
 *
 * Exported for the upload's own early answer: `recordDocumentAction` asks it **before** anything
 * moves in Drive, so a sheet dated outside the trip is refused while the file still sits unnamed in
 * `_staging`. `recordPerjadinDocument` asks again inside its transaction; that is the rule, this is
 * the courtesy.
 */
export async function checkDocumentFields(
  caller: Person,
  perjadinId: string,
  fields: DocumentFields,
  tx: Tx | typeof db = db,
): Promise<
  { outcome: "ok"; school: { name: string; timeZone: TimeZone } | null } | DocumentFieldsRefusal
> {
  requireStaff(caller);

  const [trip] = await tx
    .select({
      startsOn: perjadin.startsOn,
      endsOn: perjadin.endsOn,
      subClusterId: perjadin.subClusterId,
    })
    .from(perjadin)
    .where(eq(perjadin.id, perjadinId));
  if (!trip) return { outcome: "no-such-perjadin" };

  if (!(PERJADIN_DOCUMENT_KINDS as readonly string[]).includes(fields.kind)) {
    return { outcome: "invalid-fields" };
  }
  const isPeserta = fields.kind === "Daftar Hadir Peserta";
  if (isPeserta !== Boolean(fields.peserta)) return { outcome: "invalid-fields" };

  // ISO dates compare as strings; a malformed one is outside every trip.
  if (
    !ISO_DATE.test(fields.documentDate) ||
    fields.documentDate < trip.startsOn ||
    fields.documentDate > trip.endsOn
  ) {
    return { outcome: "date-outside-perjadin", startsOn: trip.startsOn, endsOn: trip.endsOn };
  }

  const peserta = fields.peserta;
  if (!peserta) return { outcome: "ok", school: null };

  if (
    !(PERJADIN_DOCUMENT_PARTICIPANT_TYPES as readonly string[]).includes(peserta.participantType)
  ) {
    return { outcome: "invalid-fields" };
  }
  // `HH:MM` compares as a string too, and the CHECK holds the same order at the database.
  if (
    !WALL_CLOCK.test(peserta.startsAt) ||
    !WALL_CLOCK.test(peserta.endsAt) ||
    peserta.endsAt <= peserta.startsAt
  ) {
    return { outcome: "times-out-of-order" };
  }

  const [found] = await tx
    .select({
      name: school.name,
      subClusterId: school.subClusterId,
      timeZone: province.timeZone,
    })
    .from(school)
    .innerJoin(province, eq(province.code, school.provinceCode))
    .where(sql`${school.id}::text = ${peserta.schoolId}`);
  if (!found || found.subClusterId !== trip.subClusterId) {
    return { outcome: "school-outside-sub-cluster" };
  }
  return { outcome: "ok", school: { name: found.name, timeZone: found.timeZone } };
}

/**
 * **Record one Perjadin Document**, with its Activity Log entry, in one transaction (ADR-0042):
 * the row lands unsynced, and a refused write logs nothing. The fields are checked again here
 * (`checkDocumentFields`) — the upload's early check is a courtesy, this is the rule. There is no
 * duplicate rule: a second sheet of one kind and date is a second row.
 */
export async function recordPerjadinDocument(
  caller: Person,
  input: NewPerjadinDocument,
): Promise<RecordPerjadinDocumentResult> {
  requireStaff(caller);

  return db.transaction(async (tx) => {
    const checked = await checkDocumentFields(caller, input.perjadinId, input, tx);
    if (checked.outcome !== "ok") return checked;

    const peserta = input.peserta;
    await tx.insert(perjadinDocument).values({
      id: input.documentId,
      perjadinId: input.perjadinId,
      kind: input.kind,
      documentDate: input.documentDate,
      schoolId: peserta?.schoolId ?? null,
      participantType: peserta?.participantType ?? null,
      startsAt: peserta?.startsAt ?? null,
      endsAt: peserta?.endsAt ?? null,
      driveFileId: input.driveFileId,
      contentType: "application/pdf",
      byteSize: input.byteSize,
      uploadedByPersonId: caller.id,
    });

    const details = documentLogDetails(
      { documentId: input.documentId, kind: input.kind, documentDate: input.documentDate },
      peserta,
      checked.school,
    );
    await logActivity(tx, caller, input.perjadinId, { action: "document_uploaded", details });

    return { outcome: "recorded" };
  });
}

/**
 * What a `document_uploaded` or `document_deleted` entry records of one sheet: its kind and date,
 * and for a Peserta sheet its School's name and zone, cohort and span — one shape for both, so the
 * Log reads an upload and its deletion the same way.
 */
function documentLogDetails(
  sheet: Pick<DocumentLogDetails, "documentId" | "kind" | "documentDate">,
  peserta: PesertaFields | undefined,
  school: { name: string; timeZone: TimeZone } | null,
): DocumentLogDetails {
  if (!peserta || !school) return { ...sheet };
  return {
    ...sheet,
    schoolName: school.name,
    participantType: peserta.participantType,
    startsAt: peserta.startsAt,
    endsAt: peserta.endsAt,
    timeZone: school.timeZone,
  };
}

export type DeletePerjadinDocumentResult =
  | { outcome: "deleted"; perjadinId: string }
  /** Already deleted — a second Hapus, or a stale dialog. Nothing to do. */
  | { outcome: "no-such-document" };

/**
 * **Delete one Perjadin Document's row, with its `document_deleted` Log entry**, in one transaction
 * (#398). The entry is a snapshot of the row as it goes — the same fields `document_uploaded`
 * recorded — since nothing is left to read afterwards.
 *
 * **The file must already be in the Drive trash** (ADR-0042): `deleteDocumentAction` trashes it
 * first and calls this second, so a row never vanishes while its public file stays live. If this
 * fails after the trash, the row stays, pointing at a trashed file, and Hapus again finishes it.
 */
export async function deletePerjadinDocument(
  caller: Person,
  documentId: string,
): Promise<DeletePerjadinDocumentResult> {
  requireStaff(caller);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .delete(perjadinDocument)
      .where(sql`${perjadinDocument.id}::text = ${documentId}`)
      .returning();
    if (!row) return { outcome: "no-such-document" };

    const peserta =
      row.schoolId && row.participantType && row.startsAt && row.endsAt
        ? {
            schoolId: row.schoolId,
            participantType: row.participantType,
            // As the upload's entry wrote them: `HH:MM`.
            startsAt: row.startsAt.slice(0, 5),
            endsAt: row.endsAt.slice(0, 5),
          }
        : undefined;
    const [found] = peserta
      ? await tx
          .select({ name: school.name, timeZone: province.timeZone })
          .from(school)
          .innerJoin(province, eq(province.code, school.provinceCode))
          .where(eq(school.id, peserta.schoolId))
      : [];
    const details = documentLogDetails(
      { documentId: row.id, kind: row.kind, documentDate: row.documentDate },
      peserta,
      found ?? null,
    );
    await logActivity(tx, caller, row.perjadinId, { action: "document_deleted", details });

    return { outcome: "deleted", perjadinId: row.perjadinId };
  });
}

/** One uploaded sheet, as the Dokumen dialog lists it. Peserta fields are null on the others. */
export type PerjadinDocumentRow = {
  id: string;
  kind: PerjadinDocumentKind;
  documentDate: string;
  schoolName: string | null;
  participantType: PerjadinDocumentParticipantType | null;
  startsAt: string | null;
  endsAt: string | null;
  timeZone: TimeZone | null;
  driveFileId: string;
  /** Recorded, but the reconcile has not yet put the file in place — "belum tersinkron". */
  unsynced: boolean;
};

/** A School the Peserta form offers: the trip's Sub-Cluster's, with the zone its times are in. */
export type DocumentSchool = { id: string; name: string; timeZone: TimeZone };

/** Everything the Dokumen dialog renders for one trip. */
export type PerjadinDokumen = {
  perjadinId: string;
  startsOn: string;
  endsOn: string;
  schools: DocumentSchool[];
  documents: PerjadinDocumentRow[];
};

/**
 * **The Dokumen dialog's read**: the trip's window, the Schools a Peserta sheet may name, and the
 * sheets uploaded so far — by date, then time, then upload. `null` when there is no such trip. Open
 * to any signed-in Person: attendance sheets carry no money, and a Pimpinan reads them.
 */
export async function perjadinDokumen(
  _caller: Person,
  perjadinId: string,
): Promise<PerjadinDokumen | null> {
  const [trip] = await db
    .select({
      perjadinId: perjadin.id,
      startsOn: perjadin.startsOn,
      endsOn: perjadin.endsOn,
      subClusterId: perjadin.subClusterId,
    })
    .from(perjadin)
    .where(eq(perjadin.id, perjadinId));
  if (!trip) return null;

  const [schools, documents] = await Promise.all([
    db
      .select({ id: school.id, name: school.name, timeZone: province.timeZone })
      .from(school)
      .innerJoin(province, eq(province.code, school.provinceCode))
      .where(eq(school.subClusterId, trip.subClusterId))
      .orderBy(asc(school.name), asc(school.id)),
    db
      .select({
        id: perjadinDocument.id,
        kind: perjadinDocument.kind,
        documentDate: perjadinDocument.documentDate,
        schoolName: school.name,
        participantType: perjadinDocument.participantType,
        startsAt: perjadinDocument.startsAt,
        endsAt: perjadinDocument.endsAt,
        timeZone: province.timeZone,
        driveFileId: perjadinDocument.driveFileId,
        unsynced: sql<boolean>`${perjadinDocument.driveSyncedAt} is null`,
      })
      .from(perjadinDocument)
      .leftJoin(school, eq(school.id, perjadinDocument.schoolId))
      .leftJoin(province, eq(province.code, school.provinceCode))
      .where(eq(perjadinDocument.perjadinId, perjadinId))
      .orderBy(
        asc(perjadinDocument.documentDate),
        asc(perjadinDocument.startsAt),
        asc(perjadinDocument.uploadedAt),
        asc(perjadinDocument.id),
      ),
  ]);

  const { subClusterId: _subClusterId, ...window } = trip;
  return { ...window, schools, documents };
}
