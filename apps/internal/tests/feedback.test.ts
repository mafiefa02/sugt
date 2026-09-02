import {
  NO_FEEDBACK_FILTERS,
  NO_PERJADIN_FEEDBACK_FILTERS,
  participantFeedbackAverages,
  participantFeedbackPage,
  perjadinFeedbackAverages,
  perjadinFeedbackPage,
  type FeedbackFilters,
  type PerjadinFeedbackFilters,
} from "@sugt/db/queries";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addCluster,
  addParticipantFeedback,
  addPerjadin,
  addPerjadinEvaluation,
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

/**
 * **The Feedback list's Perjadin tab** — every Perjadin Evaluation, filtered and keyset-paged,
 * newest first. The tests prove the five filters cut on the right numbers and AND together, that
 * `reviewType` gates on the present-ratings average, that a null `lodging` is averaged over three
 * ratings and excluded from both lodging arms and from the summary hotel average, that the page
 * walks the whole set in `created_at desc` order, and that the stored `filed_by_role` /
 * `filed_by_name` pass through onto the row.
 */

/** One throwaway Perjadin to hang evaluations on — its destination is asserted on below. */
async function oneTrip(picPersonId: string) {
  return addPerjadin({
    destination: "Kelompok 3: Kabupaten Sleman",
    advanceIdr: 5_000_000,
    picPersonId,
  });
}

/** A full Perjadin filter set from the all-`all` default with a few arms overridden. */
function perjadinFilters(overrides: Partial<PerjadinFeedbackFilters>): PerjadinFeedbackFilters {
  return { ...NO_PERJADIN_FEEDBACK_FILTERS, ...overrides };
}

describe("perjadinFeedbackPage", () => {
  beforeEach(resetDatabase);

  it("returns everything, newest first, and carries filed_by_role/name and the joined destination", async () => {
    const person = await signedIn();
    const trip = await oneTrip(person.id);
    await addPerjadinEvaluation({
      perjadinId: trip.id,
      role: "Pimpinan",
      name: "Lama",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    await addPerjadinEvaluation({
      perjadinId: trip.id,
      role: "Pengajar",
      name: "Baru",
      createdAt: new Date("2026-06-01T00:00:00Z"),
    });

    const page = await perjadinFeedbackPage(person, {
      filters: NO_PERJADIN_FEEDBACK_FILTERS,
      cursor: null,
    });
    expect(page.rows.map((row) => row.filedByName)).toEqual(["Baru", "Lama"]);
    // The stored role and name pass through verbatim — no derivation (ADR-0024, #167).
    expect(page.rows[0]?.filedByRole).toBe("Pengajar");
    expect(page.rows[1]?.filedByRole).toBe("Pimpinan");
    expect(page.rows[0]?.destination).toBe("Kelompok 3: Kabupaten Sleman");
    expect(page.rows[0]?.perjadinId).toBe(trip.id);
    expect(page.rows[0]?.createdOn).toBe("2026-06-01");
    expect(page.nextCursor).toBeNull();
  });

  it("filters on each Aspect column with le7 and gt7", async () => {
    const person = await signedIn();
    const trip = await oneTrip(person.id);
    await addPerjadinEvaluation({
      perjadinId: trip.id,
      name: "Transport rendah",
      ratings: { transport: 5 },
    });
    await addPerjadinEvaluation({
      perjadinId: trip.id,
      name: "Konsumsi rendah",
      ratings: { meals: 6 },
    });
    await addPerjadinEvaluation({
      perjadinId: trip.id,
      name: "Ketepatan rendah",
      ratings: { punctuality: 7 },
    });
    await addPerjadinEvaluation({
      perjadinId: trip.id,
      name: "Penginapan rendah",
      lodging: 4,
    });

    const transportLow = await perjadinFeedbackPage(person, {
      filters: perjadinFilters({ transport: "le7" }),
      cursor: null,
    });
    expect(transportLow.rows.map((row) => row.filedByName)).toEqual(["Transport rendah"]);

    const mealsLow = await perjadinFeedbackPage(person, {
      filters: perjadinFilters({ meals: "le7" }),
      cursor: null,
    });
    expect(mealsLow.rows.map((row) => row.filedByName)).toEqual(["Konsumsi rendah"]);

    // 7 is at the threshold, so le7 (<= 7) keeps it and gt7 (> 7) does not.
    const punctualityLow = await perjadinFeedbackPage(person, {
      filters: perjadinFilters({ punctuality: "le7" }),
      cursor: null,
    });
    expect(punctualityLow.rows.map((row) => row.filedByName)).toEqual(["Ketepatan rendah"]);

    const lodgingLow = await perjadinFeedbackPage(person, {
      filters: perjadinFilters({ lodging: "le7" }),
      cursor: null,
    });
    expect(lodgingLow.rows.map((row) => row.filedByName)).toEqual(["Penginapan rendah"]);
  });

  it("gates reviewType on the present-ratings average, not any single Aspect", async () => {
    const person = await signedIn();
    const trip = await oneTrip(person.id);
    // A four-rating row: (8 + 8 + 8 + 6) / 4 = 7.5 — above 7 — so gt7 keeps it and le7 drops it,
    // even though one Aspect (punctuality = 6) is below the threshold on its own.
    await addPerjadinEvaluation({
      perjadinId: trip.id,
      name: "Campuran",
      lodging: 8,
      ratings: { transport: 8, meals: 8, punctuality: 6 },
    });

    const gt = await perjadinFeedbackPage(person, {
      filters: perjadinFilters({ reviewType: "gt7" }),
      cursor: null,
    });
    expect(gt.rows.map((row) => row.filedByName)).toEqual(["Campuran"]);
    expect(gt.rows[0]?.rowAverage).toBeCloseTo((8 + 8 + 8 + 6) / 4, 5);

    const le = await perjadinFeedbackPage(person, {
      filters: perjadinFilters({ reviewType: "le7" }),
      cursor: null,
    });
    expect(le.rows).toHaveLength(0);
  });

  it("ANDs two filters together", async () => {
    const person = await signedIn();
    const trip = await oneTrip(person.id);
    // Only this row is low on BOTH transport and meals.
    await addPerjadinEvaluation({
      perjadinId: trip.id,
      name: "Keduanya",
      ratings: { transport: 5, meals: 5 },
    });
    await addPerjadinEvaluation({
      perjadinId: trip.id,
      name: "Transport saja",
      ratings: { transport: 5, meals: 9 },
    });
    await addPerjadinEvaluation({
      perjadinId: trip.id,
      name: "Konsumsi saja",
      ratings: { transport: 9, meals: 5 },
    });

    const both = await perjadinFeedbackPage(person, {
      filters: perjadinFilters({ transport: "le7", meals: "le7" }),
      cursor: null,
    });
    expect(both.rows.map((row) => row.filedByName)).toEqual(["Keduanya"]);
  });

  it("averages a null-lodging row over its three present ratings and omits lodging from the row", async () => {
    const person = await signedIn();
    const trip = await oneTrip(person.id);
    // A day trip: no hotel. The row average is over the three present ratings, not four.
    await addPerjadinEvaluation({
      perjadinId: trip.id,
      name: "Sehari",
      lodging: null,
      ratings: { transport: 6, meals: 6, punctuality: 9 },
    });

    const page = await perjadinFeedbackPage(person, {
      filters: NO_PERJADIN_FEEDBACK_FILTERS,
      cursor: null,
    });
    expect(page.rows[0]?.lodging).toBeNull();
    expect(page.rows[0]?.rowAverage).toBeCloseTo((6 + 6 + 9) / 3, 5);
  });

  it("excludes a null-lodging row from both lodging filter arms", async () => {
    const person = await signedIn();
    const trip = await oneTrip(person.id);
    await addPerjadinEvaluation({ perjadinId: trip.id, name: "Sehari", lodging: null });

    const low = await perjadinFeedbackPage(person, {
      filters: perjadinFilters({ lodging: "le7" }),
      cursor: null,
    });
    expect(low.rows).toHaveLength(0);
    const high = await perjadinFeedbackPage(person, {
      filters: perjadinFilters({ lodging: "gt7" }),
      cursor: null,
    });
    expect(high.rows).toHaveLength(0);
  });

  it("walks the whole set by keyset over created_at, 10 per page, newest first, no repeat or gap", async () => {
    const person = await signedIn();
    const trip = await oneTrip(person.id);
    // 12 evaluations on distinct instants, oldest first — so "newest first" is the reverse.
    for (let i = 0; i < 12; i++) {
      await addPerjadinEvaluation({
        perjadinId: trip.id,
        name: `E${String(i).padStart(2, "0")}`,
        createdAt: new Date(`2026-06-${String(i + 1).padStart(2, "0")}T00:00:00Z`),
      });
    }

    const first = await perjadinFeedbackPage(person, {
      filters: NO_PERJADIN_FEEDBACK_FILTERS,
      cursor: null,
    });
    expect(first.rows).toHaveLength(10);
    expect(first.nextCursor).not.toBeNull();
    expect(first.rows.map((row) => row.filedByName)).toEqual([
      "E11",
      "E10",
      "E09",
      "E08",
      "E07",
      "E06",
      "E05",
      "E04",
      "E03",
      "E02",
    ]);

    const second = await perjadinFeedbackPage(person, {
      filters: NO_PERJADIN_FEEDBACK_FILTERS,
      cursor: first.nextCursor,
    });
    expect(second.rows.map((row) => row.filedByName)).toEqual(["E01", "E00"]);
    expect(second.nextCursor).toBeNull();

    const all = [...first.rows, ...second.rows].map((row) => row.filedByName);
    expect(new Set(all).size).toBe(12);
    expect(all).toHaveLength(12);
  });
});

describe("perjadinFeedbackAverages", () => {
  beforeEach(resetDatabase);

  it("defaults to zero on an empty table", async () => {
    const person = await signedIn();
    expect(await perjadinFeedbackAverages(person)).toEqual({
      lodging: 0,
      transport: 0,
      meals: 0,
      punctuality: 0,
    });
  });

  it("averages every row dataset-wide, and a null lodging is ignored by the hotel average", async () => {
    const person = await signedIn();
    const trip = await oneTrip(person.id);
    await addPerjadinEvaluation({
      perjadinId: trip.id,
      lodging: 10,
      ratings: { transport: 4, meals: 6, punctuality: 8 },
    });
    // A day trip with no hotel: its lodging is out of the hotel average, in the other three.
    await addPerjadinEvaluation({
      perjadinId: trip.id,
      lodging: null,
      ratings: { transport: 8, meals: 10, punctuality: 10 },
    });

    const averages = await perjadinFeedbackAverages(person);
    // avg(lodging) ignores the NULL — it is 10, not (10 + 0) / 2.
    expect(averages.lodging).toBeCloseTo(10, 5);
    expect(averages.transport).toBeCloseTo((4 + 8) / 2, 5);
    expect(averages.meals).toBeCloseTo((6 + 10) / 2, 5);
    expect(averages.punctuality).toBeCloseTo((8 + 10) / 2, 5);
  });
});
