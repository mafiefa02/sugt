import type { Role, Stream, TimeZone, TransactionCategory, TransportMode } from "@sugt/domain";
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  foreignKey,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { person } from "./people";
import { subCluster } from "./reference";

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
    // Where the Perjadin goes: it fixes the Schools that may appear on the trip at all.
    // NOT NULL immediately — no Perjadin exists in any live database, so there is nothing
    // to backfill.
    subClusterId: uuid("sub_cluster_id")
      .notNull()
      .references(() => subCluster.id),
    // The Surat Tugas destination line. Derived server-side at insert from this Sub-Cluster's
    // label and its Schools' Kabupaten/Kota, then frozen here — a **snapshot**, never recomputed
    // on read, because Sub-Clusters are editable (ADR-0016) and a live read would rewrite an
    // already-issued Surat Tugas. See `planPerjadin` in `queries/perjadin-planning.ts` and
    // `docs/data-model.md`'s Travel section.
    destination: text("destination").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),

    advanceIdr: bigint("advance_idr", { mode: "number" }).notNull(),

    // **How the Group travels, on each leg.** Six nullable columns: nullable so the Perjadins
    // that predate them stay valid with nothing to backfill — the form requires all six on a new
    // plan, but the column cannot, because existing rows have none.
    //
    // Each `*_at` is a wall-clock date **and** time with **no instant** — a `timestamp` without a
    // time zone — carrying its zone in a separate `*_zone` tag, exactly as `session.starts_at` is
    // a wall-clock time meaningful only beside its Time Zone. Storing an instant would bake in a
    // conversion nobody asked for; the Surat Tugas says "07:30 WIB", not a UTC moment.
    //
    // `departure_zone` is always `WIB` (the origin is Bandung) and `return_zone` is derived at
    // insert from the Province of the last School visited — both snapshots, set server-side. The
    // zone columns still CHECK all three `TIME_ZONES`, because the edit surface may correct a
    // return zone. `*_mode` CHECKs `TRANSPORT_MODES`. Both lists are written out character for
    // character rather than composed, for the reason `transaction_category_check` gives.
    departureAt: timestamp("departure_at", { mode: "string" }),
    departureZone: text("departure_zone").$type<TimeZone>(),
    departureMode: text("departure_mode").$type<TransportMode>(),
    returnAt: timestamp("return_at", { mode: "string" }),
    returnZone: text("return_zone").$type<TimeZone>(),
    returnMode: text("return_mode").$type<TransportMode>(),

    picPersonId: uuid("pic_person_id").notNull(),
    picRole: text("pic_role").$type<"Staff">().notNull().default("Staff"),

    returnedToTreasurerIdr: bigint("returned_to_treasurer_idr", { mode: "number" }),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    reportFiledAt: timestamp("report_filed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("perjadin_advance_check", sql`${t.advanceIdr} >= 0`),
    check("perjadin_pic_role_check", sql`${t.picRole} = 'Staff'`),
    check("perjadin_dates_check", sql`${t.endsOn} >= ${t.startsOn}`),
    // A null zone/mode passes (the columns are nullable); a present one must be in the set.
    check("perjadin_departure_zone_check", sql`${t.departureZone} in ('WIB', 'WITA', 'WIT')`),
    check("perjadin_return_zone_check", sql`${t.returnZone} in ('WIB', 'WITA', 'WIT')`),
    check(
      "perjadin_departure_mode_check",
      sql`${t.departureMode} in ('Pesawat', 'Kereta', 'Travel', 'Mobil Dalam Kota')`,
    ),
    check(
      "perjadin_return_mode_check",
      sql`${t.returnMode} in ('Pesawat', 'Kereta', 'Travel', 'Mobil Dalam Kota')`,
    ),
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
 * key means a row can only exist if the pair is true there. Carrying it is what makes
 * the CHECK below expressible — **exactly the Teaching Team members carry a Stream
 * assignment**, and Staff never do.
 *
 * `receiptsSettledAt` is the PIC's checklist. It has to be an explicit mark rather
 * than something derived, because a member with no transactions is ambiguous between
 * *spent nothing* and *has not handed anything over yet*.
 */
export const groupMember = pgTable(
  "group_member",
  {
    perjadinId: uuid("perjadin_id")
      .notNull()
      .references(() => perjadin.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull(),
    // `group_member_role_check` and `group_member_stream_check` name exactly the values
    // `ROLES` and `STREAMS` hold. `stream` stays nullable, so it reads as `Stream | null`
    // — the CHECK pins which strings are allowed, and `group_member_stream_iff_teaching`
    // below pins when the column may be null at all.
    role: text("role").$type<Role>().notNull(),
    stream: text("stream").$type<Stream>(),
    receiptsSettledAt: timestamp("receipts_settled_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.perjadinId, t.personId] }),
    check("group_member_role_check", sql`${t.role} in ('Staff', 'Teaching Team')`),
    check("group_member_stream_check", sql`${t.stream} in ('STEM', 'Research')`),
    check(
      "group_member_stream_iff_teaching",
      sql`(${t.role} = 'Teaching Team') = (${t.stream} is not null)`,
    ),
    foreignKey({
      name: "group_member_person_role_fk",
      columns: [t.personId, t.role],
      foreignColumns: [person.id, person.role],
    }),
  ],
);

/**
 * The acquittal's line items. **The Advance is one pot and the acquittal reconciles the
 * pot** — a transaction consumes the Advance, not a person's share of it.
 *
 * `incurredByPersonId` does not contradict that. It is nullable because the question it
 * answers is only sometimes meaningful: the budget carries per-diems as `2 orang × N hari`
 * at different rates per role, so `Uang Harian` and `Honorarium Narasumber` have a person
 * and a taxi does not. Naming that person changes nothing about how the pot reconciles, so
 * ADR-0004's Staff-only rule is untouched.
 *
 * `category` is a closed set **read off DITSAMA's own approved budget** rather than
 * invented for a template nobody has read. The CHECK below is written out character for
 * character rather than composed from `TRANSACTION_CATEGORIES`, for the reason
 * `./index.ts` gives: a composed constraint string is not the one the drizzle-kit snapshot
 * holds, and the two would then diff forever.
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
    incurredByPersonId: uuid("incurred_by_person_id").references(() => person.id),
    createdByPersonId: uuid("created_by_person_id")
      .notNull()
      .references(() => person.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("transaction_amount_check", sql`${t.amountIdr} > 0`),
    check(
      "transaction_category_check",
      sql`${t.category} in ('Tiket Pesawat/Kereta PP', 'Uang Harian', 'Honorarium Narasumber', 'Akomodasi', 'Transport Bandara/Stasiun', 'Transport Lokal Dalam Provinsi', 'Konsumsi', 'Modul', 'ATK', 'Alat dan Bahan Research Project', 'Seminar kit', 'Lainnya')`,
    ),
  ],
);

/**
 * Many per transaction. `storagePath` is the object key in the private `receipts` bucket,
 * and it is **opaque** — a bare UUID naming no Perjadin, no transaction and no person.
 * A signed URL carries its object path inside the JWT it is signed with, so a structured
 * key would put the trip's identifiers into every link the screen renders.
 *
 * `unique` on it means one uploaded object can be attached exactly once.
 */
export const transactionEvidence = pgTable("transaction_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id")
    .notNull()
    .references(() => transaction.id, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull().unique(),
  contentType: text("content_type").notNull(),
  byteSize: bigint("byte_size", { mode: "number" }).notNull(),
  uploadedByPersonId: uuid("uploaded_by_person_id")
    .notNull()
    .references(() => person.id),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});
