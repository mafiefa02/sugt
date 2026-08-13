import { db, schema } from "@sugt/db";
import { isNotStaffError, movePerjadinDates } from "@sugt/db/queries";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addCluster,
  addOfflineSession,
  addPerjadin,
  addPerson,
  addProvince,
  addSchool,
  resetDatabase,
} from "./support/fixtures";

/**
 * **Moving a Perjadin's dates** — the other half of #28's invariant, and the write side #55
 * owns. Correcting a trip's dates offset-shifts its **arranged** Sessions so each stays inside
 * the new window; delivered and cancelled ones do not move; and a shrink that would strand an
 * arranged Session is refused whole, leaving the trip and its Sessions untouched.
 */

/** The Staff Person who is PIC of the trip. */
async function staff(email = "rina@ditsama.itb.ac.id") {
  return addPerson({ fullName: "Rina Nurhayati", email, role: "Staff" });
}

/** One School to hang Sessions off. */
async function oneSchool(slug = "sman-1-bandung") {
  await addProvince("JB", "Jawa Barat");
  const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
  return addSchool({ slug, name: "SMAN 1 Bandung", clusterId: cluster.id, provinceCode: "JB" });
}

/**
 * Three Schools under one Cluster. A trip visits a School at most once —
 * `session_one_per_school_per_perjadin` — so a trip with three Sessions needs three Schools.
 */
async function threeSchools() {
  await addProvince("JB", "Jawa Barat");
  const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
  return Promise.all([
    addSchool({
      slug: "sman-1-bandung",
      name: "SMAN 1 Bandung",
      clusterId: cluster.id,
      provinceCode: "JB",
    }),
    addSchool({
      slug: "sman-2-bandung",
      name: "SMAN 2 Bandung",
      clusterId: cluster.id,
      provinceCode: "JB",
    }),
    addSchool({
      slug: "sman-3-bandung",
      name: "SMAN 3 Bandung",
      clusterId: cluster.id,
      provinceCode: "JB",
    }),
  ]);
}

/** The `held_on` a Session actually carries, read back rather than trusted. */
async function heldOnOf(sessionId: string) {
  const [row] = await db
    .select({ heldOn: schema.session.heldOn })
    .from(schema.session)
    .where(eq(schema.session.id, sessionId));
  return row?.heldOn ?? null;
}

/** The window a Perjadin actually carries, read back rather than trusted. */
async function windowOf(perjadinId: string) {
  const [row] = await db
    .select({ startsOn: schema.perjadin.startsOn, endsOn: schema.perjadin.endsOn })
    .from(schema.perjadin)
    .where(eq(schema.perjadin.id, perjadinId));
  return row ?? null;
}

describe("Moving a Perjadin's dates", () => {
  beforeEach(resetDatabase);

  it("offset-shifts arranged Sessions so each stays inside the moved window", async () => {
    const pic = await staff();
    const school = await oneSchool();
    const perjadin = await addPerjadin({
      picPersonId: pic.id,
      advanceIdr: 5_000_000,
      startsOn: "2026-09-01",
      endsOn: "2026-09-03",
    });
    const session = await addOfflineSession({
      schoolId: school.id,
      heldOn: "2026-09-02",
      perjadinId: perjadin.id,
    });

    // The trip moves a week later, start and end together: a pure translation of +7 days.
    const result = await movePerjadinDates(pic, perjadin.id, "2026-09-08", "2026-09-10");

    expect(result).toEqual({ outcome: "moved", sessionsShifted: 1 });
    expect(await heldOnOf(session.id)).toBe("2026-09-09");
    expect(await windowOf(perjadin.id)).toEqual({ startsOn: "2026-09-08", endsOn: "2026-09-10" });
  });

  it("leaves delivered and cancelled Sessions where they are", async () => {
    const pic = await staff();
    const [s1, s2, s3] = await threeSchools();
    const perjadin = await addPerjadin({
      picPersonId: pic.id,
      advanceIdr: 5_000_000,
      startsOn: "2026-09-01",
      endsOn: "2026-09-05",
    });
    const arranged = await addOfflineSession({
      schoolId: s1!.id,
      heldOn: "2026-09-02",
      perjadinId: perjadin.id,
    });
    const delivered = await addOfflineSession({
      schoolId: s2!.id,
      heldOn: "2026-09-03",
      status: "delivered",
      perjadinId: perjadin.id,
    });
    const cancelled = await addOfflineSession({
      schoolId: s3!.id,
      heldOn: "2026-09-04",
      status: "cancelled",
      perjadinId: perjadin.id,
    });

    const result = await movePerjadinDates(pic, perjadin.id, "2026-09-11", "2026-09-15");

    // Only the arranged Session shifts (+10). The delivered and cancelled ones stay put — a
    // delivered Session may legitimately sit outside the window its trip now claims.
    expect(result).toEqual({ outcome: "moved", sessionsShifted: 1 });
    expect(await heldOnOf(arranged.id)).toBe("2026-09-12");
    expect(await heldOnOf(delivered.id)).toBe("2026-09-03");
    expect(await heldOnOf(cancelled.id)).toBe("2026-09-04");
  });

  it("refuses a shrink that would strand an arranged Session, changing nothing", async () => {
    const pic = await staff();
    const school = await oneSchool();
    const perjadin = await addPerjadin({
      picPersonId: pic.id,
      advanceIdr: 5_000_000,
      startsOn: "2026-09-01",
      endsOn: "2026-09-10",
    });
    const session = await addOfflineSession({
      schoolId: school.id,
      heldOn: "2026-09-09",
      perjadinId: perjadin.id,
    });

    // Start stays, end pulls in to the 5th: the Session does not shift (delta 0) and 09-09 now
    // falls outside. The whole edit is refused rather than stranding it.
    const result = await movePerjadinDates(pic, perjadin.id, "2026-09-01", "2026-09-05");

    expect(result).toEqual({
      outcome: "would-strand",
      strandedCount: 1,
      startsOn: "2026-09-01",
      endsOn: "2026-09-05",
    });
    // One transaction: neither the trip nor the Session changed.
    expect(await windowOf(perjadin.id)).toEqual({ startsOn: "2026-09-01", endsOn: "2026-09-10" });
    expect(await heldOnOf(session.id)).toBe("2026-09-09");
  });

  it("refuses a Teaching Team caller, because a trip's dates gate its Sessions", async () => {
    const pic = await staff();
    const teacher = await addPerson({
      fullName: "Bagus Prakoso",
      email: "bagus@itb.ac.id",
      role: "Teaching Team",
    });
    const perjadin = await addPerjadin({
      picPersonId: pic.id,
      advanceIdr: 5_000_000,
      startsOn: "2026-09-01",
      endsOn: "2026-09-03",
    });

    await expect(
      movePerjadinDates(teacher, perjadin.id, "2026-09-08", "2026-09-10"),
    ).rejects.toSatisfy(isNotStaffError);
  });

  it("reports no-such-perjadin for an id that names no trip", async () => {
    const pic = await staff();

    const result = await movePerjadinDates(
      pic,
      "00000000-0000-0000-0000-000000000000",
      "2026-09-01",
      "2026-09-03",
    );

    expect(result).toEqual({ outcome: "no-such-perjadin" });
  });
});
