import { describe, expect, it } from "vitest";

import {
  applyRemainingMigrations,
  scratchDatabaseThrough,
  withClient,
} from "./support/scratch-database";

/**
 * **Migration 0038 renames the stored Perjadin Evaluation role** (#393, ADR-0024's amendment). The
 * self-declared `Pengajar` is `Narasumber` now, so an evaluation filed before the rename must read
 * `Narasumber` after it — the update sits between dropping the old CHECK and adding the new one.
 *
 * Each test makes a scratch database migrated to 0037 (`scratchDatabaseThrough`), seeds
 * `perjadin_evaluation` as it stood then, and applies the rest. The seed skips the foreign key
 * (`session_replication_role = replica`): the rename reads this one table.
 */

const scratch = scratchDatabaseThrough("0037_perjadin_drops_travel_legs");

/** One evaluation per role, as filed before 0038. */
async function seed(roles: string[]) {
  await withClient(scratch.url, async (sql) => {
    await sql.begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      for (const role of roles) {
        await tx`
          insert into perjadin_evaluation
            (perjadin_id, filed_by_role, filed_by_name, lodging, transport, meals, punctuality)
          values (gen_random_uuid(), ${role}, ${`Filer ${role}`}, 9, 9, 9, 9)`;
      }
    });
  });
}

describe("0038_evaluation_role_narasumber", () => {
  it("rewrites every stored 'Pengajar' to 'Narasumber' and leaves the other roles alone", async () => {
    await seed(["Pengajar", "Pengajar", "Pendamping", "Pimpinan"]);

    await applyRemainingMigrations(scratch.url);

    const roles = await withClient(
      scratch.url,
      (sql) => sql<{ filed_by_role: string }[]>`select filed_by_role from perjadin_evaluation`,
    );
    expect(roles.map((row) => row.filed_by_role).sort()).toEqual([
      "Narasumber",
      "Narasumber",
      "Pendamping",
      "Pimpinan",
    ]);
  });
});
