import { db, schema } from "@sugt/db";
import { filePerjadinEvaluation, type PerjadinEvaluationRatings } from "@sugt/db/queries";
import { CONCERN_AT_OR_BELOW } from "@sugt/domain";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { addPerjadin, addPerson, refusedBy, resetDatabase } from "./support/fixtures";

/**
 * **The Perjadin Evaluation** — how the trip went, filed by a member of the Group that
 * travelled.
 *
 * The rules under test are the ones no column holds: only a Group member may file (there is no
 * foreign key into `group_member`, so the write checks membership), the elaboration rule holds
 * on the application side and behind a CHECK, and — the one this form adds — `lodging` is
 * nullable, so a day trip with no hotel drops out of the minimum rather than forcing prose or
 * reaching the concerns list. Postgres `least()` ignoring NULLs is what makes that work, and it
 * is asserted here rather than left a comment.
 */

/** The Staff PIC, who is a Group member by construction and may file an Evaluation. */
async function staff(email = "rina@ditsama.itb.ac.id") {
  return addPerson({ fullName: "Rina Nurhayati", email, role: "Staff" });
}

/** A Teaching Team member — the one who slept in the hotel. */
async function professor(email = "bagus@itb.ac.id") {
  return addPerson({ fullName: "Bagus Prakoso", email, role: "Teaching Team" });
}

/** A trip with the PIC and one professor on the Group. */
async function aTrip(picPersonId: string, teacherPersonId: string) {
  return addPerjadin({
    advanceIdr: 5_000_000,
    picPersonId,
    teachers: [{ personId: teacherPersonId, stream: "STEM" }],
  });
}

/** Every Rating comfortably above the threshold — an overnight trip that went well. */
const FINE: PerjadinEvaluationRatings = { lodging: 9, transport: 9, meals: 9, punctuality: 9 };

/** How many Perjadin Evaluations landed against a trip. */
async function evaluationCount(perjadinId: string) {
  const rows = await db
    .select()
    .from(schema.perjadinEvaluation)
    .where(eq(schema.perjadinEvaluation.perjadinId, perjadinId));
  return rows.length;
}

describe("filePerjadinEvaluation", () => {
  beforeEach(resetDatabase);

  it("files an Evaluation by a Teaching Team Group member", async () => {
    const pic = await staff();
    const teacher = await professor();
    const trip = await aTrip(pic.id, teacher.id);

    const result = await filePerjadinEvaluation(teacher, {
      perjadinId: trip.id,
      ratings: FINE,
      problems: null,
      suggestions: null,
    });

    expect(result.outcome).toBe("filed");
    expect(await evaluationCount(trip.id)).toBe(1);
  });

  it("files an Evaluation by the PIC, who is also a Group member", async () => {
    const pic = await staff();
    const teacher = await professor();
    const trip = await aTrip(pic.id, teacher.id);

    const result = await filePerjadinEvaluation(pic, {
      perjadinId: trip.id,
      ratings: FINE,
      problems: null,
      suggestions: null,
    });

    expect(result.outcome).toBe("filed");
  });

  it("files a day trip with no lodging Rating", async () => {
    const pic = await staff();
    const teacher = await professor();
    const trip = await aTrip(pic.id, teacher.id);

    const result = await filePerjadinEvaluation(teacher, {
      perjadinId: trip.id,
      ratings: { ...FINE, lodging: null },
      problems: null,
      suggestions: null,
    });

    expect(result.outcome).toBe("filed");
  });

  it("refuses a caller who was not on the Group, and writes nothing", async () => {
    const pic = await staff();
    const teacher = await professor();
    const outsider = await professor("dodi@itb.ac.id");
    const trip = await aTrip(pic.id, teacher.id);

    const result = await filePerjadinEvaluation(outsider, {
      perjadinId: trip.id,
      ratings: FINE,
      problems: null,
      suggestions: null,
    });

    expect(result).toEqual({ outcome: "not-a-group-member" });
    expect(await evaluationCount(trip.id)).toBe(0);
  });

  it("refuses a Rating of 7 or below with no prose, and writes nothing", async () => {
    const pic = await staff();
    const teacher = await professor();
    const trip = await aTrip(pic.id, teacher.id);

    const result = await filePerjadinEvaluation(teacher, {
      perjadinId: trip.id,
      ratings: { ...FINE, transport: 4 },
      problems: null,
      suggestions: null,
    });

    expect(result).toEqual({ outcome: "prose-required" });
    expect(await evaluationCount(trip.id)).toBe(0);
  });

  it("files a low Rating once it carries prose", async () => {
    const pic = await staff();
    const teacher = await professor();
    const trip = await aTrip(pic.id, teacher.id);

    const result = await filePerjadinEvaluation(teacher, {
      perjadinId: trip.id,
      ratings: { ...FINE, transport: 4 },
      problems: "Mobil sewaan telat dua jam",
      suggestions: null,
    });

    expect(result.outcome).toBe("filed");
  });

  it("refuses a second Evaluation from the same member for the same trip", async () => {
    const pic = await staff();
    const teacher = await professor();
    const trip = await aTrip(pic.id, teacher.id);
    const evaluation = {
      perjadinId: trip.id,
      ratings: FINE,
      problems: null,
      suggestions: null,
    };

    await filePerjadinEvaluation(teacher, evaluation);
    const again = await filePerjadinEvaluation(teacher, evaluation);

    expect(again).toEqual({ outcome: "already-filed" });
    expect(await evaluationCount(trip.id)).toBe(1);
  });
});

/**
 * The one behaviour `docs/data-model.md` marks load-bearing: **Postgres `least()` ignores
 * NULLs**, so a skipped `lodging` neither trips the elaboration CHECK nor reaches the concerns
 * list. Asserted against the database directly, behind the application half.
 */
describe("the nullable lodging invariant", () => {
  beforeEach(resetDatabase);

  async function aFiler() {
    const pic = await staff();
    const teacher = await professor();
    const trip = await aTrip(pic.id, teacher.id);
    return { teacher, trip };
  }

  it("accepts a null lodging with every other Rating high and no prose", async () => {
    const { teacher, trip } = await aFiler();

    const [row] = await db
      .insert(schema.perjadinEvaluation)
      .values({
        perjadinId: trip.id,
        filedByPersonId: teacher.id,
        lodging: null,
        transport: 9,
        meals: 9,
        punctuality: 9,
        problems: null,
      })
      .returning({ id: schema.perjadinEvaluation.id });

    expect(row?.id).toBeDefined();
  });

  it("still refuses a low non-null Rating with no prose when lodging is null", async () => {
    const { teacher, trip } = await aFiler();

    const refusal = await refusedBy(
      db.insert(schema.perjadinEvaluation).values({
        perjadinId: trip.id,
        filedByPersonId: teacher.id,
        lodging: null,
        transport: 4,
        meals: 9,
        punctuality: 9,
        problems: null,
      }),
    );

    expect(refusal).toBe("perjadin_evaluation_low_rating_needs_prose");
  });

  it("keeps a null-lodging row off the concerns list — least() over its Ratings is not low", async () => {
    const { teacher, trip } = await aFiler();

    await db.insert(schema.perjadinEvaluation).values({
      perjadinId: trip.id,
      filedByPersonId: teacher.id,
      lodging: null,
      transport: 9,
      meals: 9,
      punctuality: 9,
      problems: null,
    });

    // The predicate the concerns index carries, read back against the row, with the threshold
    // from the same constant the schema's index does. An end-to-end exercise of the index waits
    // on the Concerns list that reads it (#34); this pins the behaviour the AC names — a skipped
    // lodging does not drag the minimum to a concern.
    const [row] = await db
      .select({
        concern: sql<boolean>`least(
          ${schema.perjadinEvaluation.lodging},
          ${schema.perjadinEvaluation.transport},
          ${schema.perjadinEvaluation.meals},
          ${schema.perjadinEvaluation.punctuality}
        ) <= ${CONCERN_AT_OR_BELOW}`,
      })
      .from(schema.perjadinEvaluation)
      .where(eq(schema.perjadinEvaluation.perjadinId, trip.id));

    expect(row?.concern).toBe(false);
  });
});
