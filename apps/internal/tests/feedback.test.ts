import {
  NO_FEEDBACK_FILTERS,
  participantFeedbackAverages,
  participantFeedbackPage,
  type FeedbackFilters,
} from "@sugt/db/queries";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addCluster,
  addParticipantFeedback,
  addPerson,
  addProvince,
  addSchool,
  addSession,
  resetDatabase,
} from "./support/fixtures";

/**
 * **The Feedback list's Peserta tab** — every Participant submission, filtered and keyset-paged,
 * newest first. The tests prove the four filters cut on the right numbers and AND together, that
 * `reviewType` gates on the raw row average, that the page walks the whole set with no repeat or
 * gap in `submitted_at desc` order, and that the summary averages are dataset-wide.
 */

async function signedIn(email = "rina@ditsama.itb.ac.id") {
  return addPerson({ fullName: "Rina Nurhayati", email, role: "Staff" });
}

async function oneSession(picPersonId: string) {
  await addProvince("JB", "Jawa Barat");
  const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
  const school = await addSchool({
    slug: "sman-8",
    name: "SMAN 8 Jakarta",
    clusterId: cluster.id,
    provinceCode: "JB",
  });
  return addSession({
    schoolId: school.id,
    heldOn: "2026-09-10",
    status: "delivered",
    onlinePicPersonId: picPersonId,
  });
}

/** A full filter set from the all-`all` default with a few arms overridden. */
function filters(overrides: Partial<FeedbackFilters>): FeedbackFilters {
  return { ...NO_FEEDBACK_FILTERS, ...overrides };
}

describe("participantFeedbackPage", () => {
  beforeEach(resetDatabase);

  it("returns everything, newest first, when no filter is set", async () => {
    const person = await signedIn();
    const session = await oneSession(person.id);
    await addParticipantFeedback({
      sessionId: session.id,
      classKind: "Student",
      name: "Lama",
      submittedAt: new Date("2026-01-01T00:00:00Z"),
    });
    await addParticipantFeedback({
      sessionId: session.id,
      classKind: "Student",
      name: "Baru",
      submittedAt: new Date("2026-06-01T00:00:00Z"),
    });

    const page = await participantFeedbackPage(person, {
      filters: NO_FEEDBACK_FILTERS,
      cursor: null,
    });
    expect(page.rows).toHaveLength(2);
    expect(page.rows.map((row) => row.name)).toEqual(["Baru", "Lama"]);
    expect(page.nextCursor).toBeNull();
  });

  it("carries the row's shape, and heldOn/mode/schoolName from the joins", async () => {
    const person = await signedIn();
    const session = await oneSession(person.id);
    await addParticipantFeedback({
      sessionId: session.id,
      classKind: "GTK",
      name: "Ayu",
      ratings: { materials: 8, instructor: 9, relevance: 10 },
    });

    const [row] = (
      await participantFeedbackPage(person, { filters: NO_FEEDBACK_FILTERS, cursor: null })
    ).rows;
    expect(row?.name).toBe("Ayu");
    expect(row?.classKind).toBe("GTK");
    expect(row?.schoolName).toBe("SMAN 8 Jakarta");
    expect(row?.sessionMode).toBe("online");
    expect(row?.heldOn).toBe("2026-09-10");
    expect(row?.rowAverage).toBeCloseTo((8 + 9 + 10) / 3, 5);
  });

  it("filters on the instructor column with le7 and gt7", async () => {
    const person = await signedIn();
    const session = await oneSession(person.id);
    await addParticipantFeedback({
      sessionId: session.id,
      classKind: "Student",
      name: "Rendah",
      ratings: { instructor: 5 },
    });
    await addParticipantFeedback({
      sessionId: session.id,
      classKind: "Student",
      name: "Tinggi",
      ratings: { instructor: 9 },
    });

    const low = await participantFeedbackPage(person, {
      filters: filters({ instructor: "le7" }),
      cursor: null,
    });
    expect(low.rows.map((row) => row.name)).toEqual(["Rendah"]);

    const high = await participantFeedbackPage(person, {
      filters: filters({ instructor: "gt7" }),
      cursor: null,
    });
    expect(high.rows.map((row) => row.name)).toEqual(["Tinggi"]);
  });

  it("filters on the materials column", async () => {
    const person = await signedIn();
    const session = await oneSession(person.id);
    await addParticipantFeedback({
      sessionId: session.id,
      classKind: "Student",
      name: "Rendah",
      ratings: { materials: 6 },
    });
    await addParticipantFeedback({
      sessionId: session.id,
      classKind: "Student",
      name: "Tinggi",
      ratings: { materials: 8 },
    });

    const low = await participantFeedbackPage(person, {
      filters: filters({ materials: "le7" }),
      cursor: null,
    });
    expect(low.rows.map((row) => row.name)).toEqual(["Rendah"]);
  });

  it("filters on the relevance column", async () => {
    const person = await signedIn();
    const session = await oneSession(person.id);
    await addParticipantFeedback({
      sessionId: session.id,
      classKind: "Student",
      name: "Rendah",
      ratings: { relevance: 7 },
    });
    await addParticipantFeedback({
      sessionId: session.id,
      classKind: "Student",
      name: "Tinggi",
      ratings: { relevance: 8 },
    });

    const low = await participantFeedbackPage(person, {
      filters: filters({ relevance: "le7" }),
      cursor: null,
    });
    // 7 is at the threshold, so le7 (<= 7) keeps it and gt7 (> 7) does not.
    expect(low.rows.map((row) => row.name)).toEqual(["Rendah"]);
    const high = await participantFeedbackPage(person, {
      filters: filters({ relevance: "gt7" }),
      cursor: null,
    });
    expect(high.rows.map((row) => row.name)).toEqual(["Tinggi"]);
  });

  it("gates reviewType on the raw row average, not any single Aspect", async () => {
    const person = await signedIn();
    const session = await oneSession(person.id);
    // Average (8 + 8 + 6) / 3 = 7.33 — above 7 — so gt7 keeps it and le7 drops it, even though
    // one Aspect (relevance = 6) is below the threshold on its own.
    await addParticipantFeedback({
      sessionId: session.id,
      classKind: "Student",
      name: "Campuran",
      ratings: { materials: 8, instructor: 8, relevance: 6 },
    });

    const gt = await participantFeedbackPage(person, {
      filters: filters({ reviewType: "gt7" }),
      cursor: null,
    });
    expect(gt.rows.map((row) => row.name)).toEqual(["Campuran"]);
    expect(gt.rows[0]?.rowAverage).toBeCloseTo((8 + 8 + 6) / 3, 5);

    const le = await participantFeedbackPage(person, {
      filters: filters({ reviewType: "le7" }),
      cursor: null,
    });
    expect(le.rows).toHaveLength(0);
  });

  it("ANDs two filters together", async () => {
    const person = await signedIn();
    const session = await oneSession(person.id);
    // Only this row is low on BOTH instructor and materials.
    await addParticipantFeedback({
      sessionId: session.id,
      classKind: "Student",
      name: "Keduanya",
      ratings: { instructor: 5, materials: 5 },
    });
    // Low on instructor only.
    await addParticipantFeedback({
      sessionId: session.id,
      classKind: "Student",
      name: "Pengajar saja",
      ratings: { instructor: 5, materials: 9 },
    });
    // Low on materials only.
    await addParticipantFeedback({
      sessionId: session.id,
      classKind: "Student",
      name: "Materi saja",
      ratings: { instructor: 9, materials: 5 },
    });

    const both = await participantFeedbackPage(person, {
      filters: filters({ instructor: "le7", materials: "le7" }),
      cursor: null,
    });
    expect(both.rows.map((row) => row.name)).toEqual(["Keduanya"]);
  });

  it("walks the whole set by keyset, 10 per page, newest first, with no repeat or gap", async () => {
    const person = await signedIn();
    const session = await oneSession(person.id);
    // 12 submissions on distinct instants, oldest first — so "newest first" is the reverse.
    for (let i = 0; i < 12; i++) {
      await addParticipantFeedback({
        sessionId: session.id,
        classKind: "Student",
        name: `P${String(i).padStart(2, "0")}`,
        submittedAt: new Date(`2026-06-${String(i + 1).padStart(2, "0")}T00:00:00Z`),
      });
    }

    const first = await participantFeedbackPage(person, {
      filters: NO_FEEDBACK_FILTERS,
      cursor: null,
    });
    expect(first.rows).toHaveLength(10);
    expect(first.nextCursor).not.toBeNull();
    // Newest first: P11 down to P02.
    expect(first.rows.map((row) => row.name)).toEqual([
      "P11",
      "P10",
      "P09",
      "P08",
      "P07",
      "P06",
      "P05",
      "P04",
      "P03",
      "P02",
    ]);

    const second = await participantFeedbackPage(person, {
      filters: NO_FEEDBACK_FILTERS,
      cursor: first.nextCursor,
    });
    expect(second.rows.map((row) => row.name)).toEqual(["P01", "P00"]);
    expect(second.nextCursor).toBeNull();

    // No row appears on both pages, and every row appears once.
    const all = [...first.rows, ...second.rows].map((row) => row.name);
    expect(new Set(all).size).toBe(12);
    expect(all).toHaveLength(12);
  });
});

describe("participantFeedbackAverages", () => {
  beforeEach(resetDatabase);

  it("defaults to zero on an empty table", async () => {
    const person = await signedIn();
    expect(await participantFeedbackAverages(person)).toEqual({
      instructor: 0,
      materials: 0,
      relevance: 0,
    });
  });

  it("averages every row, dataset-wide", async () => {
    const person = await signedIn();
    const session = await oneSession(person.id);
    await addParticipantFeedback({
      sessionId: session.id,
      classKind: "Student",
      ratings: { instructor: 4, materials: 6, relevance: 8 },
    });
    await addParticipantFeedback({
      sessionId: session.id,
      classKind: "Student",
      ratings: { instructor: 8, materials: 10, relevance: 10 },
    });

    const averages = await participantFeedbackAverages(person);
    expect(averages.instructor).toBeCloseTo((4 + 8) / 2, 5);
    expect(averages.materials).toBeCloseTo((6 + 10) / 2, 5);
    expect(averages.relevance).toBeCloseTo((8 + 10) / 2, 5);
  });
});
