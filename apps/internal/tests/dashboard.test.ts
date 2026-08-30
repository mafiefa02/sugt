import {
  arrangeOnlineSession,
  isNotStaffError,
  markSessionDelivered,
  staffDashboard,
  teachingTeamDashboard,
} from "@sugt/db/queries";
import { CLASS_KINDS } from "@sugt/domain";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addClassRecord,
  addCluster,
  addOfflineSession,
  addPerjadin,
  addPerson,
  addProvince,
  addSchool,
  addSessionRecord,
  addTransaction,
  resetDatabase,
} from "./support/fixtures";

/**
 * **Beranda** — the two role dashboards (#40). They assemble from delivery, the owed lists and,
 * on the Staff side, money. The rules under test are the ones the ticket names: "who owes what"
 * is scoped to delivered Sessions, the Teaching Team payload carries no money, and the Staff
 * payload is refused a Teaching Team caller by the choke point.
 */

async function staff(email = "rina@ditsama.itb.ac.id", fullName = "Rina Nurhayati") {
  return addPerson({ fullName, email, role: "Staff" });
}
async function professor(email: string, fullName: string) {
  return addPerson({ fullName, email, role: "Teaching Team" });
}

/** A Cluster with a School in it, and a Province behind them. */
async function oneSchool() {
  await addProvince("JB", "Jawa Barat");
  const cluster = await addCluster({ slug: "priangan", name: "Priangan Timur" });
  const school = await addSchool({
    slug: "sman-8",
    name: "SMAN 8",
    clusterId: cluster.id,
    provinceCode: "JB",
  });
  return { cluster, school };
}

describe("teachingTeamDashboard", () => {
  beforeEach(resetDatabase);

  it("owes a Class Record per unfiled Class kind on delivered Sessions the professor taught", async () => {
    const pic = await staff();
    const bagus = await professor("bagus@itb.ac.id", "Bagus Prakoso");
    const sari = await professor("sari@itb.ac.id", "Sari Dewi");
    const { school } = await oneSchool();
    // A Teaching Team member owes Class Records for the **online** Sessions they taught: since
    // ADR-0020 offline teachers are trip-scoped `session_teaching_team` names, not People, and their
    // offline Class Records are deferred (T8), so `session_teacher` — and this owed list — is online
    // only. Delivering names both professors, so Bagus becomes a session_teacher and owes three.
    const arranged = await arrangeOnlineSession(pic, {
      schoolId: school.id,
      heldOn: "2026-09-02",
      startsAt: "09:00",
      picPersonId: pic.id,
      teachers: [{ stream: "STEM", personId: bagus.id }],
    });
    if (arranged.outcome !== "arranged") throw new Error("unreachable");
    await markSessionDelivered(pic, arranged.sessionId, [
      { personId: bagus.id, stream: "STEM" },
      { personId: sari.id, stream: "Research" },
    ]);
    // Bagus files one of the three.
    await addClassRecord({
      sessionId: arranged.sessionId,
      classKind: "GTK",
      filedByPersonId: bagus.id,
    });

    const dashboard = await teachingTeamDashboard(bagus);

    expect(dashboard.fullName).toBe("Bagus Prakoso");
    expect(dashboard.streams).toEqual(["STEM"]);
    expect(dashboard.owed).toHaveLength(CLASS_KINDS.length - 1);
    expect(dashboard.owed.every((entry) => entry.sessionId === arranged.sessionId)).toBe(true);
    expect(dashboard.owed.map((entry) => entry.classKind).sort()).toEqual(["MS", "Student"]);
  });

  it("owes nothing for an arranged Session, and lists it as upcoming instead", async () => {
    const pic = await staff();
    const bagus = await professor("bagus@itb.ac.id", "Bagus Prakoso");
    const sari = await professor("sari@itb.ac.id", "Sari Dewi");
    const { school } = await oneSchool();
    const perjadin = await addPerjadin({
      advanceIdr: 5_000_000,
      picPersonId: pic.id,
      teachers: [
        { personId: bagus.id, stream: "STEM" },
        { personId: sari.id, stream: "Research" },
      ],
    });
    const arranged = await addOfflineSession({
      schoolId: school.id,
      heldOn: "2026-09-02",
      perjadinId: perjadin.id,
    });

    const dashboard = await teachingTeamDashboard(bagus);

    // Arranged, so nothing is owed — the delivered-only rule.
    expect(dashboard.owed).toEqual([]);
    // But it is on a trip Bagus is on, so it is upcoming.
    expect(dashboard.upcoming.map((entry) => entry.sessionId)).toEqual([arranged.id]);
    expect(dashboard.activeTripCount).toBe(1);
  });

  /**
   * The ADR-0006 scenario the ticket names, and the one the delivered-only filter exists for: an
   * **online** Session names its professor at *arrangement*, so its `session_teacher` row exists
   * before any teaching has happened. Nothing is owed until it is delivered — dropping the filter
   * would report three Class Records owed for teaching that has not happened, which this catches.
   */
  it("owes nothing for an arranged online Session that already names the professor", async () => {
    const pic = await staff();
    const bagus = await professor("bagus@itb.ac.id", "Bagus Prakoso");
    const { school } = await oneSchool();
    const arranged = await arrangeOnlineSession(pic, {
      schoolId: school.id,
      heldOn: "2026-09-02",
      startsAt: "09:00",
      picPersonId: pic.id,
      teachers: [{ stream: "STEM", personId: bagus.id }],
    });
    if (arranged.outcome !== "arranged") throw new Error("unreachable");

    const dashboard = await teachingTeamDashboard(bagus);

    expect(dashboard.owed).toEqual([]);
    // It is Bagus's upcoming Session, since it names him.
    expect(dashboard.upcoming.map((entry) => entry.sessionId)).toEqual([arranged.sessionId]);
  });
});

describe("staffDashboard", () => {
  beforeEach(resetDatabase);

  it("refuses a Teaching Team caller — the choke point, not a case to handle", async () => {
    const bagus = await professor("bagus@itb.ac.id", "Bagus Prakoso");

    const refusal = await staffDashboard(bagus).catch((error: unknown) => error);

    expect(isNotStaffError(refusal)).toBe(true);
  });

  /**
   * The delivered-only rule on the PIC's side: an arranged online Session names its PIC at
   * arrangement, so the PIC is on it before it has happened. No Session Record is owed until it is
   * delivered — dropping the filter would report one for a visit that has not occurred.
   */
  it("does not owe a Session Record for an arranged Session the caller leads", async () => {
    const pic = await staff();
    const { school } = await oneSchool();
    await arrangeOnlineSession(pic, {
      schoolId: school.id,
      heldOn: "2026-09-02",
      startsAt: "09:00",
      picPersonId: pic.id,
      teachers: [],
    });

    const dashboard = await staffDashboard(pic);

    expect(dashboard.owed).toEqual([]);
  });

  it("assembles the delivery picture, the outstanding Advance and the PIC's owed Records", async () => {
    const pic = await staff();
    const bagus = await professor("bagus@itb.ac.id", "Bagus Prakoso");
    const sari = await professor("sari@itb.ac.id", "Sari Dewi");
    const { cluster, school } = await oneSchool();
    const perjadin = await addPerjadin({
      advanceIdr: 5_000_000,
      picPersonId: pic.id,
      teachers: [
        { personId: bagus.id, stream: "STEM" },
        { personId: sari.id, stream: "Research" },
      ],
    });
    const delivered = await addOfflineSession({
      schoolId: school.id,
      heldOn: "2026-09-02",
      perjadinId: perjadin.id,
    });
    await markSessionDelivered(pic, delivered.id, [
      { personId: bagus.id, stream: "STEM" },
      { personId: sari.id, stream: "Research" },
    ]);
    await addTransaction({
      perjadinId: perjadin.id,
      amountIdr: 1_000_000,
      createdByPersonId: pic.id,
    });

    const dashboard = await staffDashboard(pic);

    // Delivery picture: one delivered Session at one School in one Cluster.
    expect(dashboard.schoolsReached).toBe(1);
    expect(dashboard.deliveredTotal).toBe(1);
    expect(dashboard.perCluster.find((entry) => entry.clusterId === cluster.id)?.delivered).toBe(1);
    // The Advance is still out — nothing returned.
    expect(dashboard.advanceOutstandingIdr).toBe(5_000_000);
    // The PIC owes a Session Record on the delivered Session they led.
    expect(dashboard.owed.map((entry) => entry.sessionId)).toEqual([delivered.id]);
    // The trip is theirs, with the acquittal figures.
    const report = dashboard.picReports.find((entry) => entry.perjadinId === perjadin.id);
    expect(report).toMatchObject({
      groupCount: 3,
      receiptsSettled: 0,
      transactionCount: 1,
      remainderIdr: 4_000_000,
    });
    expect(report?.reportDueOn).toBe("2026-09-05");
  });

  it("stops owing a Session Record once the PIC files it", async () => {
    const pic = await staff();
    const bagus = await professor("bagus@itb.ac.id", "Bagus Prakoso");
    const sari = await professor("sari@itb.ac.id", "Sari Dewi");
    const { school } = await oneSchool();
    const perjadin = await addPerjadin({
      advanceIdr: 5_000_000,
      picPersonId: pic.id,
      teachers: [
        { personId: bagus.id, stream: "STEM" },
        { personId: sari.id, stream: "Research" },
      ],
    });
    const delivered = await addOfflineSession({
      schoolId: school.id,
      heldOn: "2026-09-02",
      perjadinId: perjadin.id,
    });
    await markSessionDelivered(pic, delivered.id, [
      { personId: bagus.id, stream: "STEM" },
      { personId: sari.id, stream: "Research" },
    ]);
    await addSessionRecord({ sessionId: delivered.id, filedByPersonId: pic.id });

    const dashboard = await staffDashboard(pic);

    expect(dashboard.owed).toEqual([]);
  });
});
