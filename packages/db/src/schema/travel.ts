import type {
  ActivityLogAction,
  PerjadinDocumentKind,
  PerjadinDocumentParticipantType,
  Role,
  Stream,
  TransactionCategory,
  TransactionParticipantType,
} from "@sugt/domain";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { person } from "./people";
import { school, subCluster } from "./reference";

/**
 * Travel: the Perjadin, its Group, and the acquittal state.
 *
 * There is no `perjadin_report` table. A Perjadin yields exactly one Report,
 * always, so the acquittal is the state already on `perjadin`.
 */

/**
 * Money is `bigint` in whole rupiah — `numeric(_, 2)` would imply a subunit nobody
 * uses. Every money column carries the `_idr` suffix so no reader has to guess.
 *
 * There is no `report_deadline`: the Report is due two days after the Group gets
 * back, so it is `ends_on + REPORT_DEADLINE_DAYS_AFTER_RETURN` and nothing stores
 * it. A derived deadline recomputes itself when a trip's dates are corrected; a
 * typed one goes stale.
 *
 * `picRole` is pinned to 'Staff' so the composite foreign key into
 * `person (id, role)` makes **the PIC is a Staff member** unbreakable, including
 * from the Supabase SQL editor.
 *
 * The other half of the PIC rule — that they are a member of their own Group — is a
 * DEFERRABLE self-referential foreign key, which Drizzle cannot express. It lives
 * in a hand-written migration; see `migrations/`.
 */
export const perjadin = pgTable(
  "perjadin",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Where the Perjadin goes: it fixes the Schools that may appear on the trip at all. One
    // Sub-Cluster may be covered by several Perjadins (ADR-0043), so it is not unique.
    // NOT NULL immediately — no Perjadin exists in any live database, so there is nothing
    // to backfill. The trip's name is `{sub_cluster.name} · {dates}`, read live and never
    // stored (ADR-0044) — there is no destination column.
    subClusterId: uuid("sub_cluster_id")
      .notNull()
      .references(() => subCluster.id),
    // Tanggal mulai / Tanggal selesai, typed and written directly (ADR-0041). A Perjadin carries
    // no travel legs — many trips are PP — so there is no departure or return to derive them from.
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),

    advanceIdr: bigint("advance_idr", { mode: "number" }).notNull(),

    picPersonId: uuid("pic_person_id").notNull(),
    picRole: text("pic_role").$type<"Staff">().notNull().default("Staff"),

    returnedToTreasurerIdr: bigint("returned_to_treasurer_idr", { mode: "number" }),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    reportFiledAt: timestamp("report_filed_at", { withTimezone: true }),
    // The Perjadin's folder in the company Google Drive (ADR-0040), set by compare-and-set the
    // first time a transaction on it is reconciled — never under a row lock held across a call
    // to Google. Null until then. An id, never a path, so a rename or move by hand breaks nothing.
    driveFolderId: text("drive_folder_id"),
    // The Perjadin's folder under `Dokumen/Pelaksanaan Offline` (ADR-0042), claimed by the same
    // compare-and-set the first time one of its Perjadin Documents is reconciled. Null until then.
    driveDokumenFolderId: text("drive_dokumen_folder_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("perjadin_advance_check", sql`${t.advanceIdr} >= 0`),
    check("perjadin_pic_role_check", sql`${t.picRole} = 'Staff'`),
    check("perjadin_dates_check", sql`${t.endsOn} >= ${t.startsOn}`),
    check(
      "perjadin_returned_check",
      sql`(${t.returnedAt} is null) = (${t.returnedToTreasurerIdr} is null)`,
    ),
    foreignKey({
      name: "perjadin_pic_is_staff",
      columns: [t.picPersonId, t.picRole],
      foreignColumns: [person.id, person.role],
    }),
  ],
);

/**
 * The Group. **Replaced wholesale, never edited** — there is no "remove one member"
 * operation. Substituting a professor submits an entire replacement Group, and one
 * transaction deletes every member row and inserts the new set, so the Perjadin
 * keeps its id and its Sessions, Advance and transactions are untouched.
 *
 * `role` is denormalised from `person`, but it cannot drift: the composite foreign
 * key means a row can only exist if the pair is true there.
 *
 * **This table is Staff-only** (ADR-0020, and T3/#153): the Group is the PIC plus up to ten other
 * DITSAMA Staff, and the teaching team left it entirely for `perjadin_teacher` (trip-scoped names).
 * The roster now carries a second role — `Pimpinan`, a signed-in read-only principal (#179, ADR-0025)
 * — but the Group does not admit it: `group_member_role_check` still pins `'Staff'` and the composite
 * `(id, role)` FK below asks `person` for a Staff pair, so a Pimpinan can never be a member. `stream`
 * can never be carried by a Group member either — so the old
 * `group_member_stream_iff_teaching` equivalence (which pinned Stream to Teaching-Team rows)
 * collapses to `group_member_stream_null`: a Group member holds no Stream at all. See
 * `docs/data-model.md`'s Group section.
 */
export const groupMember = pgTable(
  "group_member",
  {
    perjadinId: uuid("perjadin_id")
      .notNull()
      .references(() => perjadin.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull(),
    // `group_member_stream_check` names exactly the values `STREAMS` holds. `group_member_role_check`
    // deliberately pins `'Staff'` alone — a subset of `ROLES` now that `Pimpinan` exists (#179) — which
    // is what keeps a Pimpinan out of the Group. `stream` stays nullable, so it reads as `Stream | null`;
    // the CHECK pins which strings are allowed, and `group_member_stream_null` below pins that it is
    // always null now.
    role: text("role").$type<Role>().notNull(),
    stream: text("stream").$type<Stream>(),
  },
  (t) => [
    primaryKey({ columns: [t.perjadinId, t.personId] }),
    check("group_member_role_check", sql`${t.role} = 'Staff'`),
    check("group_member_stream_check", sql`${t.stream} in ('STEM', 'Research')`),
    // A Group is Staff and only Staff now (ADR-0020, T3/#153), so no member carries a Stream:
    // the teaching team who used to carry a Stream assignment are trip-scoped names, not Group
    // members. This replaces `group_member_stream_iff_teaching`, whose Teaching-Team side is now
    // unreachable.
    check("group_member_stream_null", sql`${t.stream} is null`),
    foreignKey({
      name: "group_member_person_role_fk",
      columns: [t.personId, t.role],
      foreignColumns: [person.id, person.role],
    }),
    // The primary key `(perjadin_id, person_id)` leads with `perjadin_id`, so it cannot serve a
    // lookup keyed on `person_id` alone. `my-perjadin.ts` joins Groups by `person_id` — a Staff
    // member's own trips on `/pendamping` — so that path needs its own index (#270).
    index("group_member_person_id_idx").on(t.personId),
  ],
);

/**
 * A Perjadin's **Teaching Team as trip-scoped names** — plain strings entered on the trip, up to
 * twenty, not `person` rows (ADR-0020). They are never invited, hold no sign-in, carry no Stream and
 * are not `group_member` rows; the professors who deliver offline Sessions are external to DITSAMA
 * and will not sign in. Editing is per-member — names are added, renamed and removed one at a time on
 * `/perjadin/[id]` (T3), not by wholesale replacement — which is why this is a table of its own rather
 * than a column on `perjadin`.
 *
 * The cap of twenty is an app rule (`MAX_TEACHING_TEAM_PER_PERJADIN`), not a DB one, in the same
 * spirit as the Group caps. `on delete cascade`: the names are the trip's and outlive nothing.
 * Which of them taught each offline Session is recorded through `session_teaching_team`.
 */
export const perjadinTeacher = pgTable(
  "perjadin_teacher",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    perjadinId: uuid("perjadin_id")
      .notNull()
      .references(() => perjadin.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  // The trip's teacher names are read by `perjadin_id` on every trip detail — `perjadin-detail.ts`,
  // `my-perjadin.ts` — and Postgres does not index the FK on its own (#270).
  (t) => [index("perjadin_teacher_perjadin_id_idx").on(t.perjadinId)],
);

/**
 * The **Pimpinan** recorded on a Perjadin — record-only (ADR-0020, and the Pimpinan entry in
 * `CONTEXT.md`). A leader of DITSAMA ITB who rarely joins the Kelompok Perjalanan to monitor the
 * offline Sessions is noted here and named on the Laporan Perjadin, but is **not a working Group
 * member**: they file no Perjadin Evaluation and add nothing to the Preparation Checklist, so they
 * are deliberately not a `group_member` row.
 *
 * A row references a **real Person of role Pimpinan** — the Pimpinan roster is the single source of
 * truth now (#181), so the old fixed-three `PIMPINAN` constant and the `name` CHECK that mirrored it
 * are gone. `role` is pinned to `'Pimpinan'` and the composite `(person_id, role)` foreign key into
 * `person (id, role)` guarantees a non-Pimpinan can never be recorded here, the same discipline the
 * PIC-is-Staff family (`perjadin_pic_is_staff`, `group_member_person_role_fk`) enforces. The primary
 * key `(perjadin_id, person_id)` makes a Pimpinan recordable at most once per trip.
 */
export const perjadinPimpinan = pgTable(
  "perjadin_pimpinan",
  {
    perjadinId: uuid("perjadin_id")
      .notNull()
      .references(() => perjadin.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull(),
    role: text("role").$type<"Pimpinan">().notNull().default("Pimpinan"),
  },
  (t) => [
    primaryKey({ columns: [t.perjadinId, t.personId] }),
    check("perjadin_pimpinan_role_check", sql`${t.role} = 'Pimpinan'`),
    foreignKey({
      name: "perjadin_pimpinan_is_pimpinan",
      columns: [t.personId, t.role],
      foreignColumns: [person.id, person.role],
    }),
  ],
);

/**
 * The acquittal's line items. **The Advance is one pot and the acquittal reconciles the
 * pot** — a transaction consumes the Advance, not a person's share of it.
 *
 * **Two orthogonal axes describe each line.** `category` is *what kind of spend* it was — a
 * closed set read off DITSAMA's own approved budget. `participantType` is *which cohort* it
 * served — `Siswa` (the Student Class) or `GTK-MS` (the GTK and MS Classes together) — so the
 * Laporan can split every acquittal's spend by Class. Both are required, and both are closed
 * sets whose CHECKs below are written out character for character rather than composed from
 * `TRANSACTION_CATEGORIES` / `TRANSACTION_PARTICIPANT_TYPES`, for the reason `./index.ts` gives:
 * a composed constraint string is not the one the drizzle-kit snapshot holds, and the two would
 * then diff forever.
 */
export const transaction = pgTable(
  "transaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    perjadinId: uuid("perjadin_id")
      .notNull()
      .references(() => perjadin.id, { onDelete: "cascade" }),
    spentOn: date("spent_on").notNull(),
    description: text("description").notNull(),
    amountIdr: bigint("amount_idr", { mode: "number" }).notNull(),
    category: text("category").$type<TransactionCategory>().notNull(),
    participantType: text("participant_type").$type<TransactionParticipantType>().notNull(),
    createdByPersonId: uuid("created_by_person_id")
      .notNull()
      .references(() => person.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // The line's own Drive folder, shared "anyone with the link" once reconciled (ADR-0040). Null on
    // a line with no receipt yet, until a receipt is first added to it.
    driveFolderId: text("drive_folder_id"),
    // When the reconcile last finished this line: folder in place, files named and inside it,
    // folder shared. Null while that is still owed. "Unsynced" is null **and** at least one
    // receipt — a zero-receipt line is never unsynced.
    driveSyncedAt: timestamp("drive_synced_at", { withTimezone: true }),
    // When a reconcile last failed to finish this line (#375). The sweep takes lines never failed
    // first, then the longest-failed, so a line that fails every time — its folder trashed by hand —
    // cannot hold the bounded sweep on itself forever. Cleared when the line syncs.
    driveSyncFailedAt: timestamp("drive_sync_failed_at", { withTimezone: true }),
  },
  (t) => [
    check("transaction_amount_check", sql`${t.amountIdr} > 0`),
    check(
      "transaction_category_check",
      sql`${t.category} in ('Tiket Pesawat/Kereta PP', 'Uang Harian', 'Honorarium Narasumber', 'Akomodasi', 'Transport Bandara/Stasiun', 'Transport Lokal Dalam Provinsi', 'Konsumsi', 'Modul', 'ATK', 'Alat dan Bahan Research Project', 'Seminar kit', 'Lainnya')`,
    ),
    check("transaction_participant_type_check", sql`${t.participantType} in ('Siswa', 'GTK-MS')`),
    // Postgres does not index a foreign key on its own. Every acquittal read filters the line items
    // by their Perjadin — `perjadin-report.ts`, `my-perjadin.ts` — so index the FK (#270).
    index("transaction_perjadin_id_idx").on(t.perjadinId),
  ],
);

/**
 * The Preparation Checklist's ticks — **one row per ticked item, and nothing else**
 * ([#114](https://github.com/mafiefa02/sugt/issues/114)).
 *
 * The *set of items that exists* is not stored: since the amendment to ADR-0018 it is a **flat
 * fixed six** — `sk_perjalanan`, `tiket_pp`, lodging, local transport, `staff`, and
 * `pengajar_lengkap` — derived at read time in the query layer with no per-member part. This table
 * holds only which of those a Staff member has hand-ticked, so an un-tick is a `DELETE` and there is
 * no "unchecked" row to keep in sync.
 *
 * `itemKey` is one of those six fixed keys. `pengajar_lengkap` is the one box the tool clears by
 * itself: the Teaching-Team mutation queries (`./queries/perjadin-teachers.ts`) delete its tick on
 * any add/rename/remove, so each change forces a fresh manual confirmation the team is complete.
 * `dosen:{personId}` ticks the **old** per-teacher model left behind are orphans — no item derives
 * them, so they are silently ignored and never cleaned up; so are ticks on `tiket_keberangkatan`
 * and `tiket_kepulangan`, the two ticket boxes ADR-0041 folded into `tiket_pp`. See ADR-0018 and
 * `docs/data-model.md`.
 *
 * The composite primary key `(perjadin_id, item_key)` is what makes a toggle idempotent: the
 * write upserts on it, so ticking twice is one row. `checked_by`/`checked_at` record who and when
 * for later use; nothing renders them yet.
 */
export const perjadinPreparationItem = pgTable(
  "perjadin_preparation_item",
  {
    perjadinId: uuid("perjadin_id")
      .notNull()
      .references(() => perjadin.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    checkedBy: uuid("checked_by")
      .notNull()
      .references(() => person.id),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.perjadinId, t.itemKey] })],
);

/**
 * One to five per transaction (ADR-0039), held by the application rather than here — lines from
 * before that rule may hold none or more.
 *
 * **Every receipt is a file in the company Google Drive** (ADR-0040): `driveFileId` is its id
 * there, `unique` so one uploaded file is attached exactly once. Its `content_type` is one of the
 * four types the server sniffed from the first bytes, which `transaction_evidence_content_type_check`
 * pins. Receipts once lived in a private Supabase bucket under a `storage_path`; they were moved
 * to Drive (#377) and the column dropped (#379).
 */
export const transactionEvidence = pgTable(
  "transaction_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transaction.id, { onDelete: "cascade" }),
    driveFileId: text("drive_file_id").notNull().unique(),
    contentType: text("content_type").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    uploadedByPersonId: uuid("uploaded_by_person_id")
      .notNull()
      .references(() => person.id),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Evidence is fetched per transaction on the Laporan (`perjadin-report.ts`), and the FK is not
  // auto-indexed. `drive_file_id`'s unique index does not help — it keys the file, not the FK
  // (#270).
  (t) => [
    index("transaction_evidence_transaction_id_idx").on(t.transactionId),
    check(
      "transaction_evidence_content_type_check",
      sql`${t.contentType} in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')`,
    ),
  ],
);

/**
 * **The Activity Log** (#395): one row per act on a Perjadin's money, receipts, documents or
 * report — who, when, which trip, what. **Append-only**: each write in `queries/activity-log.ts`'s
 * callers inserts its entry in the same database transaction as the change, so a refused or
 * failed write logs nothing, and nothing in the app updates or deletes a row. Read only by an Administrator,
 * on `/log`.
 *
 * `actor_email` is a **copy** of the actor's email at that moment, so the row stays true if the
 * email later changes. `search_text` is the lower-cased Aksi and Rincian text, rendered once at
 * write time so `/log`'s search runs in SQL over what the screen shows. `details` has one shape per
 * `action`, typed in `queries/activity-log.ts`.
 *
 * `backfilled` marks the rows migration 0039 derived from `transaction` and `transaction_evidence`
 * — the only rows that already recorded who and when. `on delete cascade` from `perjadin`
 * mirrors `transaction`; no app path deletes a Perjadin.
 */
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    actorPersonId: uuid("actor_person_id")
      .notNull()
      .references(() => person.id),
    actorEmail: text("actor_email").notNull(),
    perjadinId: uuid("perjadin_id")
      .notNull()
      .references(() => perjadin.id, { onDelete: "cascade" }),
    action: text("action").$type<ActivityLogAction>().notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull(),
    searchText: text("search_text").notNull(),
    backfilled: boolean("backfilled").notNull().default(false),
  },
  (t) => [
    check(
      "activity_log_action_check",
      sql`${t.action} in ('advance_set', 'advance_changed', 'transaction_recorded', 'evidence_uploaded', 'report_filed', 'document_uploaded', 'document_deleted')`,
    ),
    // `/log` reads newest first, 50 at a time; this serves that order without a sort.
    index("activity_log_occurred_at_id_idx").on(t.occurredAt.desc(), t.id.desc()),
  ],
);

/**
 * **Perjadin Documents** (#397, ADR-0042): the trip's attendance sheets, one PDF each, in the
 * company Google Drive under `Dokumen/`. Three kinds. A **Daftar Hadir Peserta** is one School's
 * attendance at one session, for one cohort, so it alone carries a School, a cohort and the
 * session's local start and end; the other two are one day's sheet and carry none of the four. Two
 * CHECKs hold that both ways round, so a row can neither lack a Peserta field nor carry one it
 * should not.
 *
 * **The School must be in the Perjadin's Sub-Cluster** — held by the application
 * (`recordPerjadinDocument`), not here, for the reason offline Sessions give: Sub-Clusters are
 * editable, so a foreign key into the grouping would forbid regrouping (ADR-0016).
 *
 * `id` is generated before the insert, because the file's name carries it (`D-{doc8}`). There is no
 * duplicate rule: two sheets of one kind and date are allowed, and the marker tells them apart.
 * `drive_synced_at` and `drive_sync_failed_at` mean what they mean on `transaction`.
 */
export const perjadinDocument = pgTable(
  "perjadin_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    perjadinId: uuid("perjadin_id")
      .notNull()
      .references(() => perjadin.id, { onDelete: "cascade" }),
    kind: text("kind").$type<PerjadinDocumentKind>().notNull(),
    // Tanggal Sesi on a Peserta sheet, Tanggal Dokumen on the other two.
    documentDate: date("document_date").notNull(),
    schoolId: uuid("school_id").references(() => school.id),
    participantType: text("participant_type").$type<PerjadinDocumentParticipantType>(),
    // Wall-clock times local to the School, read beside its Province's Time Zone.
    startsAt: time("starts_at"),
    endsAt: time("ends_at"),
    driveFileId: text("drive_file_id").notNull().unique(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    uploadedByPersonId: uuid("uploaded_by_person_id")
      .notNull()
      .references(() => person.id),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    driveSyncedAt: timestamp("drive_synced_at", { withTimezone: true }),
    driveSyncFailedAt: timestamp("drive_sync_failed_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "perjadin_document_kind_check",
      sql`${t.kind} in ('Daftar Hadir Peserta', 'Daftar Hadir Narasumber', 'Daftar Hadir Pendamping')`,
    ),
    check(
      "perjadin_document_participant_type_check",
      sql`${t.participantType} in ('Siswa', 'GTK-MS')`,
    ),
    check("perjadin_document_content_type_check", sql`${t.contentType} = 'application/pdf'`),
    check(
      "perjadin_document_peserta_fields_check",
      sql`(${t.kind} = 'Daftar Hadir Peserta') = (${t.schoolId} is not null and ${t.participantType} is not null and ${t.startsAt} is not null and ${t.endsAt} is not null)`,
    ),
    check(
      "perjadin_document_other_fields_null_check",
      sql`${t.kind} = 'Daftar Hadir Peserta' or (${t.schoolId} is null and ${t.participantType} is null and ${t.startsAt} is null and ${t.endsAt} is null)`,
    ),
    check("perjadin_document_times_check", sql`${t.endsAt} > ${t.startsAt}`),
    // The dialog lists a trip's documents; Postgres does not index the FK on its own (#270).
    index("perjadin_document_perjadin_id_idx").on(t.perjadinId),
  ],
);

/**
 * **A Perjadin's three kind folders** under its Dokumen folder (ADR-0042), each made the first time
 * a document of that kind is reconciled. The primary key is the compare-and-set: the insert does
 * nothing on conflict, and a caller that lost reads back the winner's id and trashes its own.
 */
export const perjadinDocumentFolder = pgTable(
  "perjadin_document_folder",
  {
    perjadinId: uuid("perjadin_id")
      .notNull()
      .references(() => perjadin.id, { onDelete: "cascade" }),
    kind: text("kind").$type<PerjadinDocumentKind>().notNull(),
    driveFolderId: text("drive_folder_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.perjadinId, t.kind] }),
    check(
      "perjadin_document_folder_kind_check",
      sql`${t.kind} in ('Daftar Hadir Peserta', 'Daftar Hadir Narasumber', 'Daftar Hadir Pendamping')`,
    ),
  ],
);
