import type { Role, Stream } from "@sugt/domain";
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
    destination: text("destination").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),

    advanceIdr: bigint("advance_idr", { mode: "number" }).notNull(),

    picPersonId: uuid("pic_person_id").notNull(),
    picRole: text("pic_role").notNull().default("Staff"),

    returnedToTreasurerIdr: bigint("returned_to_treasurer_idr", { mode: "number" }),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    reportFiledAt: timestamp("report_filed_at", { withTimezone: true }),
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
 * The acquittal's line items. **A transaction is not attributed to a person** — the
 * Advance is one pot and the acquittal reconciles the pot.
 *
 * There is no category column. `CONTEXT.md` records that the real paperwork (Surat
 * Tugas, SPPD, SPJ or otherwise) has not been confirmed against actual documents, and
 * designing columns for a template nobody has read produces fields that do not fit it.
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
    createdByPersonId: uuid("created_by_person_id")
      .notNull()
      .references(() => person.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("transaction_amount_check", sql`${t.amountIdr} > 0`)],
);

/** Many per transaction. `storagePath` is the object key in the private `receipts` bucket. */
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
