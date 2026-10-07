import { randomUUID } from "node:crypto";

import { activityLogAksi, activityLogRincian, type ActivityLogEntry } from "@sugt/db/queries";
import { describe, expect, it } from "vitest";

import {
  applyRemainingMigrations,
  scratchDatabaseThrough,
  withClient,
} from "./support/scratch-database";

/**
 * **Migration 0039 backfills the Activity Log** (#395) from the two tables that already record who
 * and when. Each existing line becomes a `transaction_recorded` entry at its `created_at`, counting
 * the receipts inserted with it — same database transaction, so the same `now()` — and every
 * later Unggah bukti batch (one uploader, one `uploaded_at`) becomes an `evidence_uploaded` entry.
 * All are `backfilled`, carry the actor's current email, and hold the `search_text` the app would
 * render.
 *
 * The seed skips foreign keys (`session_replication_role = replica`): the backfill reads `person`,
 * `transaction` and `transaction_evidence` and nothing else.
 */

const scratch = scratchDatabaseThrough("0038_evaluation_role_narasumber");

const RINA = randomUUID();
const BUDI = randomUUID();
const TRIP = randomUUID();
const LINE = randomUUID();
const OLD_LINE = randomUUID();
const RECORDED_AT = "2026-10-13 14:40:00+00";

async function seed() {
  await withClient(scratch.url, (sql) =>
    sql.begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`
        insert into person (id, full_name, email, role) values
          (${RINA}, 'Rina Setiawati', 'rina@ditsama.itb.ac.id', 'Staff'),
          (${BUDI}, 'Budi Hartono', 'budi@ditsama.itb.ac.id', 'Staff')`;
      await tx`
        insert into perjadin (id, sub_cluster_id, destination, starts_on, ends_on, advance_idr, pic_person_id)
        values (${TRIP}, ${randomUUID()}, 'Kelompok 18: Samarinda', '2026-10-12', '2026-10-15', 15000000, ${RINA})`;
      // A line recorded with two receipts, then given one more by Budi in a later Unggah bukti.
      await tx`
        insert into transaction
          (id, perjadin_id, spent_on, description, amount_idr, category, participant_type, created_by_person_id, created_at)
        values
          (${LINE}, ${TRIP}, '2026-10-12', 'Makan siang', 1250000, 'Konsumsi', 'Siswa', ${RINA}, ${RECORDED_AT}),
          (${OLD_LINE}, ${TRIP}, '2026-09-18', 'Tiket', 3400000, 'Tiket Pesawat/Kereta PP', 'GTK-MS', ${BUDI}, '2026-09-20 07:02:00+00')`;
      await tx`
        insert into transaction_evidence
          (transaction_id, drive_file_id, content_type, byte_size, uploaded_by_person_id, uploaded_at)
        values
          (${LINE}, ${randomUUID()}, 'image/jpeg', 1, ${RINA}, ${RECORDED_AT}),
          (${LINE}, ${randomUUID()}, 'image/jpeg', 1, ${RINA}, ${RECORDED_AT}),
          (${LINE}, ${randomUUID()}, 'image/jpeg', 1, ${BUDI}, '2026-10-14 01:05:00+00'),
          -- A line from before ADR-0039, recorded bare and evidenced twice later, by two people at
          -- one instant: two batches, since a batch is one uploader's.
          (${OLD_LINE}, ${randomUUID()}, 'application/pdf', 1, ${BUDI}, '2026-09-21 01:00:00+00'),
          (${OLD_LINE}, ${randomUUID()}, 'application/pdf', 1, ${BUDI}, '2026-09-21 01:00:00+00'),
          (${OLD_LINE}, ${randomUUID()}, 'application/pdf', 1, ${RINA}, '2026-09-21 01:00:00+00')`;
    }),
  );
}

type LoggedRow = {
  occurred_at: Date;
  actor_person_id: string;
  actor_email: string;
  perjadin_id: string;
  action: ActivityLogEntry["action"];
  details: Record<string, unknown>;
  search_text: string;
  backfilled: boolean;
};

describe("0039_activity_log", () => {
  it("derives Catat transaksi and Unggah bukti entries from the existing rows", async () => {
    await seed();
    // The current email is the best the backfill has: Budi's changed after he acted.
    await withClient(
      scratch.url,
      (sql) => sql`update person set email = 'budi.baru@ditsama.itb.ac.id' where id = ${BUDI}`,
    );

    await applyRemainingMigrations(scratch.url);

    const rows = await withClient(
      scratch.url,
      (sql) => sql<LoggedRow[]>`
        select occurred_at, actor_person_id, actor_email, perjadin_id, action, details, search_text,
          backfilled
        from activity_log
        order by occurred_at, actor_person_id`,
    );

    const lines = (rows: LoggedRow[]) =>
      rows.map((row) => ({
        at: row.occurred_at.toISOString(),
        by: row.actor_email,
        action: row.action,
        details: row.details,
      }));
    const [first, second] = [RINA, BUDI].sort();
    const byEmail = { [RINA]: "rina@ditsama.itb.ac.id", [BUDI]: "budi.baru@ditsama.itb.ac.id" };

    expect(lines(rows)).toEqual([
      {
        at: "2026-09-20T07:02:00.000Z",
        by: "budi.baru@ditsama.itb.ac.id",
        action: "transaction_recorded",
        details: {
          transactionId: OLD_LINE,
          category: "Tiket Pesawat/Kereta PP",
          amountIdr: 3_400_000,
          participantType: "GTK-MS",
          spentOn: "2026-09-18",
          receiptCount: 0,
        },
      },
      // Two uploaders at one instant: one batch each, both counting the line's three receipts.
      ...[first!, second!].map((actor) => ({
        at: "2026-09-21T01:00:00.000Z",
        by: byEmail[actor],
        action: "evidence_uploaded",
        details: {
          transactionId: OLD_LINE,
          category: "Tiket Pesawat/Kereta PP",
          amountIdr: 3_400_000,
          spentOn: "2026-09-18",
          added: actor === BUDI ? 2 : 1,
          total: 3,
        },
      })),
      {
        at: "2026-10-13T14:40:00.000Z",
        by: "rina@ditsama.itb.ac.id",
        action: "transaction_recorded",
        details: {
          transactionId: LINE,
          category: "Konsumsi",
          amountIdr: 1_250_000,
          participantType: "Siswa",
          spentOn: "2026-10-12",
          receiptCount: 2,
        },
      },
      {
        at: "2026-10-14T01:05:00.000Z",
        by: "budi.baru@ditsama.itb.ac.id",
        action: "evidence_uploaded",
        details: {
          transactionId: LINE,
          category: "Konsumsi",
          amountIdr: 1_250_000,
          spentOn: "2026-10-12",
          added: 1,
          total: 3,
        },
      },
    ]);

    for (const row of rows) {
      expect(row.backfilled).toBe(true);
      expect(row.perjadin_id).toBe(TRIP);
      // The SQL rendering matches the app's, so search finds a backfilled row by what it shows.
      const entry = { action: row.action, details: row.details } as ActivityLogEntry;
      expect(row.search_text).toBe(
        `${activityLogAksi(row.action, true)} · ${activityLogRincian(entry)}`.toLowerCase(),
      );
    }
    expect(rows[0]?.search_text).toBe(
      "catat transaksi (dari data lama) · tiket pesawat/kereta pp · rp3.400.000 · gtk-ms · tgl 2026-09-18 · 0 bukti",
    );
  });

  it("applies to an empty database and logs nothing", async () => {
    await applyRemainingMigrations(scratch.url);

    const [counted] = await withClient(
      scratch.url,
      (sql) => sql<{ count: string }[]>`select count(*) from activity_log`,
    );
    expect(counted?.count).toBe("0");
  });
});
