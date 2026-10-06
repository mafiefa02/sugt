import { db, schema } from "@sugt/db";
import { myPerjadin, perjadinAcquittal } from "@sugt/db/queries";
import type { Person } from "@sugt/db/queries";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addCluster,
  addOfflineSession,
  addPerjadin,
  addPerson,
  addProvince,
  addSchool,
  addSubCluster,
  addTransaction,
  resetDatabase,
} from "./support/fixtures";

/**
 * **The caller's own trips** (#197, #396). The read is scoped *by* the caller — only trips they are
 * a `group_member` of — and split at WIB "today" into the current trips, soonest first, and the
 * previous ones, most recently ended first. Each carries its money, its Group/teachers/Pimpinan
 * and its visited Schools.
 */

/** A `Person` shaped the way the query layer takes one, from an inserted `person` row. */
function asPerson(row: { id: string; fullName: string; email: string }): Person {
  return { id: row.id, fullName: row.fullName, email: row.email, role: "Staff", grants: [] };
}

/**
 * A calendar date `offset` days from today, `YYYY-MM-DD`. Computed in UTC and used only with
 * margins of several days, so the up-to-seven-hour skew between UTC and the query's WIB "today"
 * never lands a fixture on the wrong side of the cutoff.
 */
function daysFromToday(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/**
 * Today in the query's own zone (WIB), `YYYY-MM-DD` — the exact day the `ends_on >= today` cutoff
 * compares against, so a trip ending on it sits *on* the inclusive boundary. `en-CA` renders ISO.
 */
function wibToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

/** `offset` days from today in WIB, `YYYY-MM-DD` — exact, for a fixture on a boundary. */
function wibDaysFromToday(offset: number): string {
  const d = new Date(`${wibToday()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Put the caller on a trip whose PIC is someone else — the membership this read filters by. */
async function addGroupMember(perjadinId: string, personId: string) {
  await db.insert(schema.groupMember).values({ perjadinId, personId, role: "Staff", stream: null });
}

describe("myPerjadin returns only the caller's own trips", () => {
  beforeEach(resetDatabase);

  it("keeps trips the caller leads or merely joined, in both sections, and drops the rest", async () => {
    const caller = asPerson(
      await addPerson({ fullName: "Rina", email: "rina@ditsama.itb.ac.id", role: "Staff" }),
    );
    const other = await addPerson({
      fullName: "Budi",
      email: "budi@ditsama.itb.ac.id",
      role: "Staff",
    });

    // Led by the caller — they are a member by the deferred PIC-is-a-member FK the fixture honours.
    const led = await addPerjadin({
      picPersonId: caller.id,
      advanceIdr: 1_000_000,
      startsOn: daysFromToday(2),
      endsOn: daysFromToday(6),
    });
    // Led by someone else, but the caller is added to the Group — one current, one past.
    const joined = await addPerjadin({
      picPersonId: other.id,
      advanceIdr: 1_000_000,
      startsOn: daysFromToday(3),
      endsOn: daysFromToday(7),
    });
    await addGroupMember(joined.id, caller.id);
    const joinedPast = await addPerjadin({
      picPersonId: other.id,
      advanceIdr: 1_000_000,
      startsOn: daysFromToday(-20),
      endsOn: daysFromToday(-15),
    });
    await addGroupMember(joinedPast.id, caller.id);
    // Led by someone else and the caller is nowhere on them — excluded, current and past alike.
    await addPerjadin({
      picPersonId: other.id,
      advanceIdr: 1_000_000,
      startsOn: daysFromToday(4),
      endsOn: daysFromToday(8),
    });
    await addPerjadin({
      picPersonId: other.id,
      advanceIdr: 1_000_000,
      startsOn: daysFromToday(-30),
      endsOn: daysFromToday(-25),
    });

    const trips = await myPerjadin(caller);

    expect(trips.current.map((t) => t.id).sort()).toEqual([led.id, joined.id].sort());
    expect(trips.previous.map((t) => t.id)).toEqual([joinedPast.id]);
  });

  it("returns two empty sections for a caller on no trip", async () => {
    const caller = asPerson(
      await addPerson({ fullName: "Rina", email: "rina@ditsama.itb.ac.id", role: "Staff" }),
    );
    await expect(myPerjadin(caller)).resolves.toEqual({ current: [], previous: [] });
  });
});

describe("myPerjadin splits at today (WIB) and orders each section", () => {
  beforeEach(resetDatabase);

  it("puts current trips soonest first and previous trips most recently ended first", async () => {
    const caller = asPerson(
      await addPerson({ fullName: "Rina", email: "rina@ditsama.itb.ac.id", role: "Staff" }),
    );
    const trip = (startsOn: number, endsOn: number) =>
      addPerjadin({
        picPersonId: caller.id,
        advanceIdr: 1_000_000,
        startsOn: daysFromToday(startsOn),
        endsOn: daysFromToday(endsOn),
      });

    const future = await trip(20, 25);
    const inProgress = await trip(-5, 5);
    const longAgo = await trip(-40, -30);
    // Two that ended the same day: the one that started later comes first.
    const recentShort = await trip(-8, -6);
    const recentLong = await trip(-12, -6);

    const trips = await myPerjadin(caller);

    expect(trips.current.map((t) => t.id)).toEqual([inProgress.id, future.id]);
    expect(trips.previous.map((t) => t.id)).toEqual([recentShort.id, recentLong.id, longAgo.id]);
  });

  it("keeps a trip ending exactly today current, and one that ended yesterday previous", async () => {
    const caller = asPerson(
      await addPerson({ fullName: "Rina", email: "rina@ditsama.itb.ac.id", role: "Staff" }),
    );
    // ends_on is today in the query's own WIB zone, so the trip sits on the inclusive boundary: a
    // `> today` cutoff would drop it, `>= today` keeps it.
    const endsToday = await addPerjadin({
      picPersonId: caller.id,
      advanceIdr: 1_000_000,
      startsOn: daysFromToday(-3),
      endsOn: wibToday(),
    });
    const endedYesterday = await addPerjadin({
      picPersonId: caller.id,
      advanceIdr: 1_000_000,
      startsOn: daysFromToday(-10),
      endsOn: wibDaysFromToday(-1),
    });

    const trips = await myPerjadin(caller);

    expect(trips.current.map((t) => t.id)).toEqual([endsToday.id]);
    expect(trips.previous.map((t) => t.id)).toEqual([endedYesterday.id]);
  });
});

describe("myPerjadin gives the PIC and a member the same card", () => {
  beforeEach(resetDatabase);

  it("carries no Laporan state, so a PIC's card has nothing a member's lacks (#419)", async () => {
    const caller = asPerson(
      await addPerson({ fullName: "Rina", email: "rina@ditsama.itb.ac.id", role: "Staff" }),
    );
    const other = await addPerson({
      fullName: "Budi",
      email: "budi@ditsama.itb.ac.id",
      role: "Staff",
    });
    // Ended three days ago with nothing filed: the trip that used to carry the red overdue line.
    const led = await addPerjadin({
      picPersonId: caller.id,
      advanceIdr: 1_000_000,
      startsOn: wibDaysFromToday(-6),
      endsOn: wibDaysFromToday(-3),
    });
    const joined = await addPerjadin({
      picPersonId: other.id,
      advanceIdr: 1_000_000,
      startsOn: wibDaysFromToday(-8),
      endsOn: wibDaysFromToday(-5),
    });
    await addGroupMember(joined.id, caller.id);

    const { previous } = await myPerjadin(caller);
    const ledCard = previous.find((trip) => trip.id === led.id);
    const joinedCard = previous.find((trip) => trip.id === joined.id);

    expect(ledCard).not.toHaveProperty("report");
    expect(Object.keys(ledCard ?? {}).toSorted()).toEqual(Object.keys(joinedCard ?? {}).toSorted());
  });
});

describe("myPerjadin carries the same money as the acquittal", () => {
  beforeEach(resetDatabase);

  it("draws the float down only for drawdown categories and agrees with the acquittal's remainder", async () => {
    // ADR-0029: only Konsumsi/Lainnya draw down. A Konsumsi 1.2M draws down; a non-drawdown Akomodasi
    // 300k does not — so drawnDownIdr is 1.2M, not the 1.5M full spend, and Tersisa = advance − 1.2M.
    const caller = asPerson(
      await addPerson({ fullName: "Rina", email: "rina@ditsama.itb.ac.id", role: "Staff" }),
    );
    const trip = await addPerjadin({
      picPersonId: caller.id,
      advanceIdr: 5_000_000,
      startsOn: daysFromToday(1),
      endsOn: daysFromToday(4),
    });
    await addTransaction({
      perjadinId: trip.id,
      amountIdr: 1_200_000,
      category: "Konsumsi",
      createdByPersonId: caller.id,
    });
    await addTransaction({
      perjadinId: trip.id,
      amountIdr: 300_000,
      category: "Akomodasi",
      createdByPersonId: caller.id,
    });

    const {
      current: [mine],
    } = await myPerjadin(caller);
    const acquittal = await perjadinAcquittal(caller, trip.id);
    if (!mine || !acquittal) throw new Error("expected the trip on both reads");

    expect(mine.advanceIdr).toBe(5_000_000);
    expect(mine.drawnDownIdr).toBe(1_200_000);
    // The acquittal still logs the full 1.5M spend, but its remainder draws down only the 1.2M.
    expect(acquittal.spentIdr).toBe(1_500_000);
    expect(mine.advanceIdr - mine.drawnDownIdr).toBe(acquittal.remainderIdr);
  });

  it("draws nothing down for a trip with no transactions", async () => {
    const caller = asPerson(
      await addPerson({ fullName: "Rina", email: "rina@ditsama.itb.ac.id", role: "Staff" }),
    );
    const trip = await addPerjadin({
      picPersonId: caller.id,
      advanceIdr: 2_000_000,
      startsOn: daysFromToday(1),
      endsOn: daysFromToday(4),
    });

    const {
      current: [mine],
    } = await myPerjadin(caller);
    expect(mine?.id).toBe(trip.id);
    expect(mine?.drawnDownIdr).toBe(0);
  });
});

describe("myPerjadin lists the trip's members", () => {
  beforeEach(resetDatabase);

  it("returns staff, pengajar and pimpinan in name order with a combined total", async () => {
    const caller = asPerson(
      await addPerson({ fullName: "Rina", email: "rina@ditsama.itb.ac.id", role: "Staff" }),
    );
    // Extra Staff — name orders before the caller's "Rina".
    const anwar = await addPerson({
      fullName: "Anwar",
      email: "anwar@ditsama.itb.ac.id",
      role: "Staff",
    });
    // A record-only Pimpinan (#181), a real Person of role Pimpinan.
    const pimpinan = await addPerson({
      fullName: "Pak Joko",
      email: "joko@ditsama.itb.ac.id",
      role: "Pimpinan",
    });

    const trip = await addPerjadin({
      picPersonId: caller.id,
      advanceIdr: 1_000_000,
      startsOn: daysFromToday(1),
      endsOn: daysFromToday(4),
      pimpinan: [pimpinan.id],
    });
    await addGroupMember(trip.id, anwar.id);
    // Trip-scoped teacher names (ADR-0020), inserted out of name order to prove the sort.
    await db.insert(schema.perjadinTeacher).values([
      { perjadinId: trip.id, name: "Sri Wahyuni" },
      { perjadinId: trip.id, name: "Dr. Agus" },
    ]);

    const {
      current: [mine],
    } = await myPerjadin(caller);
    if (!mine) throw new Error("expected the trip");

    // Staff in name order; the caller is flagged PIC, the extra Staff is not.
    expect(mine.anggota.staff).toEqual([
      { personId: anwar.id, fullName: "Anwar", isPic: false },
      { personId: caller.id, fullName: "Rina", isPic: true },
    ]);
    expect(mine.anggota.pengajar.map((p) => p.name)).toEqual(["Dr. Agus", "Sri Wahyuni"]);
    expect(mine.anggota.pimpinan).toEqual([{ personId: pimpinan.id, name: "Pak Joko" }]);
    // 2 staff + 2 pengajar + 1 pimpinan.
    expect(mine.anggota.anggotaTotal).toBe(5);
  });
});

describe("myPerjadin builds the visited-Schools tree", () => {
  beforeEach(resetDatabase);

  it("groups offline Sessions by School and includes a cancelled one", async () => {
    const caller = asPerson(
      await addPerson({ fullName: "Rina", email: "rina@ditsama.itb.ac.id", role: "Staff" }),
    );
    await addProvince("SU", "Sulawesi Utara", "WITA");
    const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
    const subCluster = await addSubCluster({
      slug: "alpha-1",
      name: "Kelompok 1",
      clusterId: cluster.id,
    });
    // Two Schools, named so "SMAN A" sorts before "SMAN B".
    const schoolA = await addSchool({
      slug: "sman-a",
      name: "SMAN A",
      clusterId: cluster.id,
      subClusterId: subCluster.id,
      provinceCode: "SU",
      kabupatenKota: "Kota Manado",
    });
    const schoolB = await addSchool({
      slug: "sman-b",
      name: "SMAN B",
      clusterId: cluster.id,
      subClusterId: subCluster.id,
      provinceCode: "SU",
    });

    // Captured once, so an assertion cannot straddle a UTC midnight the inserts fell before.
    const [heldA1, heldA2, heldB] = [daysFromToday(2), daysFromToday(3), daysFromToday(4)];
    const trip = await addPerjadin({
      picPersonId: caller.id,
      subClusterId: subCluster.id,
      advanceIdr: 1_000_000,
      startsOn: daysFromToday(1),
      endsOn: daysFromToday(6),
    });
    // School A: an arranged Session and, later, a cancelled one — the cancelled one is included.
    const arranged = await addOfflineSession({
      schoolId: schoolA.id,
      heldOn: heldA1,
      startsAt: "09:00",
      perjadinId: trip.id,
    });
    const cancelled = await addOfflineSession({
      schoolId: schoolA.id,
      heldOn: heldA2,
      startsAt: "09:00",
      status: "cancelled",
      perjadinId: trip.id,
    });
    const atB = await addOfflineSession({
      schoolId: schoolB.id,
      heldOn: heldB,
      startsAt: "09:00",
      perjadinId: trip.id,
    });

    const {
      current: [mine],
    } = await myPerjadin(caller);
    if (!mine) throw new Error("expected the trip");

    expect(mine.schools).toEqual([
      {
        schoolId: schoolA.id,
        name: "SMAN A",
        kabupatenKota: "Kota Manado",
        timeZone: "WITA",
        sessions: [
          { sessionId: arranged.id, heldOn: heldA1, startsAt: "09:00:00", status: "arranged" },
          { sessionId: cancelled.id, heldOn: heldA2, startsAt: "09:00:00", status: "cancelled" },
        ],
      },
      {
        schoolId: schoolB.id,
        name: "SMAN B",
        kabupatenKota: "Kota Bandung",
        timeZone: "WITA",
        sessions: [{ sessionId: atB.id, heldOn: heldB, startsAt: "09:00:00", status: "arranged" }],
      },
    ]);
  });
});

describe("myPerjadin derives the Preparation Checklist", () => {
  beforeEach(resetDatabase);

  it("returns the fixed six, marking only the ticked ones and dropping orphans", async () => {
    const caller = asPerson(
      await addPerson({ fullName: "Rina", email: "rina@ditsama.itb.ac.id", role: "Staff" }),
    );
    const trip = await addPerjadin({
      picPersonId: caller.id,
      advanceIdr: 1_000_000,
      startsOn: daysFromToday(1),
      endsOn: daysFromToday(4),
    });
    // Two fixed items ticked, plus two orphans older models left behind — a `dosen:` tick and one on
    // the ticket key ADR-0041 retired. Neither matches a fixed key, so neither has an item here.
    await db.insert(schema.perjadinPreparationItem).values([
      { perjadinId: trip.id, itemKey: "sk_perjalanan", checkedBy: caller.id },
      { perjadinId: trip.id, itemKey: "tiket_pp", checkedBy: caller.id },
      { perjadinId: trip.id, itemKey: "tiket_keberangkatan", checkedBy: caller.id },
      { perjadinId: trip.id, itemKey: "dosen:someone", checkedBy: caller.id },
    ]);

    const {
      current: [mine],
    } = await myPerjadin(caller);
    if (!mine) throw new Error("expected the trip");

    // The card derives its `x/N` pill from this: N is the length (always six), x the checked count.
    expect(mine.preparation).toHaveLength(6);
    const checked = mine.preparation.filter((item) => item.checked).map((item) => item.itemKey);
    expect(checked.sort()).toEqual(["sk_perjalanan", "tiket_pp"]);
    // Every other fixed item comes back unchecked; the orphans never appear at all.
    expect(mine.preparation.filter((item) => !item.checked)).toHaveLength(4);
    expect(mine.preparation.some((item) => item.itemKey.startsWith("dosen:"))).toBe(false);
    expect(mine.preparation.some((item) => item.itemKey === "tiket_keberangkatan")).toBe(false);
  });

  it("gives a trip with no ticks all six items unchecked", async () => {
    const caller = asPerson(
      await addPerson({ fullName: "Rina", email: "rina@ditsama.itb.ac.id", role: "Staff" }),
    );
    const trip = await addPerjadin({
      picPersonId: caller.id,
      advanceIdr: 1_000_000,
      startsOn: daysFromToday(1),
      endsOn: daysFromToday(4),
    });

    const {
      current: [mine],
    } = await myPerjadin(caller);
    expect(mine?.id).toBe(trip.id);
    expect(mine?.preparation).toHaveLength(6);
    expect(mine?.preparation.every((item) => !item.checked)).toBe(true);
  });
});
