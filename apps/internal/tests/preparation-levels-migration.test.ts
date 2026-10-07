import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { COMPANY_PREPARATION_ITEMS, RETIRED_PREPARATION_ITEMS } from "./support/fixtures";
import {
  applyRemainingMigrations,
  scratchDatabaseThrough,
  withClient,
} from "./support/scratch-database";

/**
 * **Migration 0043 moves the Preparation Checklist into the database** (#421, ADR-0045), and does
 * the cutover itself, since the populated remote database cannot be re-seeded.
 *
 * Seeded as it stood at 0042 — ticks keyed by `item_key`, including the orphans older models left —
 * then migrated: the six become `semua` items added long ago and removed today (WIB), keeping their
 * ticks; the orphans are dropped; the 14 are added today, the second carrying the Teaching-Team
 * flag; and `perjadin_preparation_item` is gone. The seed skips foreign keys
 * (`session_replication_role = replica`) for the tables the cutover does not read.
 */

const scratch = scratchDatabaseThrough("0042_school_slot_across_perjadins");

const RINA = randomUUID();
const TRIP = randomUUID();
const OTHER_TRIP = randomUUID();

describe("0043_preparation_levels", () => {
  it("retires the six with their ticks, drops the orphans and adds the company's 14", async () => {
    await withClient(scratch.url, (sql) =>
      sql.begin(async (tx) => {
        await tx`set local session_replication_role = replica`;
        await tx`
          insert into person (id, full_name, email, role)
          values (${RINA}, 'Rina Setiawati', 'rina@ditsama.itb.ac.id', 'Staff')`;
        await tx`
          insert into perjadin (id, sub_cluster_id, starts_on, ends_on, advance_idr, pic_person_id)
          values
            (${TRIP}, ${randomUUID()}, '2026-09-01', '2026-09-03', 1000000, ${RINA}),
            (${OTHER_TRIP}, ${randomUUID()}, '2026-09-08', '2026-09-10', 1000000, ${RINA})`;
        await tx`
          insert into perjadin_preparation_item (perjadin_id, item_key, checked_by, checked_at)
          values
            (${TRIP}, 'sk_perjalanan', ${RINA}, '2026-08-20 03:00:00+00'),
            (${TRIP}, 'pengajar_lengkap', ${RINA}, '2026-08-21 03:00:00+00'),
            (${TRIP}, 'dosen:someone', ${RINA}, '2026-08-21 03:00:00+00'),
            (${TRIP}, 'tiket_keberangkatan', ${RINA}, '2026-08-21 03:00:00+00'),
            (${OTHER_TRIP}, 'staff', ${RINA}, '2026-09-01 03:00:00+00')`;
      }),
    );

    await applyRemainingMigrations(scratch.url);

    await withClient(scratch.url, async (sql) => {
      const [{ today }] = await sql<{ today: string }[]>`
        select to_char((now() at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD') as today`;
      const items = await sql<
        {
          id: string;
          label: string;
          level: string;
          added_on: string;
          removed_on: string | null;
          system: boolean;
        }[]
      >`
        select id, label, level, to_char(added_on, 'YYYY-MM-DD') as added_on,
               to_char(removed_on, 'YYYY-MM-DD') as removed_on,
               clears_on_teaching_team_change as system
          from preparation_item order by removed_on nulls last, position`;

      const retired = items.filter((item) => item.removed_on !== null);
      expect(retired.map((item) => item.label)).toEqual(RETIRED_PREPARATION_ITEMS);
      expect(retired.every((item) => item.removed_on === today && item.added_on < today)).toBe(
        true,
      );

      const company = items.filter((item) => item.removed_on === null);
      expect(company.map((item) => item.label)).toEqual(COMPANY_PREPARATION_ITEMS);
      expect(company.every((item) => item.added_on === today && item.level === "semua")).toBe(true);
      expect(company.filter((item) => item.system).map((item) => item.label)).toEqual([
        "Fiksasi Dosen/Narasumber oleh PIC Dosen",
      ]);

      // The three real ticks moved, who and when kept; the two orphans did not.
      const ticks = await sql<{ perjadin_id: string; label: string; checked_at: Date }[]>`
        select t.perjadin_id, i.label, t.checked_at
          from perjadin_preparation_tick t join preparation_item i on i.id = t.preparation_item_id
         order by t.perjadin_id = ${TRIP} desc, i.position`;
      expect(ticks.map((tick) => [tick.perjadin_id, tick.label])).toEqual([
        [TRIP, "SK Perjalanan"],
        [TRIP, "Narasumber sudah lengkap"],
        [OTHER_TRIP, "Konfirmasi dengan para Pendamping"],
      ]);
      expect(ticks[0]?.checked_at.toISOString()).toBe("2026-08-20T03:00:00.000Z");

      const [{ old }] = await sql<{ old: string | null }[]>`
        select to_regclass('public.perjadin_preparation_item')::text as old`;
      expect(old).toBeNull();
    });
  });
});
