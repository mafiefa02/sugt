import { db, schema } from "@sugt/db";
import {
  fileClassRecord,
  fileSessionRecord,
  isNotStaffError,
  markSessionDelivered,
  sessionDetail,
  type ClassRecordRatings,
  type SessionRecordRatings,
} from "@sugt/db/queries";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addCluster,
  addPerson,
  addProvince,
  addSchool,
  addSession,
  refusedBy,
  resetDatabase,
} from "./support/fixtures";

/**
 * **The two internal evaluation forms** — a Teaching Team member's Class Record and the
 * PIC's Session Record.
 *
 * Every rule under test is one about *state* or about a row, never about markup: prose is
 * mandatory below the threshold, a Record is owed only on a delivered Session, only a
 * Teaching Team member may file a Class Record and only Staff a Session Record, and each
 * filer files at most one per unit. A test through the form would pass against a write that
 * checked none of them, so long as the form declined to offer the button — so these drive
 * the write functions against a real Postgres and assert on what came back and what landed.
 *
 * **The elaboration rule is enforced twice**, so it is checked twice here: once as the value
 * the application half returns, and once as the CHECK the database holds behind it.
 */

/** The Staff Person who is PIC of the Sessions below. */
async function staff(email = "rina@ditsama.itb.ac.id") {
  return addPerson({ fullName: "Rina Nurhayati", email, role: "Staff" });
}

/** A Teaching Team member, who files Class Records. */
async function professor(email = "bagus@itb.ac.id") {
  return addPerson({ fullName: "Bagus Prakoso", email, role: "Teaching Team" });
}

/** One School to hang Sessions off. */
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

/** A delivered online Session, which is the cheap one — no Perjadin, just a School and a PIC. */
async function deliveredSession(picPersonId: string) {
  const school = await oneSchool();
  return addSession({
    schoolId: school.id,
    heldOn: "2026-09-10",
    status: "delivered",
    onlinePicPersonId: picPersonId,
  });
}

/** Every Rating comfortably above the threshold, so a test reaches the concerns list only where it says so. */
const FINE_CLASS: ClassRecordRatings = {
  comprehension: 9,
  participation: 9,
  readiness: 9,
  materials: 9,
  delivery: 9,
  facilities: 9,
  timing: 9,
};

const FINE_SESSION: SessionRecordRatings = {
  facilities: 9,
  turnout: 9,
  school_support: 9,
  timing: 9,
  coordination: 9,
};

/** How many Class Records landed against a Session. */
async function classRecordCount(sessionId: string) {
  const rows = await db
    .select()
    .from(schema.classRecord)
    .where(eq(schema.classRecord.sessionId, sessionId));
  return rows.length;
}

describe("fileClassRecord", () => {
  beforeEach(resetDatabase);

  it("files a Class Record on a delivered Session by a Teaching Team member", async () => {
    const pic = await staff();
    const teacher = await professor();
    const session = await deliveredSession(pic.id);

    const result = await fileClassRecord(teacher, {
      sessionId: session.id,
      classKind: "GTK",
      ratings: FINE_CLASS,
      covered: "Pengenalan sensor banjir",
      problems: null,
      suggestions: null,
    });

    expect(result.outcome).toBe("filed");
    expect(await classRecordCount(session.id)).toBe(1);
  });

  it("refuses a Rating of 7 or below with no prose, and writes nothing", async () => {
    const pic = await staff();
    const teacher = await professor();
    const session = await deliveredSession(pic.id);

    const result = await fileClassRecord(teacher, {
      sessionId: session.id,
      classKind: "GTK",
      ratings: { ...FINE_CLASS, comprehension: 4 },
      covered: null,
      problems: null,
      suggestions: null,
    });

    expect(result).toEqual({ outcome: "prose-required" });
    expect(await classRecordCount(session.id)).toBe(0);
  });

  it("files a low Rating once it carries prose", async () => {
    const pic = await staff();
    const teacher = await professor();
    const session = await deliveredSession(pic.id);

    const result = await fileClassRecord(teacher, {
      sessionId: session.id,
      classKind: "GTK",
      ratings: { ...FINE_CLASS, comprehension: 4 },
      covered: null,
      problems: "Kelas tertinggal tiga minggu",
      suggestions: null,
    });

    expect(result.outcome).toBe("filed");
  });

  it("refuses a Record on a Session that is not delivered", async () => {
    const pic = await staff();
    const teacher = await professor();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      status: "arranged",
      onlinePicPersonId: pic.id,
    });

    const result = await fileClassRecord(teacher, {
      sessionId: session.id,
      classKind: "GTK",
      ratings: FINE_CLASS,
      covered: null,
      problems: null,
      suggestions: null,
    });

    expect(result).toEqual({ outcome: "session-not-delivered", status: "arranged" });
    expect(await classRecordCount(session.id)).toBe(0);
  });

  it("refuses a caller who is not Teaching Team, and writes nothing", async () => {
    const pic = await staff();
    const otherStaff = await addPerson({
      fullName: "Dewi",
      email: "dewi@ditsama.itb.ac.id",
      role: "Staff",
    });
    const session = await deliveredSession(pic.id);

    const result = await fileClassRecord(otherStaff, {
      sessionId: session.id,
      classKind: "GTK",
      ratings: FINE_CLASS,
      covered: null,
      problems: null,
      suggestions: null,
    });

    expect(result).toEqual({ outcome: "not-teaching-team" });
    expect(await classRecordCount(session.id)).toBe(0);
  });

  it("refuses a second Record from the same professor for the same Class", async () => {
    const pic = await staff();
    const teacher = await professor();
    const session = await deliveredSession(pic.id);
    const record = {
      sessionId: session.id,
      classKind: "GTK" as const,
      ratings: FINE_CLASS,
      covered: null,
      problems: null,
      suggestions: null,
    };

    await fileClassRecord(teacher, record);
    const again = await fileClassRecord(teacher, record);

    expect(again).toEqual({ outcome: "already-filed" });
    expect(await classRecordCount(session.id)).toBe(1);
  });

  it("the database CHECK refuses a low Rating with no prose, behind the application half", async () => {
    const teacher = await professor();
    const session = await deliveredSession((await staff()).id);

    const refusal = await refusedBy(
      db.insert(schema.classRecord).values({
        sessionId: session.id,
        classKind: "GTK",
        filedByPersonId: teacher.id,
        filedByRole: "Teaching Team",
        ...FINE_CLASS,
        comprehension: 4,
        problems: null,
      }),
    );

    expect(refusal).toBe("class_record_low_rating_needs_prose");
  });

  it("the composite foreign key refuses a Staff filer, which is what makes only Teaching Team file", async () => {
    const pic = await staff();
    const session = await deliveredSession(pic.id);

    const refusal = await refusedBy(
      db.insert(schema.classRecord).values({
        sessionId: session.id,
        classKind: "GTK",
        filedByPersonId: pic.id,
        filedByRole: "Teaching Team",
        ...FINE_CLASS,
      }),
    );

    expect(refusal).toBe("class_record_filed_by_teaching_team");
  });

  it("a filed Record leaves the owed list on Detail Sesi", async () => {
    const pic = await staff();
    const stem = await professor("stem@itb.ac.id");
    const research = await addPerson({
      fullName: "Sari Dewi",
      email: "sari@itb.ac.id",
      role: "Teaching Team",
    });
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      status: "arranged",
      onlinePicPersonId: pic.id,
    });
    // Two professors named makes the expected set six Class Records, plus the PIC's Session Record.
    await markSessionDelivered(pic, session.id, [
      { stream: "STEM", personId: stem.id },
      { stream: "Research", personId: research.id },
    ]);

    const before = await sessionDetail(pic, session.id);
    expect(before?.owed).toHaveLength(7);

    await fileClassRecord(stem, {
      sessionId: session.id,
      classKind: "GTK",
      ratings: FINE_CLASS,
      covered: null,
      problems: null,
      suggestions: null,
    });

    const after = await sessionDetail(pic, session.id);
    expect(after?.classRecordsFiled).toBe(1);
    expect(after?.owed).toHaveLength(6);
    expect(after?.owed).not.toContainEqual({
      kind: "class-record",
      personId: stem.id,
      fullName: stem.fullName,
      classKind: "GTK",
    });
  });
});

describe("fileSessionRecord", () => {
  beforeEach(resetDatabase);

  /** How many Session Records landed against a Session. */
  async function sessionRecordCount(sessionId: string) {
    const rows = await db
      .select()
      .from(schema.sessionRecord)
      .where(eq(schema.sessionRecord.sessionId, sessionId));
    return rows.length;
  }

  it("files a Session Record on a delivered Session by Staff", async () => {
    const pic = await staff();
    const session = await deliveredSession(pic.id);

    const result = await fileSessionRecord(pic, {
      sessionId: session.id,
      ratings: FINE_SESSION,
      problems: null,
      suggestions: null,
    });

    expect(result.outcome).toBe("filed");
    expect(await sessionRecordCount(session.id)).toBe(1);
  });

  it("refuses a Rating of 7 or below with no prose, and writes nothing", async () => {
    const pic = await staff();
    const session = await deliveredSession(pic.id);

    const result = await fileSessionRecord(pic, {
      sessionId: session.id,
      ratings: { ...FINE_SESSION, turnout: 3 },
      problems: null,
      suggestions: null,
    });

    expect(result).toEqual({ outcome: "prose-required" });
    expect(await sessionRecordCount(session.id)).toBe(0);
  });

  it("refuses a Record on a Session that is not delivered", async () => {
    const pic = await staff();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      status: "arranged",
      onlinePicPersonId: pic.id,
    });

    const result = await fileSessionRecord(pic, {
      sessionId: session.id,
      ratings: FINE_SESSION,
      problems: null,
      suggestions: null,
    });

    expect(result).toEqual({ outcome: "session-not-delivered", status: "arranged" });
  });

  it("throws NotStaffError for a Teaching Team caller", async () => {
    const pic = await staff();
    const teacher = await professor();
    const session = await deliveredSession(pic.id);

    const refusal = await fileSessionRecord(teacher, {
      sessionId: session.id,
      ratings: FINE_SESSION,
      problems: null,
      suggestions: null,
    }).catch((error: unknown) => error);

    expect(isNotStaffError(refusal)).toBe(true);
    expect(await sessionRecordCount(session.id)).toBe(0);
  });

  it("refuses a second Record from the same Staff member for the same Session", async () => {
    const pic = await staff();
    const session = await deliveredSession(pic.id);
    const record = {
      sessionId: session.id,
      ratings: FINE_SESSION,
      problems: null,
      suggestions: null,
    };

    await fileSessionRecord(pic, record);
    const again = await fileSessionRecord(pic, record);

    expect(again).toEqual({ outcome: "already-filed" });
    expect(await sessionRecordCount(session.id)).toBe(1);
  });

  it("the database CHECK refuses a low Rating with no prose, behind the application half", async () => {
    const pic = await staff();
    const session = await deliveredSession(pic.id);

    const refusal = await refusedBy(
      db.insert(schema.sessionRecord).values({
        sessionId: session.id,
        filedByPersonId: pic.id,
        filedByRole: "Staff",
        facilities: FINE_SESSION.facilities,
        turnout: 3,
        schoolSupport: FINE_SESSION.school_support,
        timing: FINE_SESSION.timing,
        coordination: FINE_SESSION.coordination,
        problems: null,
      }),
    );

    expect(refusal).toBe("session_record_low_rating_needs_prose");
  });
});
