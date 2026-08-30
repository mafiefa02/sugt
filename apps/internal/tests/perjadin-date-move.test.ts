import { db, schema } from "@sugt/db";
import {
  planPerjadin,
  updatePerjadinLogistics,
  type PerjadinLogisticsInput,
} from "@sugt/db/queries";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addCluster,
  addOfflineSession,
  addPerjadin,
  addPerson,
  addProvince,
  addSchool,
  addSubCluster,
  resetDatabase,
} from "./support/fixtures";

/**
 * **A Perjadin's range is its departure and return dates** (ADR-0021), and the write side of #28's
 * invariant now lives on the logistics edit. The range is no longer typed: planning derives it from
 * the leg dates, and `updatePerjadinLogistics` resizes it when a leg date moves — clamping, never
 * shifting. An edit that would leave an **arranged** Session outside the new `[departure … return]`
 * window is refused whole (`would-strand`) and moves nothing; delivered and cancelled Sessions may
 * sit outside the window their trip now claims and do not block it.
 */

/** The Staff Person who is PIC of the trip. */
async function staff(email = "rina@ditsama.itb.ac.id") {
  return addPerson({ fullName: "Rina Nurhayati", email, role: "Staff" });
}

/** One School to hang Sessions off — the free-standing kind, for the `addPerjadin` fixtures below. */
async function oneSchool(slug = "sman-1-bandung") {
  await addProvince("JB", "Jawa Barat");
  const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
  return addSchool({ slug, name: "SMAN 1 Bandung", clusterId: cluster.id, provinceCode: "JB" });
}

/** The `held_on` a Session actually carries, read back rather than trusted. */
async function heldOnOf(sessionId: string) {
  const [row] = await db
    .select({ heldOn: schema.session.heldOn })
    .from(schema.session)
    .where(eq(schema.session.id, sessionId));
  return row?.heldOn ?? null;
}

/** The range a Perjadin actually carries, read back rather than trusted. */
async function windowOf(perjadinId: string) {
  const [row] = await db
    .select({ startsOn: schema.perjadin.startsOn, endsOn: schema.perjadin.endsOn })
    .from(schema.perjadin)
    .where(eq(schema.perjadin.id, perjadinId));
  return row ?? null;
}

/**
 * A whole `PerjadinLogisticsInput` around one pair of leg **dates** — the times, modes and return
 * zone are fixed, because these tests are about the dates that become the range. Departure is always
 * WIB and the write fixes it there regardless of what is passed.
 */
function logistics(departureDate: string, returnDate: string): PerjadinLogisticsInput {
  return {
    departureDate,
    departureTime: "07:30",
    departureMode: "Pesawat",
    returnDate,
    returnTime: "18:00",
    returnMode: "Pesawat",
    returnZone: "WIB",
  };
}

describe("Planning derives the range from the leg dates", () => {
  beforeEach(resetDatabase);

  it("writes starts_on/ends_on equal to the departure and return dates", async () => {
    const pic = await staff();
    await addProvince("JB", "Jawa Barat");
    const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
    const subCluster = await addSubCluster({
      slug: "alpha-bandung",
      name: "Kelompok Sekolah Bandung",
      clusterId: cluster.id,
    });
    const school = await addSchool({
      slug: "sman-1",
      name: "SMAN 1 Bandung",
      clusterId: cluster.id,
      subClusterId: subCluster.id,
      provinceCode: "JB",
    });

    const planned = await planPerjadin(pic, {
      subClusterId: subCluster.id,
      advanceIdr: 5_000_000,
      picPersonId: pic.id,
      teacherNames: [],
      pimpinan: [],
      sessions: [
        {
          schoolId: school.id,
          heldOn: "2026-09-02",
          startsAt: "09:00",
          stream: "STEM",
          taughtByTeacherIndexes: [],
        },
      ],
      departure: { date: "2026-09-01", time: "07:30", mode: "Pesawat" },
      return: { date: "2026-09-04", time: "18:00", mode: "Pesawat" },
    });
    if (planned.outcome !== "planned") throw new Error("fixture failed to plan");

    // The range is the leg dates, not a typed field — no input carried it.
    expect(await windowOf(planned.perjadinId)).toEqual({
      startsOn: "2026-09-01",
      endsOn: "2026-09-04",
    });
  });
});

describe("Editing a leg date resizes the range", () => {
  beforeEach(resetDatabase);

  it("recomputes starts_on/ends_on from the new leg dates", async () => {
    const pic = await staff();
    const school = await oneSchool();
    const perjadin = await addPerjadin({
      picPersonId: pic.id,
      advanceIdr: 5_000_000,
      startsOn: "2026-09-01",
      endsOn: "2026-09-05",
    });
    // A Session that stays inside the widened window, so the edit is not about stranding.
    await addOfflineSession({
      schoolId: school.id,
      heldOn: "2026-09-03",
      perjadinId: perjadin.id,
    });

    const result = await updatePerjadinLogistics(
      pic,
      perjadin.id,
      logistics("2026-09-01", "2026-09-08"),
    );

    expect(result).toEqual({ outcome: "updated" });
    // The range followed the return date; no separate field was touched.
    expect(await windowOf(perjadin.id)).toEqual({ startsOn: "2026-09-01", endsOn: "2026-09-08" });
  });

  it("refuses a leg-date change that would strand an arranged Session, moving nothing", async () => {
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

    // The return date pulls in to the 5th: the arranged Session on the 9th would fall outside the new
    // window. Clamp, not shift — the whole edit is refused and the Session is left where it is.
    const result = await updatePerjadinLogistics(
      pic,
      perjadin.id,
      logistics("2026-09-01", "2026-09-05"),
    );

    expect(result).toEqual({
      outcome: "would-strand",
      strandedCount: 1,
      startsOn: "2026-09-01",
      endsOn: "2026-09-05",
    });
    // Nothing changed: not the range, and not the Session's date.
    expect(await windowOf(perjadin.id)).toEqual({ startsOn: "2026-09-01", endsOn: "2026-09-10" });
    expect(await heldOnOf(session.id)).toBe("2026-09-09");
  });

  it("lets a delivered or cancelled Session outside the new window pass — the invariant is arranged-only", async () => {
    const pic = await staff();
    await addProvince("JB", "Jawa Barat");
    const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
    const [delivered, cancelled] = await Promise.all([
      addSchool({ slug: "sman-1", name: "SMAN 1", clusterId: cluster.id, provinceCode: "JB" }),
      addSchool({ slug: "sman-2", name: "SMAN 2", clusterId: cluster.id, provinceCode: "JB" }),
    ]);
    const perjadin = await addPerjadin({
      picPersonId: pic.id,
      advanceIdr: 5_000_000,
      startsOn: "2026-09-01",
      endsOn: "2026-09-10",
    });
    // Both sit on the 9th — outside the window the edit shrinks to — but neither is arranged, so
    // neither blocks the resize.
    const deliveredSession = await addOfflineSession({
      schoolId: delivered.id,
      heldOn: "2026-09-09",
      status: "delivered",
      perjadinId: perjadin.id,
    });
    const cancelledSession = await addOfflineSession({
      schoolId: cancelled.id,
      heldOn: "2026-09-09",
      status: "cancelled",
      perjadinId: perjadin.id,
    });

    const result = await updatePerjadinLogistics(
      pic,
      perjadin.id,
      logistics("2026-09-01", "2026-09-05"),
    );

    expect(result).toEqual({ outcome: "updated" });
    expect(await windowOf(perjadin.id)).toEqual({ startsOn: "2026-09-01", endsOn: "2026-09-05" });
    // The two out-of-window Sessions are left exactly where they were.
    expect(await heldOnOf(deliveredSession.id)).toBe("2026-09-09");
    expect(await heldOnOf(cancelledSession.id)).toBe("2026-09-09");
  });

  it("accepts a same-day trip — departure date equal to return date", async () => {
    const pic = await staff();
    const school = await oneSchool();
    const perjadin = await addPerjadin({
      picPersonId: pic.id,
      advanceIdr: 5_000_000,
      startsOn: "2026-09-01",
      endsOn: "2026-09-05",
    });
    await addOfflineSession({
      schoolId: school.id,
      heldOn: "2026-09-02",
      perjadinId: perjadin.id,
    });

    const result = await updatePerjadinLogistics(
      pic,
      perjadin.id,
      logistics("2026-09-02", "2026-09-02"),
    );

    expect(result).toEqual({ outcome: "updated" });
    expect(await windowOf(perjadin.id)).toEqual({ startsOn: "2026-09-02", endsOn: "2026-09-02" });
  });

  it("refuses a return date earlier than the departure date, before opening the transaction", async () => {
    const pic = await staff();
    await oneSchool();
    const perjadin = await addPerjadin({
      picPersonId: pic.id,
      advanceIdr: 5_000_000,
      startsOn: "2026-09-01",
      endsOn: "2026-09-05",
    });

    const result = await updatePerjadinLogistics(
      pic,
      perjadin.id,
      logistics("2026-09-05", "2026-09-01"),
    );

    expect(result).toEqual({ outcome: "return-before-departure" });
    // The range is untouched: the refusal comes before any write.
    expect(await windowOf(perjadin.id)).toEqual({ startsOn: "2026-09-01", endsOn: "2026-09-05" });
  });

  it("reports no-such-perjadin for an id that names no trip", async () => {
    const pic = await staff();

    const result = await updatePerjadinLogistics(
      pic,
      "00000000-0000-0000-0000-000000000000",
      logistics("2026-09-01", "2026-09-03"),
    );

    expect(result).toEqual({ outcome: "no-such-perjadin" });
  });
});
