import { db, schema } from "@sugt/db";
import { concerns } from "@sugt/db/queries";
import { CONCERN_AT_OR_BELOW } from "@sugt/domain";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addClassRecord,
  addCluster,
  addPerjadin,
  addPerjadinEvaluation,
  addParticipantFeedback,
  addPerson,
  addProvince,
  addSchool,
  addSession,
  addSessionRecord,
  resetDatabase,
} from "./support/fixtures";

/**
 * **The concerns list** — every Aspect anyone Rated at or below the threshold, across all four
 * forms, newest first. The tests prove the four sources unpivot to one row per low Aspect, that
 * a single low Rating is never averaged away, that the threshold is inclusive, and that only the
 * internal sources carry prose.
 */

async function staff(email = "rina@ditsama.itb.ac.id") {
  return addPerson({ fullName: "Rina Nurhayati", email, role: "Staff" });
}

async function professor(email = "bagus@itb.ac.id") {
  return addPerson({ fullName: "Bagus Prakoso", email, role: "Teaching Team" });
}

async function oneSchool(slug = "sman-8", name = "SMAN 8 Jakarta") {
  await addProvince("JB", "Jawa Barat");
  const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
  return addSchool({ slug, name, clusterId: cluster.id, provinceCode: "JB" });
}

async function aDeliveredSession(picPersonId: string) {
  const school = await oneSchool();
  return addSession({
    schoolId: school.id,
    heldOn: "2026-09-10",
    status: "delivered",
    onlinePicPersonId: picPersonId,
  });
}

/** The concern matching a source and Aspect, or undefined. */
function find(list: Awaited<ReturnType<typeof concerns>>, source: string, aspect: string) {
  return list.find((concern) => concern.source === source && concern.aspect === aspect);
}

describe("concerns", () => {
  beforeEach(resetDatabase);

  it("is empty when nothing was Rated low", async () => {
    const pic = await staff();
    const teacher = await professor();
    const session = await aDeliveredSession(pic.id);
    await addClassRecord({
      sessionId: session.id,
      classKind: "Student",
      filedByPersonId: teacher.id,
    });

    expect(await concerns(pic)).toEqual([]);
  });

  it("surfaces a low Class Record Aspect, with its cohort, prose and Session link", async () => {
    const pic = await staff();
    const teacher = await professor();
    const session = await aDeliveredSession(pic.id);
    await addClassRecord({
      sessionId: session.id,
      classKind: "Student",
      filedByPersonId: teacher.id,
      ratings: { comprehension: 4 },
    });

    const row = find(await concerns(pic), "class-record", "comprehension");
    expect(row).toBeDefined();
    expect(row?.rating).toBe(4);
    expect(row?.subject).toBe("SMAN 8 Jakarta · Student");
    expect(row?.who).toBe("Bagus Prakoso");
    expect(row?.said).not.toBeNull();
    expect(row?.sessionId).toBe(session.id);
    expect(row?.perjadinId).toBeNull();
  });

  it("surfaces a low Session Record Aspect from the PIC", async () => {
    const pic = await staff();
    const session = await aDeliveredSession(pic.id);
    await addSessionRecord({
      sessionId: session.id,
      filedByPersonId: pic.id,
      ratings: { turnout: 5 },
    });

    const row = find(await concerns(pic), "session-record", "turnout");
    expect(row?.rating).toBe(5);
    expect(row?.subject).toBe("SMAN 8 Jakarta");
    expect(row?.said).not.toBeNull();
    expect(row?.sessionId).toBe(session.id);
  });

  it("surfaces a low Participant Feedback Aspect, and it carries no prose", async () => {
    const pic = await staff();
    const session = await aDeliveredSession(pic.id);
    await addParticipantFeedback({
      sessionId: session.id,
      classKind: "Student",
      name: "Ayu",
      ratings: { instructor: 3 },
    });

    const row = find(await concerns(pic), "participant", "instructor");
    expect(row?.rating).toBe(3);
    expect(row?.who).toBe("Ayu");
    expect(row?.subject).toBe("SMAN 8 Jakarta · Student");
    expect(row?.said).toBeNull();
    expect(row?.sessionId).toBe(session.id);
  });

  it("shows the Participant's comment for the Aspect that was Rated low", async () => {
    const pic = await staff();
    const session = await aDeliveredSession(pic.id);
    await addParticipantFeedback({
      sessionId: session.id,
      classKind: "Student",
      name: "Ayu",
      comments: { instructor: "Terlalu cepat" },
      ratings: { instructor: 3 },
    });

    // The optional comment is prose too — a Participant owes none, but a filled one is shown,
    // paired to the Aspect it explains (#102).
    expect(find(await concerns(pic), "participant", "instructor")?.said).toBe("Terlalu cepat");
  });

  it("does not borrow another Aspect's comment for a low Rating", async () => {
    const pic = await staff();
    const session = await aDeliveredSession(pic.id);
    // A comment on `materials`, but the low Rating is on `instructor` — the instructor concern
    // must carry no prose, because a single shared comment could not say which Aspect it meant.
    await addParticipantFeedback({
      sessionId: session.id,
      classKind: "Student",
      name: "Ayu",
      comments: { materials: "Bahannya bagus" },
      ratings: { instructor: 3 },
    });

    expect(find(await concerns(pic), "participant", "instructor")?.said).toBeNull();
  });

  it("surfaces a low Perjadin Evaluation Aspect, linked to the trip", async () => {
    const pic = await staff();
    const teacher = await professor();
    const trip = await addPerjadin({
      advanceIdr: 5_000_000,
      picPersonId: pic.id,
      teachers: [{ personId: teacher.id, stream: "STEM" }],
    });
    await addPerjadinEvaluation({ perjadinId: trip.id, filedByPersonId: teacher.id, lodging: 4 });

    const row = find(await concerns(pic), "perjadin-evaluation", "lodging");
    expect(row?.rating).toBe(4);
    expect(row?.subject).toBe("Bandung");
    expect(row?.perjadinId).toBe(trip.id);
    expect(row?.sessionId).toBeNull();
    expect(row?.said).not.toBeNull();
  });

  it("keeps each low Aspect as its own row and never averages", async () => {
    const pic = await staff();
    const teacher = await professor();
    const session = await aDeliveredSession(pic.id);
    await addClassRecord({
      sessionId: session.id,
      classKind: "GTK",
      filedByPersonId: teacher.id,
      ratings: { comprehension: 4, participation: 6 },
    });

    const list = await concerns(pic);
    expect(find(list, "class-record", "comprehension")?.rating).toBe(4);
    expect(find(list, "class-record", "participation")?.rating).toBe(6);
    // The seven-Aspect record has exactly two low ones; nothing else appears from it.
    expect(list.filter((concern) => concern.source === "class-record")).toHaveLength(2);
  });

  it("includes an Aspect exactly at the threshold and excludes one above it", async () => {
    const pic = await staff();
    const teacher = await professor();
    const session = await aDeliveredSession(pic.id);
    await addClassRecord({
      sessionId: session.id,
      classKind: "MS",
      filedByPersonId: teacher.id,
      ratings: { comprehension: CONCERN_AT_OR_BELOW, participation: CONCERN_AT_OR_BELOW + 1 },
    });

    const list = await concerns(pic);
    // Pin the branch to exactly one row, so "participation absent" means the threshold excluded
    // it — not that the whole Class Record source silently returned nothing.
    expect(list.filter((concern) => concern.source === "class-record")).toHaveLength(1);
    expect(find(list, "class-record", "comprehension")?.rating).toBe(CONCERN_AT_OR_BELOW);
    expect(find(list, "class-record", "participation")).toBeUndefined();
  });

  it("orders newest first", async () => {
    const pic = await staff();
    const [older, newer] = [await professor("a@itb.ac.id"), await professor("b@itb.ac.id")];
    const session = await aDeliveredSession(pic.id);
    // Inserted directly to control the timestamp the list orders on.
    await db.insert(schema.classRecord).values({
      sessionId: session.id,
      classKind: "GTK",
      filedByPersonId: older.id,
      filedByRole: "Teaching Team",
      comprehension: 4,
      participation: 9,
      readiness: 9,
      materials: 9,
      delivery: 9,
      facilities: 9,
      timing: 9,
      problems: "lebih dulu",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    await db.insert(schema.classRecord).values({
      sessionId: session.id,
      classKind: "MS",
      filedByPersonId: newer.id,
      filedByRole: "Teaching Team",
      comprehension: 3,
      participation: 9,
      readiness: 9,
      materials: 9,
      delivery: 9,
      facilities: 9,
      timing: 9,
      problems: "lebih baru",
      createdAt: new Date("2026-06-01T00:00:00Z"),
    });

    const list = await concerns(pic);
    expect(list[0]?.said).toBe("lebih baru");
    expect(list[1]?.said).toBe("lebih dulu");
  });
});
