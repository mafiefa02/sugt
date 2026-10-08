import { submitFeedbackAction } from "-/app/f/[token]/actions";
import {
  answersForClass,
  askedAspects,
  feedbackSubmission,
} from "-/app/f/[token]/feedback-answers";
import { resolveFeedbackToken } from "-/lib/feedback-token";
import { db, schema } from "@sugt/db";
import {
  cancelSession,
  issueFeedbackToken,
  submitParticipantFeedback,
  type ParticipantFeedbackAnswers,
  type ParticipantFeedbackComments,
  type ParticipantFeedbackRatings,
} from "@sugt/db/queries";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addCluster,
  addFeedbackToken,
  addPerson,
  addProvince,
  addSchool,
  addSession,
  refusedBy,
  resetDatabase,
} from "./support/fixtures";
import { overlappingAtInsert } from "./support/overlap";

/**
 * **Participant Feedback** — the token a Session hands out, the resolution that turns it into a
 * caller, and the one write it authorises. This is the only write path in either app with no
 * signed-in Person, so the rules under test are all about the token: who may mint it, that it is
 * never replaced and never expires (ADR-0049), and that a dead one lets nobody write.
 */

async function staff(email = "rina@ditsama.itb.ac.id") {
  return addPerson({ fullName: "Rina Nurhayati", email, role: "Staff" });
}

async function oneSchool() {
  await addProvince("JB", "Jawa Barat");
  const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
  return addSchool({
    slug: "sman-1-bandung",
    name: "SMAN 1 Bandung",
    clusterId: cluster.id,
    provinceCode: "JB",
  });
}

async function aSession(
  picPersonId: string,
  status: "arranged" | "delivered" | "cancelled" = "arranged",
) {
  const school = await oneSchool();
  return addSession({
    schoolId: school.id,
    heldOn: "2026-09-10",
    status,
  });
}

/** A GTK or MS Participant's Ratings: the three every Class is asked, and no Hands-on RBL. */
const FINE: ParticipantFeedbackRatings = {
  hands_on_rbl: null,
  materials: 9,
  instructor: 9,
  relevance: 9,
};

/** A Siswa's: the same three, and Hands-on RBL too (#446). */
const SISWA: ParticipantFeedbackRatings = { ...FINE, hands_on_rbl: 9 };

/** No comment on any Aspect — the common case, a Participant owing none. */
const NO_COMMENTS: ParticipantFeedbackComments = {
  hands_on_rbl: null,
  materials: null,
  instructor: null,
  relevance: null,
};

/** Neither written question answered — both are optional. */
const NO_ANSWERS: ParticipantFeedbackAnswers = { knowledgeGain: null, suggestions: null };

async function tokenRows(sessionId: string) {
  return db
    .select()
    .from(schema.sessionFeedbackToken)
    .where(eq(schema.sessionFeedbackToken.sessionId, sessionId));
}

async function feedbackRows(sessionId: string) {
  return db
    .select()
    .from(schema.participantFeedback)
    .where(eq(schema.participantFeedback.sessionId, sessionId));
}

describe("issueFeedbackToken", () => {
  beforeEach(resetDatabase);

  it("issues a token on an arranged Session", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "arranged");

    const result = await issueFeedbackToken(pic, session.id);

    expect(result.outcome).toBe("issued");
    expect((await tokenRows(session.id)).length).toBe(1);
  });

  it("issues a token on a delivered Session", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "delivered");

    const result = await issueFeedbackToken(pic, session.id);

    expect(result.outcome).toBe("issued");
  });

  // The former "lets anyone signed in issue it, not only Staff" test is gone: `issueFeedbackToken`
  // still skips `requireStaff` (it is deliberately open to any signed-in caller), but it writes
  // `caller.id` as `issued_by_person_id`, a foreign key into `person`. T3 (#153) retired the one
  // non-Staff Role, so there is no non-Staff Person to issue a token as — a cast caller would fail
  // the foreign key rather than exercise the guard, so the non-Staff dimension is no longer
  // expressible. The open path stays covered by the Staff issuers above.

  it("refuses a cancelled Session, and writes no token", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "cancelled");

    const result = await issueFeedbackToken(pic, session.id);

    expect(result).toEqual({ outcome: "session-cancelled" });
    expect((await tokenRows(session.id)).length).toBe(0);
  });

  it("a second press returns the same link, so the printed one keeps working", async () => {
    const pic = await staff();
    const colleague = await staff("dewi@ditsama.itb.ac.id");
    const session = await aSession(pic.id, "arranged");

    const first = await issueFeedbackToken(pic, session.id);
    const second = await issueFeedbackToken(colleague, session.id);

    expect(second).toEqual(first);
    expect((await tokenRows(session.id)).length).toBe(1);
    if (first.outcome !== "issued") throw new Error("unreachable");
    expect((await resolveFeedbackToken(first.token)).outcome).toBe("open");
  });

  it("two presses at the same moment get the same link, and one row", async () => {
    const pic = await staff();
    const colleague = await staff("dewi@ditsama.itb.ac.id");
    const session = await aSession(pic.id, "arranged");

    const presses = await overlappingAtInsert("session_feedback_token", [
      () => issueFeedbackToken(pic, session.id),
      () => issueFeedbackToken(colleague, session.id),
      () => issueFeedbackToken(pic, session.id),
    ]);

    expect(new Set(presses.map((p) => (p.outcome === "issued" ? p.token : p.outcome))).size).toBe(
      1,
    );
    expect((await tokenRows(session.id)).length).toBe(1);
  });

  it("returns the original of several links — the earliest issued, then the lowest token", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "delivered");
    const day = 24 * 60 * 60 * 1000;
    const issuedAt = new Date(Date.now() - 10 * day);
    // Two issued in the same instant, and one reattached today by `db:reattach-links`.
    await addFeedbackToken({
      sessionId: session.id,
      issuedByPersonId: pic.id,
      token: "b0000000-0000-4000-8000-000000000000",
      issuedAt,
    });
    await addFeedbackToken({
      sessionId: session.id,
      issuedByPersonId: pic.id,
      token: "a0000000-0000-4000-8000-000000000000",
      issuedAt,
    });
    await addFeedbackToken({
      sessionId: session.id,
      issuedByPersonId: pic.id,
      token: "00000000-0000-4000-8000-000000000000",
    });

    expect(await issueFeedbackToken(pic, session.id)).toEqual({
      outcome: "issued",
      token: "a0000000-0000-4000-8000-000000000000",
    });
    expect((await tokenRows(session.id)).length).toBe(3);
  });
});

describe("resolveFeedbackToken", () => {
  beforeEach(resetDatabase);

  it("resolves a live token to a participant caller for its Session", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "delivered");
    const token = await addFeedbackToken({ sessionId: session.id, issuedByPersonId: pic.id });

    const resolved = await resolveFeedbackToken(token.token);

    expect(resolved).toEqual({
      outcome: "open",
      caller: { kind: "participant", sessionId: session.id },
    });
  });

  it("is gone for an unknown token", async () => {
    expect(await resolveFeedbackToken("no-such-token")).toEqual({ outcome: "gone" });
  });

  it("still resolves a token issued weeks ago — a link never expires", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "delivered");
    const day = 24 * 60 * 60 * 1000;
    const token = await addFeedbackToken({
      sessionId: session.id,
      issuedByPersonId: pic.id,
      issuedAt: new Date(Date.now() - 400 * day),
    });

    expect(await resolveFeedbackToken(token.token)).toEqual({
      outcome: "open",
      caller: { kind: "participant", sessionId: session.id },
    });
  });

  it("is gone for a cancelled Session's token", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "arranged");
    const token = await addFeedbackToken({ sessionId: session.id, issuedByPersonId: pic.id });
    await cancelSession(pic, session.id, "Sekolah meminta penjadwalan ulang");

    expect(await resolveFeedbackToken(token.token)).toEqual({ outcome: "gone" });
  });
});

describe("submitParticipantFeedback", () => {
  beforeEach(resetDatabase);

  it("inserts one feedback row for the token's Session", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "delivered");

    const result = await submitParticipantFeedback(
      { kind: "participant", sessionId: session.id },
      {
        classKind: "Student",
        name: "Siti",
        ratings: SISWA,
        comments: {
          ...NO_COMMENTS,
          materials: "Bahannya lengkap",
          instructor: "Seru sekali",
        },
        answers: NO_ANSWERS,
      },
    );

    expect(result).toEqual({ outcome: "submitted" });
    const rows = await feedbackRows(session.id);
    expect(rows.length).toBe(1);
    expect(rows[0]?.name).toBe("Siti");
    // Each comment lands against its own Aspect, and a blank one stays null.
    expect(rows[0]?.materialsComment).toBe("Bahannya lengkap");
    expect(rows[0]?.instructorComment).toBe("Seru sekali");
    expect(rows[0]?.relevanceComment).toBeNull();
  });

  it("stores a blank per-Aspect comment as null", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "delivered");

    await submitParticipantFeedback(
      { kind: "participant", sessionId: session.id },
      {
        classKind: "GTK",
        name: "Budi",
        ratings: FINE,
        comments: { ...NO_COMMENTS, materials: "   ", relevance: "  " },
        answers: { knowledgeGain: "  ", suggestions: "" },
      },
    );

    const rows = await feedbackRows(session.id);
    expect(rows[0]?.materialsComment).toBeNull();
    expect(rows[0]?.instructorComment).toBeNull();
    expect(rows[0]?.relevanceComment).toBeNull();
    expect(rows[0]?.knowledgeGain).toBeNull();
    expect(rows[0]?.suggestions).toBeNull();
  });

  it("refuses a blank name, and writes nothing", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "delivered");

    const result = await submitParticipantFeedback(
      { kind: "participant", sessionId: session.id },
      { classKind: "MS", name: "   ", ratings: FINE, comments: NO_COMMENTS, answers: NO_ANSWERS },
    );

    expect(result).toEqual({ outcome: "name-required" });
    expect((await feedbackRows(session.id)).length).toBe(0);
  });

  it("keeps no elaboration rule — a low Rating with no comment still submits", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "delivered");

    const result = await submitParticipantFeedback(
      { kind: "participant", sessionId: session.id },
      {
        classKind: "Student",
        name: "Ayu",
        ratings: { ...SISWA, instructor: 2 },
        comments: NO_COMMENTS,
        answers: NO_ANSWERS,
      },
    );

    expect(result).toEqual({ outcome: "submitted" });
    expect((await feedbackRows(session.id)).length).toBe(1);
  });
});

/**
 * The submit Server Action, which is what actually guards the write: it re-resolves the token
 * server-side rather than trusting the page that rendered the form. A form left open while the
 * Session is cancelled must fail here — this is the test that would catch a refactor moving
 * resolution to the page alone.
 */
describe("submitFeedbackAction", () => {
  beforeEach(resetDatabase);

  it("inserts through a live token", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "delivered");
    const token = await addFeedbackToken({ sessionId: session.id, issuedByPersonId: pic.id });

    const result = await submitFeedbackAction(token.token, {
      classKind: "GTK",
      name: "Budi",
      ratings: FINE,
      comments: NO_COMMENTS,
      answers: NO_ANSWERS,
    });

    expect(result).toEqual({ outcome: "submitted" });
    expect((await feedbackRows(session.id)).length).toBe(1);
  });

  it("lands through a token issued weeks ago", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "delivered");
    const day = 24 * 60 * 60 * 1000;
    const token = await addFeedbackToken({
      sessionId: session.id,
      issuedByPersonId: pic.id,
      issuedAt: new Date(Date.now() - 30 * day),
    });

    const result = await submitFeedbackAction(token.token, {
      classKind: "Student",
      name: "Siti",
      ratings: SISWA,
      comments: NO_COMMENTS,
      answers: NO_ANSWERS,
    });

    expect(result).toEqual({ outcome: "submitted" });
    expect((await feedbackRows(session.id)).length).toBe(1);
  });

  it("stores a submission through each of a Session's several links against that Session", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "delivered");
    const other = await addSession({
      schoolId: session.schoolId,
      heldOn: "2026-09-11",
      status: "delivered",
    });
    const issued = await issueFeedbackToken(pic, session.id);
    if (issued.outcome !== "issued") throw new Error("unreachable");
    const reattached = await addFeedbackToken({ sessionId: session.id, issuedByPersonId: pic.id });
    await addFeedbackToken({ sessionId: other.id, issuedByPersonId: pic.id });

    for (const [token, name] of [
      [issued.token, "Budi"],
      [reattached.token, "Siti"],
    ] as const) {
      expect(await resolveFeedbackToken(token)).toEqual({
        outcome: "open",
        caller: { kind: "participant", sessionId: session.id },
      });
      const result = await submitFeedbackAction(token, {
        classKind: "GTK",
        name,
        ratings: FINE,
        comments: NO_COMMENTS,
        answers: NO_ANSWERS,
      });
      expect(result).toEqual({ outcome: "submitted" });
    }

    expect((await feedbackRows(session.id)).map((row) => row.name).sort()).toEqual([
      "Budi",
      "Siti",
    ]);
    expect(await feedbackRows(other.id)).toEqual([]);
  });

  it("writes nothing once the Session is cancelled after the form was rendered", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "arranged");
    const first = await issueFeedbackToken(pic, session.id);
    if (first.outcome !== "issued") throw new Error("unreachable");
    await cancelSession(pic, session.id, "Sekolah meminta penjadwalan ulang");

    const result = await submitFeedbackAction(first.token, {
      classKind: "Student",
      name: "Siti",
      ratings: SISWA,
      comments: NO_COMMENTS,
      answers: NO_ANSWERS,
    });

    expect(result).toEqual({ outcome: "gone" });
    expect((await feedbackRows(session.id)).length).toBe(0);
  });
});

/**
 * **The ticket's worked examples** (#446): a Siswa is asked Hands-on RBL first and must Rate it; GTK
 * and MS are never asked it, and the database refuses one on their rows; the two written questions
 * are optional and are not Aspects.
 */
describe("Hands-on RBL and the written questions (#446)", () => {
  beforeEach(resetDatabase);

  const as = (sessionId: string) => ({ kind: "participant" as const, sessionId });

  it("stores Rani's four Ratings, her RBL comment and both written answers", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "delivered");

    const result = await submitParticipantFeedback(as(session.id), {
      classKind: "Student",
      name: "Rani",
      ratings: { hands_on_rbl: 8, materials: 9, instructor: 7, relevance: 9 },
      comments: { ...NO_COMMENTS, hands_on_rbl: "  Modulnya seru  " },
      answers: { knowledgeGain: "Ya, bertambah.", suggestions: " Tambah waktu praktik. " },
    });

    expect(result).toEqual({ outcome: "submitted" });
    const [row] = await feedbackRows(session.id);
    expect(row).toMatchObject({
      handsOnRbl: 8,
      materials: 9,
      instructor: 7,
      relevance: 9,
      handsOnRblComment: "Modulnya seru",
      knowledgeGain: "Ya, bertambah.",
      suggestions: "Tambah waktu praktik.",
    });
  });

  it("refuses a Siswa with no Hands-on RBL Rating, like a missing Materi, and writes nothing", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "delivered");

    for (const ratings of [FINE, { ...SISWA, materials: null }]) {
      await expect(
        submitParticipantFeedback(as(session.id), {
          classKind: "Student",
          name: "Rani",
          ratings,
          comments: NO_COMMENTS,
          answers: NO_ANSWERS,
        }),
      ).resolves.toEqual({ outcome: "ratings-mismatch" });
    }
    expect(await feedbackRows(session.id)).toHaveLength(0);
  });

  it("refuses Pak Tono's GTK Hands-on RBL Rating at the write, and drops a stray RBL comment", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "delivered");

    await expect(
      submitParticipantFeedback(as(session.id), {
        classKind: "GTK",
        name: "Pak Tono",
        ratings: SISWA,
        comments: NO_COMMENTS,
        answers: NO_ANSWERS,
      }),
    ).resolves.toEqual({ outcome: "ratings-mismatch" });
    await expect(
      submitParticipantFeedback(as(session.id), {
        classKind: "GTK",
        name: "Pak Tono",
        ratings: FINE,
        comments: { ...NO_COMMENTS, hands_on_rbl: "tertinggal" },
        answers: NO_ANSWERS,
      }),
    ).resolves.toEqual({ outcome: "submitted" });

    const rows = await feedbackRows(session.id);
    expect(rows).toEqual([expect.objectContaining({ handsOnRbl: null, handsOnRblComment: null })]);
  });

  it("holds the Student-only rule and the 1–10 bound at the database, and keeps older Siswa rows valid", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "delivered");
    const insert = (row: Partial<typeof schema.participantFeedback.$inferInsert>) =>
      db.insert(schema.participantFeedback).values({
        sessionId: session.id,
        classKind: "GTK",
        name: "Langsung",
        materials: 9,
        instructor: 9,
        relevance: 9,
        ...row,
      });

    await expect(refusedBy(insert({ handsOnRbl: 8 }))).resolves.toBe(
      "participant_feedback_hands_on_rbl_student_check",
    );
    await expect(refusedBy(insert({ classKind: "MS", handsOnRblComment: "x" }))).resolves.toBe(
      "participant_feedback_hands_on_rbl_student_check",
    );
    await expect(refusedBy(insert({ classKind: "Student", handsOnRbl: 11 }))).resolves.toBe(
      "participant_feedback_hands_on_rbl_check",
    );
    // A Siswa row filed before Hands-on RBL existed: no RBL Rating, and still valid.
    await expect(refusedBy(insert({ classKind: "Student" }))).resolves.toBeNull();
    await expect(refusedBy(insert({ classKind: "Student", handsOnRbl: 1 }))).resolves.toBeNull();
  });
});

describe("submitFeedbackAction, after #446", () => {
  beforeEach(resetDatabase);

  it("refuses a Siswa submission without a Hands-on RBL Rating, and writes nothing", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "delivered");
    const token = await addFeedbackToken({ sessionId: session.id, issuedByPersonId: pic.id });

    const result = await submitFeedbackAction(token.token, {
      classKind: "Student",
      name: "Rani",
      ratings: FINE,
      comments: NO_COMMENTS,
      answers: NO_ANSWERS,
    });

    expect(result).toEqual({ outcome: "ratings-mismatch" });
    expect(await feedbackRows(session.id)).toHaveLength(0);
  });

  it("still lands a GTK submission from a form loaded before #446, with no answers or RBL", async () => {
    const pic = await staff();
    const session = await aSession(pic.id, "delivered");
    const token = await addFeedbackToken({ sessionId: session.id, issuedByPersonId: pic.id });

    // The pre-#446 payload: three Ratings, three comments, no `answers`.
    const result = await submitFeedbackAction(token.token, {
      classKind: "GTK",
      name: "Budi",
      ratings: { materials: 9, instructor: 9, relevance: 9 },
      comments: { materials: null, instructor: null, relevance: null },
    } as never);

    expect(result).toEqual({ outcome: "submitted" });
    expect(await feedbackRows(session.id)).toEqual([
      expect.objectContaining({ handsOnRbl: null, knowledgeGain: null, suggestions: null }),
    ]);
  });
});

describe("the form's answers (#446)", () => {
  it("asks a Siswa Hands-on RBL first, GTK and MS never, and every Class's three before one is picked", () => {
    expect(askedAspects("Student")).toEqual([
      "hands_on_rbl",
      "materials",
      "instructor",
      "relevance",
    ]);
    expect(askedAspects("GTK")).toEqual(["materials", "instructor", "relevance"]);
    expect(askedAspects("MS")).toEqual(["materials", "instructor", "relevance"]);
    expect(askedAspects(undefined)).toEqual(["materials", "instructor", "relevance"]);
  });

  it("drops Rani's Hands-on RBL when she switches from Siswa to GTK, and sends none", () => {
    const ratings = answersForClass("GTK", { hands_on_rbl: 4, materials: 9 });
    const comments = answersForClass("GTK", { hands_on_rbl: "sulit", materials: "bagus" });

    expect(ratings).toEqual({ materials: 9 });
    expect(comments).toEqual({ materials: "bagus" });
    expect(
      feedbackSubmission({
        classKind: "GTK",
        name: " Rani ",
        ratings: { ...ratings, instructor: 9, relevance: 9 },
        comments,
        knowledgeGain: "",
        suggestions: "  ",
      }),
    ).toEqual({
      classKind: "GTK",
      name: "Rani",
      ratings: FINE,
      comments: { ...NO_COMMENTS, materials: "bagus" },
      answers: NO_ANSWERS,
    });
  });
});
