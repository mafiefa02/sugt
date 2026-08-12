import { db, schema } from "@sugt/db";
import {
  cancelSession,
  correctSessionTeachers,
  isNotStaffError,
  markSessionDelivered,
  moveSessionDate,
  sessionDetail,
} from "@sugt/db/queries";
import { CLASS_KINDS } from "@sugt/domain";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addClassRecord,
  addCluster,
  addOfflineSession,
  addPerjadin,
  addPerson,
  addProvince,
  addSchool,
  addSession,
  addSessionRecord,
  resetDatabase,
} from "./support/fixtures";

/**
 * **Detail Sesi**, and the three writes it offers — Tandai terlaksana, Batalkan Sesi and
 * moving a date.
 *
 * Every block here drives the write function against a real Postgres rather than the
 * screen, because every rule this ticket adds is a rule about *state* rather than about
 * markup: `delivered` is terminal, cancelling is offered only while `arranged`, a moved
 * date re-checks the per-day index, and an arranged offline Session stays inside its
 * Perjadin's window. A test through the form would pass against a function that checks
 * none of them, so long as the form did not offer the button.
 */

/** The Staff Person who is PIC of everything below. */
async function staff(email = "rina@ditsama.itb.ac.id") {
  return addPerson({ fullName: "Rina Nurhayati", email, role: "Staff" });
}

/** Two Teaching Team members, one per Stream. */
async function professors() {
  return Promise.all([
    addPerson({ fullName: "Bagus Prakoso", email: "bagus@itb.ac.id", role: "Teaching Team" }),
    addPerson({ fullName: "Sari Dewi", email: "sari@itb.ac.id", role: "Teaching Team" }),
  ]);
}

/** One School to hang Sessions off. */
async function oneSchool(slug = "sman-1-bandung") {
  await addProvince("JB", "Jawa Barat");
  const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
  return addSchool({
    slug,
    name: "SMAN 1 Bandung",
    clusterId: cluster.id,
    provinceCode: "JB",
  });
}

/** The status a Session actually holds, read back from the database rather than trusted. */
async function statusOf(sessionId: string) {
  const [row] = await db
    .select({ status: schema.session.status })
    .from(schema.session)
    .where(eq(schema.session.id, sessionId));
  return row?.status ?? null;
}

/** The `session_teacher` rows a Session actually holds. */
async function teachersOf(sessionId: string) {
  return db
    .select({ stream: schema.sessionTeacher.stream, personId: schema.sessionTeacher.personId })
    .from(schema.sessionTeacher)
    .where(eq(schema.sessionTeacher.sessionId, sessionId));
}

describe("Detail Sesi", () => {
  beforeEach(resetDatabase);

  it("reports the PIC of an online Session from the Session itself", async () => {
    const pic = await staff();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });

    const detail = await sessionDetail(pic, session.id);

    expect(detail?.picFullName).toBe("Rina Nurhayati");
    expect(detail?.schoolName).toBe("SMAN 1 Bandung");
    expect(detail?.perjadin).toBeNull();
  });

  /**
   * The `coalesce` the criterion names. An offline Session carries no PIC columns of its
   * own — the composite foreign key is `MATCH SIMPLE` precisely so it may not — so its
   * PIC has to come from the Perjadin, which makes this a query and not a column.
   */
  it("reports the PIC of an offline Session from its Perjadin", async () => {
    const pic = await staff();
    const school = await oneSchool();
    const perjadin = await addPerjadin({
      picPersonId: pic.id,
      advanceIdr: 5_000_000,
      startsOn: "2026-09-01",
      endsOn: "2026-09-03",
    });
    const session = await addOfflineSession({
      schoolId: school.id,
      heldOn: "2026-09-02",
      perjadinId: perjadin.id,
    });

    const detail = await sessionDetail(pic, session.id);

    expect(detail?.picFullName).toBe("Rina Nurhayati");
    expect(detail?.perjadin).toEqual({
      id: perjadin.id,
      startsOn: "2026-09-01",
      endsOn: "2026-09-03",
    });
  });

  it("is open to a Teaching Team caller, because a Session carries no money", async () => {
    const pic = await staff();
    const [bagus] = await professors();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });

    await expect(sessionDetail(bagus, session.id)).resolves.not.toBeNull();
  });

  it("is null for an id naming no Session, which is what a stale link is", async () => {
    const pic = await staff();
    await oneSchool();

    expect(await sessionDetail(pic, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  /**
   * The criterion the wayfinder calls the worst failure available: an *arranged* online
   * Session already names its professors, so a chase list that did not filter on
   * `delivered` would report six Class Records owed for teaching that has not happened.
   */
  it("owes nothing while a Session is arranged, even though it already names teachers", async () => {
    const pic = await staff();
    const [bagus, sari] = await professors();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });
    await db.insert(schema.sessionTeacher).values([
      { sessionId: session.id, stream: "STEM", personId: bagus.id },
      { sessionId: session.id, stream: "Research", personId: sari.id },
    ]);

    const detail = await sessionDetail(pic, session.id);

    expect(detail?.teachers).toHaveLength(2);
    expect(detail?.owed).toEqual([]);
  });

  it("owes one row per named teacher per Class kind, plus the PIC's Session Record", async () => {
    const pic = await staff();
    const [bagus, sari] = await professors();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });
    await markSessionDelivered(pic, session.id, [
      { stream: "STEM", personId: bagus.id },
      { stream: "Research", personId: sari.id },
    ]);

    const detail = await sessionDetail(pic, session.id);

    // Two professors across three Class kinds, and one Session Record from the PIC.
    expect(detail?.owed).toHaveLength(2 * CLASS_KINDS.length + 1);
    expect(detail?.owed.filter((row) => row.kind === "session-record")).toHaveLength(1);
  });

  /**
   * Expected is computed from the teachers a Session **names**, never from
   * `CLASS_RECORDS_PER_SESSION`. The constant assumes both Streams are named, which is
   * true after Tandai terlaksana and not before — so a Session naming one professor
   * would otherwise show three units of debt attached to nobody.
   */
  it("counts expected Class Records from the teachers actually named", async () => {
    const pic = await staff();
    const [bagus] = await professors();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });
    await db
      .insert(schema.sessionTeacher)
      .values([{ sessionId: session.id, stream: "STEM", personId: bagus.id }]);

    const detail = await sessionDetail(pic, session.id);

    expect(detail?.classRecordsExpected).toBe(CLASS_KINDS.length);
  });

  /**
   * `class_record` has **no foreign key to `session_teacher`** — it references
   * `session (id)` and `person (id, role)` only — so a Record filed by somebody the
   * Session never named is a legal row. The screen shows both numbers and reconciles
   * neither, because the database permits the divergence deliberately.
   */
  it("shows filed above expected when somebody the Session never named files a Record", async () => {
    const pic = await staff();
    const [bagus, sari] = await professors();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });
    await db
      .insert(schema.sessionTeacher)
      .values([{ sessionId: session.id, stream: "STEM", personId: bagus.id }]);
    for (const classKind of CLASS_KINDS) {
      await addClassRecord({ sessionId: session.id, classKind, filedByPersonId: bagus.id });
      await addClassRecord({ sessionId: session.id, classKind, filedByPersonId: sari.id });
    }

    const detail = await sessionDetail(pic, session.id);

    expect(detail?.classRecordsExpected).toBe(CLASS_KINDS.length);
    expect(detail?.classRecordsFiled).toBe(2 * CLASS_KINDS.length);
  });

  /**
   * The pre-fill the criterion names. It is read from `group_member` on every open rather
   * than copied into `session_teacher` at arrangement — a Group is replaced wholesale, so
   * a copy taken then would be stranded by a substitution with nothing to catch it.
   */
  it("suggests the Group's Stream assignments for an offline Session", async () => {
    const pic = await staff();
    const [bagus, sari] = await professors();
    const school = await oneSchool();
    const perjadin = await addPerjadin({
      picPersonId: pic.id,
      advanceIdr: 5_000_000,
      startsOn: "2026-09-01",
      endsOn: "2026-09-03",
      teachers: [
        { personId: bagus.id, stream: "STEM" },
        { personId: sari.id, stream: "Research" },
      ],
    });
    const session = await addOfflineSession({
      schoolId: school.id,
      heldOn: "2026-09-02",
      perjadinId: perjadin.id,
    });

    const detail = await sessionDetail(pic, session.id);

    expect(detail?.suggestedTeachers).toEqual([
      { stream: "Research", personId: sari.id, fullName: "Sari Dewi" },
      { stream: "STEM", personId: bagus.id, fullName: "Bagus Prakoso" },
    ]);
  });

  /** An online Session has no Perjadin and therefore no Group to read a suggestion from. */
  it("suggests nobody for an online Session", async () => {
    const pic = await staff();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });

    expect((await sessionDetail(pic, session.id))?.suggestedTeachers).toEqual([]);
  });

  /** The pickers offer active Teaching Team members, and Staff are not among them. */
  it("offers the Teaching Team roster and nobody else", async () => {
    const pic = await staff();
    const [bagus] = await professors();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });

    const detail = await sessionDetail(pic, session.id);

    expect(detail?.teachingTeam.map((entry) => entry.id)).toContain(bagus.id);
    expect(detail?.teachingTeam.map((entry) => entry.id)).not.toContain(pic.id);
  });

  it("stops owing a Session Record once the PIC files one", async () => {
    const pic = await staff();
    const [bagus, sari] = await professors();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });
    await markSessionDelivered(pic, session.id, [
      { stream: "STEM", personId: bagus.id },
      { stream: "Research", personId: sari.id },
    ]);
    await addSessionRecord({ sessionId: session.id, filedByPersonId: pic.id });

    const detail = await sessionDetail(pic, session.id);

    expect(detail?.owed.filter((row) => row.kind === "session-record")).toEqual([]);
  });
});

describe("Tandai terlaksana", () => {
  beforeEach(resetDatabase);

  async function arrangedOnlineSession() {
    const pic = await staff();
    const [bagus, sari] = await professors();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });
    return { pic, bagus, sari, school, session };
  }

  it("writes the status and who taught as one act", async () => {
    const { pic, bagus, sari, session } = await arrangedOnlineSession();

    const result = await markSessionDelivered(pic, session.id, [
      { stream: "STEM", personId: bagus.id },
      { stream: "Research", personId: sari.id },
    ]);

    expect(result.outcome).toBe("delivered");
    expect(await statusOf(session.id)).toBe("delivered");
    expect(await teachersOf(session.id)).toHaveLength(2);
  });

  /**
   * The rule `data-model.md` places at exactly this point. It is refused as a **value**
   * rather than as a throw: a form submitted with one Stream empty is a user state, and
   * the rule settled on the query layer is that a state reachable from correct UI gets a
   * field-level message.
   */
  it("refuses to deliver with a Stream unnamed, and writes nothing", async () => {
    const { pic, bagus, session } = await arrangedOnlineSession();

    const result = await markSessionDelivered(pic, session.id, [
      { stream: "STEM", personId: bagus.id },
    ]);

    expect(result).toEqual({ outcome: "stream-unnamed", missing: ["Research"] });
    expect(await statusOf(session.id)).toBe("arranged");
    expect(await teachersOf(session.id)).toEqual([]);
  });

  /** `delivered` is terminal, and the second attempt is what proves it. */
  it("refuses to deliver a Session that is already delivered", async () => {
    const { pic, bagus, sari, session } = await arrangedOnlineSession();
    const teachers = [
      { stream: "STEM" as const, personId: bagus.id },
      { stream: "Research" as const, personId: sari.id },
    ];
    await markSessionDelivered(pic, session.id, teachers);

    const result = await markSessionDelivered(pic, session.id, teachers);

    expect(result).toEqual({ outcome: "not-arranged", status: "delivered" });
  });

  it("refuses to deliver a cancelled Session", async () => {
    const { pic, bagus, sari, session } = await arrangedOnlineSession();
    await cancelSession(pic, session.id, "Sekolah meminta penjadwalan ulang");

    const result = await markSessionDelivered(pic, session.id, [
      { stream: "STEM", personId: bagus.id },
      { stream: "Research", personId: sari.id },
    ]);

    expect(result).toEqual({ outcome: "not-arranged", status: "cancelled" });
  });

  it("refuses a Teaching Team caller", async () => {
    const { bagus, sari, session } = await arrangedOnlineSession();

    await expect(
      markSessionDelivered(bagus, session.id, [
        { stream: "STEM", personId: bagus.id },
        { stream: "Research", personId: sari.id },
      ]),
    ).rejects.toSatisfy(isNotStaffError);
  });

  /**
   * Naming both Streams is optional at arrangement and mandatory here, so a Session may
   * arrive already carrying teacher rows. They are replaced rather than merged — the
   * dialog shows the complete answer, so a row it does not carry is a row Staff removed.
   */
  it("replaces teacher rows rather than adding to them", async () => {
    const { pic, bagus, sari, session } = await arrangedOnlineSession();
    await db
      .insert(schema.sessionTeacher)
      .values([{ sessionId: session.id, stream: "STEM", personId: sari.id }]);

    await markSessionDelivered(pic, session.id, [
      { stream: "STEM", personId: bagus.id },
      { stream: "Research", personId: sari.id },
    ]);

    const rows = await teachersOf(session.id);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.stream === "STEM")?.personId).toBe(bagus.id);
  });
});

describe("correcting who taught", () => {
  beforeEach(resetDatabase);

  async function deliveredSession() {
    const pic = await staff();
    const [bagus, sari] = await professors();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });
    await markSessionDelivered(pic, session.id, [
      { stream: "STEM", personId: bagus.id },
      { stream: "Research", personId: sari.id },
    ]);
    return { pic, bagus, sari, session };
  }

  /**
   * The only route to fixing a mis-named professor. Until they are removed they owe
   * three Class Records they cannot honestly file, and `delivered` being terminal means
   * un-delivering is not an option.
   */
  it("lets Staff correct a professor after delivery", async () => {
    const { pic, bagus, session } = await deliveredSession();
    const rian = await addPerson({
      fullName: "Rian Saputra",
      email: "rian@itb.ac.id",
      role: "Teaching Team",
    });

    const result = await correctSessionTeachers(pic, session.id, [
      { stream: "STEM", personId: bagus.id },
      { stream: "Research", personId: rian.id },
    ]);

    expect(result.outcome).toBe("corrected");
    const rows = await teachersOf(session.id);
    expect(rows.find((row) => row.stream === "Research")?.personId).toBe(rian.id);
  });

  /**
   * The both-Streams rule survives the correction. Without this, removing a professor
   * from a delivered Session is the way out of a rule that Tandai terlaksana enforced.
   */
  it("refuses to leave a delivered Session with a Stream unnamed", async () => {
    const { pic, bagus, session } = await deliveredSession();

    const result = await correctSessionTeachers(pic, session.id, [
      { stream: "STEM", personId: bagus.id },
    ]);

    expect(result).toEqual({ outcome: "stream-unnamed", missing: ["Research"] });
    expect(await teachersOf(session.id)).toHaveLength(2);
  });

  /** Naming is optional before delivery, so a correction on an arranged Session may empty it. */
  it("allows a Stream to be left unnamed while the Session is still arranged", async () => {
    const pic = await staff();
    const [bagus] = await professors();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });

    const result = await correctSessionTeachers(pic, session.id, [
      { stream: "STEM", personId: bagus.id },
    ]);

    expect(result.outcome).toBe("corrected");
    expect(await teachersOf(session.id)).toHaveLength(1);
  });

  /**
   * Nobody taught a Session that was called off, so there is nothing to correct. The rows
   * this would write are meaningless and invisible — `owed` is delivered-only, so they
   * would sit in `session_teacher` with no screen ever reporting them.
   */
  it("refuses to correct a cancelled Session", async () => {
    const pic = await staff();
    const [bagus, sari] = await professors();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });
    await cancelSession(pic, session.id, "Sekolah meminta penjadwalan ulang");

    const result = await correctSessionTeachers(pic, session.id, [
      { stream: "STEM", personId: bagus.id },
      { stream: "Research", personId: sari.id },
    ]);

    expect(result).toEqual({ outcome: "not-correctable", status: "cancelled" });
    expect(await teachersOf(session.id)).toEqual([]);
  });

  it("refuses a Teaching Team caller", async () => {
    const { bagus, sari, session } = await deliveredSession();

    await expect(
      correctSessionTeachers(bagus, session.id, [
        { stream: "STEM", personId: bagus.id },
        { stream: "Research", personId: sari.id },
      ]),
    ).rejects.toSatisfy(isNotStaffError);
  });
});

describe("Batalkan Sesi", () => {
  beforeEach(resetDatabase);

  it("cancels an arranged Session with its reason in the same write", async () => {
    const pic = await staff();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });

    const result = await cancelSession(pic, session.id, "Sekolah meminta penjadwalan ulang");

    expect(result.outcome).toBe("cancelled");
    expect(await statusOf(session.id)).toBe("cancelled");
  });

  /**
   * Offered only while `arranged`. Once delivered it happened, and "un-delivering" is a
   * correction rather than a cancellation — conflating the two would put a reason field
   * on an event that already has one.
   */
  it("refuses to cancel a delivered Session", async () => {
    const pic = await staff();
    const [bagus, sari] = await professors();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });
    await markSessionDelivered(pic, session.id, [
      { stream: "STEM", personId: bagus.id },
      { stream: "Research", personId: sari.id },
    ]);

    const result = await cancelSession(pic, session.id, "Berubah pikiran");

    expect(result).toEqual({ outcome: "not-arranged", status: "delivered" });
    expect(await statusOf(session.id)).toBe("delivered");
  });

  /**
   * `session_cancelled_iff_reason` refuses a cancellation with no reason, so an empty
   * one is caught here rather than reaching the database as an error page.
   */
  it("refuses a blank reason", async () => {
    const pic = await staff();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });

    const result = await cancelSession(pic, session.id, "   ");

    expect(result).toEqual({ outcome: "reason-required" });
    expect(await statusOf(session.id)).toBe("arranged");
  });

  it("refuses a Teaching Team caller", async () => {
    const pic = await staff();
    const [bagus] = await professors();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });

    await expect(cancelSession(bagus, session.id, "Tidak jadi")).rejects.toSatisfy(isNotStaffError);
  });
});

describe("moving a date", () => {
  beforeEach(resetDatabase);

  it("moves an arranged online Session without demanding a reason", async () => {
    const pic = await staff();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });

    const result = await moveSessionDate(pic, session.id, "2026-09-17");

    expect(result.outcome).toBe("moved");
    expect(await statusOf(session.id)).toBe("arranged");
  });

  /**
   * The per-day index the criterion names, asserted **by name**. Some constraint firing
   * would prove nothing: this row satisfies five CHECKs and a composite foreign key, so
   * a test that only knew it was refused could pass against the wrong rule.
   */
  it("is refused by session_one_online_per_school_per_day when the School is taken that day", async () => {
    const pic = await staff();
    const school = await oneSchool();
    const moving = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });
    await addSession({ schoolId: school.id, heldOn: "2026-09-17", onlinePicPersonId: pic.id });

    const result = await moveSessionDate(pic, moving.id, "2026-09-17");

    expect(result).toEqual({
      outcome: "collided",
      constraint: "session_one_online_per_school_per_day",
    });
    // Unmoved, and still arranged — a refused move is not a cancellation.
    const [row] = await db
      .select({ heldOn: schema.session.heldOn })
      .from(schema.session)
      .where(eq(schema.session.id, moving.id));
    expect(row?.heldOn).toBe("2026-09-10");
  });

  /** The index is partial on `status <> 'cancelled'`, so a cancelled row is not in the way. */
  it("moves onto a date whose only other Session was cancelled", async () => {
    const pic = await staff();
    const school = await oneSchool();
    const moving = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });
    await addSession({
      schoolId: school.id,
      heldOn: "2026-09-17",
      onlinePicPersonId: pic.id,
      status: "cancelled",
    });

    expect((await moveSessionDate(pic, moving.id, "2026-09-17")).outcome).toBe("moved");
  });

  it("refuses to move a delivered Session", async () => {
    const pic = await staff();
    const [bagus, sari] = await professors();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });
    await markSessionDelivered(pic, session.id, [
      { stream: "STEM", personId: bagus.id },
      { stream: "Research", personId: sari.id },
    ]);

    expect(await moveSessionDate(pic, session.id, "2026-09-17")).toEqual({
      outcome: "not-arranged",
      status: "delivered",
    });
  });

  /**
   * The invariant this ticket states and nothing held before it: an arranged offline
   * Session's `held_on` lies inside its Perjadin's window. No CHECK can carry it — the
   * date range is on another table — so it is held here, beside the write.
   */
  it("refuses to move an offline Session outside its Perjadin's window", async () => {
    const pic = await staff();
    const school = await oneSchool();
    const perjadin = await addPerjadin({
      picPersonId: pic.id,
      advanceIdr: 5_000_000,
      startsOn: "2026-09-01",
      endsOn: "2026-09-03",
    });
    const session = await addOfflineSession({
      schoolId: school.id,
      heldOn: "2026-09-02",
      perjadinId: perjadin.id,
    });

    const result = await moveSessionDate(pic, session.id, "2026-09-09");

    expect(result).toEqual({
      outcome: "outside-perjadin",
      startsOn: "2026-09-01",
      endsOn: "2026-09-03",
    });
  });

  it("moves an offline Session to another day inside the window", async () => {
    const pic = await staff();
    const school = await oneSchool();
    const perjadin = await addPerjadin({
      picPersonId: pic.id,
      advanceIdr: 5_000_000,
      startsOn: "2026-09-01",
      endsOn: "2026-09-03",
    });
    const session = await addOfflineSession({
      schoolId: school.id,
      heldOn: "2026-09-02",
      perjadinId: perjadin.id,
    });

    expect((await moveSessionDate(pic, session.id, "2026-09-03")).outcome).toBe("moved");
  });

  /**
   * Both ends of the window are inside it — a trip teaches on the day it arrives and on
   * the day it leaves. Driven through the write rather than against the validator alone,
   * so the boundary is proven where it is actually applied.
   */
  it("counts both ends of the Perjadin's window as inside it", async () => {
    const pic = await staff();
    const school = await oneSchool();
    const perjadin = await addPerjadin({
      picPersonId: pic.id,
      advanceIdr: 5_000_000,
      startsOn: "2026-09-01",
      endsOn: "2026-09-03",
    });
    const session = await addOfflineSession({
      schoolId: school.id,
      heldOn: "2026-09-02",
      perjadinId: perjadin.id,
    });

    expect((await moveSessionDate(pic, session.id, "2026-09-01")).outcome).toBe("moved");
    expect((await moveSessionDate(pic, session.id, "2026-09-03")).outcome).toBe("moved");
    // One day outside either end, which is the pair that makes "inclusive" mean something.
    expect((await moveSessionDate(pic, session.id, "2026-08-31")).outcome).toBe("outside-perjadin");
    expect((await moveSessionDate(pic, session.id, "2026-09-04")).outcome).toBe("outside-perjadin");
  });

  it("refuses a Teaching Team caller", async () => {
    const pic = await staff();
    const [bagus] = await professors();
    const school = await oneSchool();
    const session = await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });

    await expect(moveSessionDate(bagus, session.id, "2026-09-17")).rejects.toSatisfy(
      isNotStaffError,
    );
  });
});
