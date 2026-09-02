import {
  arrangeOnlineSession,
  isNotStaffError,
  markSessionDelivered,
  staffDashboard,
} from "@sugt/db/queries";
import type { Role } from "@sugt/domain";
import { beforeEach, describe, expect, it } from "vitest";

import {
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
 * **Beranda** — the Staff dashboard (#40). It assembles from delivery, the owed list and money.
 * The rules under test are the ones the ticket names: "who owes what" is scoped to delivered
 * Sessions, and the payload — the Advance strip is money (ADR-0004) — is refused a non-Staff
 * caller by the choke point.
 *
 * The Teaching Team dashboard is gone: T3 (#153) retired `session_teacher` and the Teaching Team
 * Role, so there is no professor to owe Class Records off the back of who taught, and
 * `teachingTeamDashboard` was removed with them.
 */

async function staff(email = "rina@ditsama.itb.ac.id", fullName = "Rina Nurhayati") {
  return addPerson({ fullName, email, role: "Staff" });
}

/**
 * A non-Staff caller, hand-built rather than invited. T3 (#153) retired the Teaching Team Role, so
 * no such Person exists in the database any more — but the choke point still has to reject a
 * non-Staff caller, and `requireStaff` throws on the role alone. The cast through `unknown` is the
 * only way to name a role the type no longer admits.
 */
function nonStaff() {
  return {
    id: "00000000-0000-0000-0000-000000000009",
    fullName: "Bagus Prakoso",
    email: "bagus@itb.ac.id",
    role: "Teaching Team" as unknown as Role,
  };
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

describe("staffDashboard", () => {
  beforeEach(resetDatabase);

  it("refuses a non-Staff caller — the choke point, not a case to handle", async () => {
    const refusal = await staffDashboard(nonStaff()).catch((error: unknown) => error);

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
      stream: "STEM",
      teacherNames: [],
    });

    const dashboard = await staffDashboard(pic);

    expect(dashboard.owed).toEqual([]);
  });

  it("assembles the delivery picture, the outstanding Advance and the PIC's owed Records", async () => {
    const pic = await staff();
    const { cluster, school } = await oneSchool();
    const perjadin = await addPerjadin({
      advanceIdr: 5_000_000,
      picPersonId: pic.id,
    });
    const delivered = await addOfflineSession({
      schoolId: school.id,
      heldOn: "2026-09-02",
      perjadinId: perjadin.id,
    });
    // Offline mark-delivered is status-only — its teachers are trip-scoped names, not People.
    await markSessionDelivered(pic, delivered.id);
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
    // The trip is theirs, with the acquittal figures. The Group is the PIC alone now — Teaching
    // Team left `group_member` with the Role (T3, #153) — so the Group counts one.
    const report = dashboard.picReports.find((entry) => entry.perjadinId === perjadin.id);
    expect(report).toMatchObject({
      groupCount: 1,
      transactionCount: 1,
      remainderIdr: 4_000_000,
    });
    expect(report?.reportDueOn).toBe("2026-09-05");
  });

  it("stops owing a Session Record once the PIC files it", async () => {
    const pic = await staff();
    const { school } = await oneSchool();
    const perjadin = await addPerjadin({
      advanceIdr: 5_000_000,
      picPersonId: pic.id,
    });
    const delivered = await addOfflineSession({
      schoolId: school.id,
      heldOn: "2026-09-02",
      perjadinId: perjadin.id,
    });
    await markSessionDelivered(pic, delivered.id);
    await addSessionRecord({ sessionId: delivered.id, filedByPersonId: pic.id });

    const dashboard = await staffDashboard(pic);

    expect(dashboard.owed).toEqual([]);
  });
});
