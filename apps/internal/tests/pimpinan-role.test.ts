import { db, schema } from "@sugt/db";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addCluster,
  addPerjadin,
  addPerson,
  addSubCluster,
  refusedBy,
  resetDatabase,
} from "./support/fixtures";

/**
 * **Pimpinan is record-only, and the database is what makes it so** (#179).
 *
 * The role widened `person_role_check` and nothing else: every composite `(id, role)` foreign key
 * elsewhere in the schema still pins `role = 'Staff'`, so a Pimpinan can be *invited* but can never
 * occupy a working position — Group member, Perjadin PIC, Session-Record filer or Story author. This
 * suite runs against real Postgres, so those constraints actually fire: it proves the widened CHECK
 * admits a Pimpinan, then that the untouched composite keys refuse one wherever a role is denormalised.
 *
 * The `group_member` and `perjadin.pic` cases below exercise the whole mechanism. `session_record`
 * (`filed_by_role`) and `story` (`written_by_role`) are pinned to `'Staff'` by the *same* composite
 * `(person_id, role) → person(id, role)` foreign key, so they refuse a Pimpinan for exactly the
 * reason these two do; building their extra scaffolding (a delivered Session, a School) would not
 * exercise a different rule.
 */
describe("Pimpinan is record-only", () => {
  beforeEach(resetDatabase);

  it("admits a Pimpinan into person — the widened person_role_check permits the role", async () => {
    const pimpinan = await addPerson({
      fullName: "Prof. Pimpinan",
      email: "pimpinan@ditsama.itb.ac.id",
      role: "Pimpinan",
    });

    expect(pimpinan.role).toBe("Pimpinan");
  });

  it("refuses a Pimpinan as a group_member — the composite (id, role) FK pins Staff", async () => {
    const pic = await addPerson({
      fullName: "Rina Nurhayati",
      email: "rina@ditsama.itb.ac.id",
      role: "Staff",
    });
    const pimpinan = await addPerson({
      fullName: "Prof. Pimpinan",
      email: "pimpinan@ditsama.itb.ac.id",
      role: "Pimpinan",
    });
    const perjadin = await addPerjadin({ advanceIdr: 5_000_000, picPersonId: pic.id });

    // role: "Staff" satisfies group_member_role_check, so the refusal is the composite foreign key
    // itself — no `(pimpinan.id, 'Staff')` pair exists in `person`, because that Person is Pimpinan.
    const refusal = await refusedBy(
      db.insert(schema.groupMember).values({
        perjadinId: perjadin.id,
        personId: pimpinan.id,
        role: "Staff",
        stream: null,
      }),
    );

    expect(refusal).toBe("group_member_person_role_fk");
  });

  it("refuses a Pimpinan as a Perjadin PIC — perjadin_pic_is_staff pins Staff", async () => {
    const pimpinan = await addPerson({
      fullName: "Prof. Pimpinan",
      email: "pimpinan@ditsama.itb.ac.id",
      role: "Pimpinan",
    });
    const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
    const subCluster = await addSubCluster({
      slug: "kelompok-alpha",
      name: "Kelompok Alpha",
      clusterId: cluster.id,
    });

    // `pic_role` defaults to 'Staff', so the composite FK `perjadin_pic_is_staff` asks for a
    // `(pimpinan.id, 'Staff')` pair that does not exist and refuses the trip.
    const refusal = await refusedBy(
      db.insert(schema.perjadin).values({
        subClusterId: subCluster.id,
        destination: "Bandung",
        startsOn: "2026-09-01",
        endsOn: "2026-09-03",
        advanceIdr: 5_000_000,
        picPersonId: pimpinan.id,
      }),
    );

    expect(refusal).toBe("perjadin_pic_is_staff");
  });
});
