import { db, schema } from "@sugt/db";
import {
  cancelSession,
  isNotStaffError,
  perjadinAcquittal,
  perjadinDetail,
  perjadinDirectory,
  planPerjadin,
  replacePerjadinGroup,
  type PlanPerjadinInput,
} from "@sugt/db/queries";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addCluster,
  addPerson,
  addProvince,
  addSchool,
  addSubCluster,
  addTransaction,
  constraintOf,
  resetDatabase,
} from "./support/fixtures";

/**
 * **Rencanakan Perjadin**, and the Perjadin list and detail.
 *
 * The write is the substance. Creating a Perjadin brings its Group and one Session per
 * School into existence together, and three of the rules that govern it are structural in
 * ways a test through the form would never reach: the PIC is on their own Group by a
 * DEFERRABLE foreign key, the Group's Stream cover is checked against the whole payload
 * because no CHECK sees sibling rows, and every Session's date has to land inside the
 * trip. Each block below drives the write function against a real Postgres.
 */

async function staff(fullName = "Rina Nurhayati", email = "rina@ditsama.itb.ac.id") {
  return addPerson({ fullName, email, role: "Staff" });
}

async function professors() {
  return Promise.all([
    addPerson({ fullName: "Bagus Prakoso", email: "bagus@itb.ac.id", role: "Teaching Team" }),
    addPerson({ fullName: "Sari Dewi", email: "sari@itb.ac.id", role: "Teaching Team" }),
  ]);
}

/**
 * Two Schools in one Sub-Cluster, so a trip can carry more than one and the per-School Sessions
 * are visible. A Perjadin goes to exactly one Sub-Cluster and the form picks it, so both Schools
 * belong to the one returned here. The Sub-Cluster and its Cluster travel back too — the
 * school-outside-Sub-Cluster test builds a stray School in a sibling Sub-Cluster of the same
 * Cluster.
 */
async function twoSchools() {
  await addProvince("JB", "Jawa Barat");
  const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
  const subCluster = await addSubCluster({
    slug: "alpha-bandung",
    name: "Kelompok Sekolah Bandung",
    clusterId: cluster.id,
  });
  const schools = await Promise.all([
    addSchool({
      slug: "sman-1",
      name: "SMAN 1 Bandung",
      clusterId: cluster.id,
      subClusterId: subCluster.id,
      provinceCode: "JB",
    }),
    addSchool({
      slug: "sman-2",
      name: "SMAN 2 Bandung",
      clusterId: cluster.id,
      subClusterId: subCluster.id,
      provinceCode: "JB",
    }),
  ]);
  return { cluster, subCluster, schools };
}

/** Everything a valid trip needs, so each test below can spoil exactly one thing. */
async function validPlan() {
  const pic = await staff();
  const [bagus, sari] = await professors();
  const { cluster, subCluster, schools } = await twoSchools();

  const input: PlanPerjadinInput = {
    subClusterId: subCluster.id,
    destination: "Bandung",
    startsOn: "2026-09-01",
    endsOn: "2026-09-03",
    advanceIdr: 5_000_000,
    picPersonId: pic.id,
    teachers: [
      { personId: bagus.id, stream: "STEM" },
      { personId: sari.id, stream: "Research" },
    ],
    sessions: [
      { schoolId: schools[0].id, heldOn: "2026-09-01", startsAt: "09:00" },
      { schoolId: schools[1].id, heldOn: "2026-09-03", startsAt: "09:00" },
    ],
  };

  return { pic, bagus, sari, cluster, subCluster, schools, input };
}

/** Every Perjadin row, so "nothing was written" can be asserted rather than assumed. */
async function perjadinRows() {
  return db.select({ id: schema.perjadin.id }).from(schema.perjadin);
}

async function groupOf(perjadinId: string) {
  return db
    .select({
      personId: schema.groupMember.personId,
      role: schema.groupMember.role,
      stream: schema.groupMember.stream,
    })
    .from(schema.groupMember)
    .where(eq(schema.groupMember.perjadinId, perjadinId));
}

async function sessionsOf(perjadinId: string) {
  return db
    .select({
      id: schema.session.id,
      schoolId: schema.session.schoolId,
      heldOn: schema.session.heldOn,
      mode: schema.session.mode,
      status: schema.session.status,
    })
    .from(schema.session)
    .where(eq(schema.session.perjadinId, perjadinId));
}

describe("Rencanakan Perjadin", () => {
  beforeEach(resetDatabase);

  /**
   * The whole criterion in one assertion: the trip, its Group and one Session per School
   * come into existence together. Three tables, one transaction.
   */
  it("writes the Perjadin, its Group and one Session per School in one transaction", async () => {
    const { pic, bagus, sari, schools, input } = await validPlan();

    const result = await planPerjadin(pic, input);

    expect(result.outcome).toBe("planned");
    if (result.outcome !== "planned") return;

    const group = await groupOf(result.perjadinId);
    expect(group).toHaveLength(3);
    // The PIC is on their own Group, and carries no Stream — Staff never do.
    expect(group.find((member) => member.personId === pic.id)).toEqual({
      personId: pic.id,
      role: "Staff",
      stream: null,
    });
    expect(group.find((member) => member.personId === bagus.id)?.stream).toBe("STEM");
    expect(group.find((member) => member.personId === sari.id)?.stream).toBe("Research");

    const sessions = await sessionsOf(result.perjadinId);
    expect(sessions).toHaveLength(2);
    expect(sessions.map((row) => row.schoolId).sort()).toEqual(
      schools.map((school) => school.id).sort(),
    );
    // Offline by construction: a Session with a Perjadin may not be online, by
    // `session_offline_iff_perjadin`, and it comes into existence already arranged.
    expect(sessions.every((row) => row.mode === "offline")).toBe(true);
    expect(sessions.every((row) => row.status === "arranged")).toBe(true);
  });

  /**
   * The criterion says no `session_teacher` rows are written here. The Group is the plan,
   * and Tandai terlaksana pre-fills from it — a Group is replaced wholesale, so copies
   * taken now would be stranded by a substitution with no constraint to catch it.
   */
  it("writes no session_teacher rows", async () => {
    const { pic, input } = await validPlan();

    await planPerjadin(pic, input);

    expect(await db.select().from(schema.sessionTeacher)).toEqual([]);
  });

  /**
   * ADR-0005's amendment names this as one of the two rules that turned out to be
   * inexpressible: it is a count across sibling rows and no CHECK can see them. So it is
   * checked against the complete payload, before anything is written.
   */
  it("refuses a Group with no professor on a Stream, and writes nothing", async () => {
    const { pic, bagus, input } = await validPlan();

    const result = await planPerjadin(pic, {
      ...input,
      teachers: [{ personId: bagus.id, stream: "STEM" }],
    });

    expect(result).toEqual({ outcome: "stream-uncovered", missing: ["Research"] });
    expect(await perjadinRows()).toEqual([]);
  });

  it("accepts two professors on the same Stream as long as both Streams are covered", async () => {
    const { pic, bagus, sari, input } = await validPlan();
    const rian = await addPerson({
      fullName: "Rian Saputra",
      email: "rian@itb.ac.id",
      role: "Teaching Team",
    });

    const result = await planPerjadin(pic, {
      ...input,
      teachers: [
        { personId: bagus.id, stream: "STEM" },
        { personId: rian.id, stream: "STEM" },
        { personId: sari.id, stream: "Research" },
      ],
    });

    expect(result.outcome).toBe("planned");
  });

  /**
   * The invariant #28 stated and this is the second of its three write paths. Without the
   * check here a Session can be **born** outside the trip it is on, which #28's date edit
   * refuses but cannot undo.
   */
  it("refuses a Session dated outside the trip, and writes nothing", async () => {
    const { pic, schools, input } = await validPlan();

    const result = await planPerjadin(pic, {
      ...input,
      sessions: [{ schoolId: schools[0].id, heldOn: "2026-09-09", startsAt: "09:00" }],
    });

    expect(result).toEqual({
      outcome: "session-outside-perjadin",
      startsOn: "2026-09-01",
      endsOn: "2026-09-03",
      offending: [{ schoolId: schools[0].id, heldOn: "2026-09-09", startsAt: "09:00" }],
    });
    expect(await perjadinRows()).toEqual([]);
  });

  it("accepts Sessions on both the first and the last day of the trip", async () => {
    const { pic, schools, input } = await validPlan();

    const result = await planPerjadin(pic, {
      ...input,
      sessions: [
        { schoolId: schools[0].id, heldOn: "2026-09-01", startsAt: "09:00" },
        { schoolId: schools[1].id, heldOn: "2026-09-03", startsAt: "09:00" },
      ],
    });

    expect(result.outcome).toBe("planned");
  });

  /**
   * Each kept School gets its own date **and** its own start time (#69). The write persists
   * both; two Schools may share a date as long as the time differs.
   */
  it("writes each Session's own date and start time", async () => {
    const { pic, schools, input } = await validPlan();

    const planned = await planPerjadin(pic, {
      ...input,
      sessions: [
        { schoolId: schools[0].id, heldOn: "2026-09-02", startsAt: "08:30" },
        { schoolId: schools[1].id, heldOn: "2026-09-02", startsAt: "13:15" },
      ],
    });
    if (planned.outcome !== "planned") throw new Error("fixture failed to plan");

    const rows = await db
      .select({
        schoolId: schema.session.schoolId,
        heldOn: schema.session.heldOn,
        startsAt: schema.session.startsAt,
      })
      .from(schema.session)
      .where(eq(schema.session.perjadinId, planned.perjadinId));
    expect(rows.find((row) => row.schoolId === schools[0].id)).toMatchObject({
      heldOn: "2026-09-02",
    });
    expect(rows.find((row) => row.schoolId === schools[0].id)?.startsAt).toMatch(/^08:30/);
    expect(rows.find((row) => row.schoolId === schools[1].id)?.startsAt).toMatch(/^13:15/);
  });

  /**
   * ADR-0016's rule that a mutable grouping cannot be a foreign key into immutable history, so
   * planning checks it. A School in a sibling Sub-Cluster is refused for the whole payload.
   */
  it("refuses a School that is not in the chosen Sub-Cluster, and writes nothing", async () => {
    const { pic, subCluster, input } = await validPlan();
    const otherSub = await addSubCluster({
      slug: "alpha-cirebon",
      name: "Kelompok Sekolah Cirebon",
      clusterId: subCluster.clusterId,
    });
    const stray = await addSchool({
      slug: "sman-9",
      name: "SMAN 9 Cirebon",
      clusterId: subCluster.clusterId,
      subClusterId: otherSub.id,
      provinceCode: "JB",
    });

    const result = await planPerjadin(pic, {
      ...input,
      sessions: [
        ...input.sessions,
        { schoolId: stray.id, heldOn: "2026-09-02", startsAt: "10:00" },
      ],
    });

    expect(result).toEqual({ outcome: "school-outside-sub-cluster", offending: [stray.id] });
    expect(await perjadinRows()).toEqual([]);
  });

  /**
   * Two Schools on the same date and the same time is the Group in two places at once —
   * refused up front with the pair named, rather than a constraint violation from inside the
   * transaction (`session_one_school_at_a_time_per_perjadin` is the backstop).
   */
  it("refuses two Schools on the same date and time, naming them, and writes nothing", async () => {
    const { pic, schools, input } = await validPlan();

    const result = await planPerjadin(pic, {
      ...input,
      sessions: [
        { schoolId: schools[0].id, heldOn: "2026-09-02", startsAt: "09:00" },
        { schoolId: schools[1].id, heldOn: "2026-09-02", startsAt: "09:00" },
      ],
    });

    expect(result.outcome).toBe("session-time-clash");
    if (result.outcome !== "session-time-clash") return;
    expect(result.clashes).toHaveLength(1);
    expect(result.clashes[0]).toMatchObject({ heldOn: "2026-09-02", startsAt: "09:00" });
    expect([...result.clashes[0]!.schoolIds].sort()).toEqual([schools[0].id, schools[1].id].sort());
    expect(await perjadinRows()).toEqual([]);
  });

  /** The legal case that looks illegal: two Schools, same date, different times. */
  it("accepts two Schools on the same date at different times", async () => {
    const { pic, schools, input } = await validPlan();

    const result = await planPerjadin(pic, {
      ...input,
      sessions: [
        { schoolId: schools[0].id, heldOn: "2026-09-02", startsAt: "09:00" },
        { schoolId: schools[1].id, heldOn: "2026-09-02", startsAt: "13:00" },
      ],
    });

    expect(result.outcome).toBe("planned");
  });

  it("refuses a trip that ends before it starts, and writes nothing", async () => {
    const { pic, input } = await validPlan();

    const result = await planPerjadin(pic, { ...input, startsOn: "2026-09-05" });

    expect(result).toEqual({ outcome: "ends-before-starts" });
    expect(await perjadinRows()).toEqual([]);
  });

  it("refuses a trip with no School on it, and writes nothing", async () => {
    const { pic, input } = await validPlan();

    const result = await planPerjadin(pic, { ...input, sessions: [] });

    expect(result).toEqual({ outcome: "no-schools" });
    expect(await perjadinRows()).toEqual([]);
  });

  /**
   * `perjadin_pic_is_staff`, asserted by name. The composite foreign key into
   * `person (id, role)` is what makes "the PIC is a Staff member" unbreakable, including
   * from the Supabase SQL editor — so it is worth proving it is the rule that fires and
   * not one of the other seven the row satisfies.
   */
  it("is refused by perjadin_pic_is_staff when a professor is named PIC", async () => {
    const { bagus, sari, input } = await validPlan();
    const staffCaller = await staff("Dewi Lestari", "dewi@ditsama.itb.ac.id");

    const refusal = await planPerjadin(staffCaller, {
      ...input,
      picPersonId: bagus.id,
      teachers: [
        { personId: bagus.id, stream: "STEM" },
        { personId: sari.id, stream: "Research" },
      ],
    }).then(() => null, constraintOf);

    expect(refusal).toBe("perjadin_pic_is_staff");
    expect(await perjadinRows()).toEqual([]);
  });

  /**
   * The other half of the PIC rule, and the reason the whole write is one transaction.
   *
   * **Driven at the database rather than through `planPerjadin`**, for the reason
   * `online-session-batch.test.ts` gives about its index: a function-level test would pass
   * just as well against a constraint that was never created, and this one lives in a
   * hand-written migration that drizzle-kit does not know about. Adding a flag to the
   * write function so a test could withhold the PIC's membership row would also put a
   * branch in production code that only a test takes.
   *
   * `perjadin_pic_is_a_group_member` is `DEFERRABLE INITIALLY DEFERRED`, so the failure
   * must arrive at COMMIT and not at the INSERT. That is what the two assertions separate.
   */
  it("is refused by perjadin_pic_is_a_group_member, and at COMMIT rather than at the insert", async () => {
    const pic = await staff();
    const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
    const subCluster = await addSubCluster({
      slug: "alpha-bandung",
      name: "Kelompok Sekolah Bandung",
      clusterId: cluster.id,
    });
    let insertSucceeded = false;

    const refusal = await db
      .transaction(async (tx) => {
        await tx.insert(schema.perjadin).values({
          subClusterId: subCluster.id,
          destination: "Bandung",
          startsOn: "2026-09-01",
          endsOn: "2026-09-03",
          advanceIdr: 5_000_000,
          picPersonId: pic.id,
          picRole: "Staff",
        });
        // Reached, which is the deferral: a non-deferred foreign key would have refused
        // the statement above, since no `group_member` row names this Perjadin yet.
        insertSucceeded = true;
      })
      .then(() => null, constraintOf);

    expect(insertSucceeded).toBe(true);
    expect(refusal).toBe("perjadin_pic_is_a_group_member");
    expect(await perjadinRows()).toEqual([]);
  });

  /**
   * One professor on both Streams is two rows sharing `(perjadin_id, person_id)`, which the
   * `group_member` primary key refuses — so without this the form produces an error page
   * from a payload somebody filled in honestly. It is refused rather than deduplicated:
   * `docs/product.md` says two professors cover all six teaching threads *because* each
   * covers their Stream, so one person on both is a plan to question.
   */
  it("refuses one professor named on both Streams, and writes nothing", async () => {
    const { pic, bagus, input } = await validPlan();

    const result = await planPerjadin(pic, {
      ...input,
      teachers: [
        { personId: bagus.id, stream: "STEM" },
        { personId: bagus.id, stream: "Research" },
      ],
    });

    expect(result).toEqual({ outcome: "duplicate-teacher", personIds: [bagus.id] });
    expect(await perjadinRows()).toEqual([]);
  });

  it("refuses a Teaching Team caller", async () => {
    const { bagus, input } = await validPlan();

    await expect(planPerjadin(bagus, input)).rejects.toSatisfy(isNotStaffError);
  });
});

describe("the Perjadin list and detail", () => {
  beforeEach(resetDatabase);

  it("lists Perjadins for anyone signed in, newest trip first", async () => {
    const { pic, bagus, input } = await validPlan();
    await planPerjadin(pic, input);
    await planPerjadin(pic, {
      ...input,
      destination: "Cirebon",
      startsOn: "2026-10-01",
      endsOn: "2026-10-02",
      sessions: [
        { schoolId: input.sessions[0]!.schoolId, heldOn: "2026-10-01", startsAt: "09:00" },
      ],
    });

    const trips = await perjadinDirectory(bagus);

    expect(trips.map((trip) => trip.destination)).toEqual(["Cirebon", "Bandung"]);
    expect(trips[0]?.schoolCount).toBe(1);
    expect(trips[1]?.schoolCount).toBe(2);
  });

  /**
   * **No money on this payload at all**, for either role. The Advance and the acquittal
   * are `perjadinAcquittal`'s, which opens with the Staff-only choke point — so the
   * Teaching Team variant is money that was never fetched rather than money hidden on the
   * way to the screen.
   */
  it("returns the Group, the Schools and the Report deadline, and no money", async () => {
    const { pic, bagus, input } = await validPlan();
    const planned = await planPerjadin(pic, input);
    if (planned.outcome !== "planned") throw new Error("fixture failed to plan");

    const detail = await perjadinDetail(bagus, planned.perjadinId);

    expect(detail?.destination).toBe("Bandung");
    expect(detail?.picFullName).toBe("Rina Nurhayati");
    expect(detail?.group).toHaveLength(3);
    expect(detail?.sessions).toHaveLength(2);
    expect(detail).not.toHaveProperty("advanceIdr");
    // The Report deadline is not here either: the Perjadin Report *is* the acquittal, and
    // the criterion puts the Report among what a Teaching Team member does not see.
    expect(detail).not.toHaveProperty("reportDueOn");
  });

  /** Derived and never stored: two days after the Group gets back, and Staff-only. */
  it("reports the Report deadline on the acquittal, where the money is", async () => {
    const { pic, input } = await validPlan();
    const planned = await planPerjadin(pic, input);
    if (planned.outcome !== "planned") throw new Error("fixture failed to plan");

    expect((await perjadinAcquittal(pic, planned.perjadinId))?.reportDueOn).toBe("2026-09-05");
  });

  /**
   * `count(distinct school_id)`, not `count(session_id)`. Both partial unique indexes are
   * predicated on `status <> 'cancelled'` precisely so a cancelled Session and the one that
   * replaced it coexist on one trip — so counting Sessions reports a one-School trip as two.
   */
  it("counts Schools rather than Sessions, so a re-arranged School counts once", async () => {
    const { pic, schools, input } = await validPlan();
    const planned = await planPerjadin(pic, {
      ...input,
      sessions: [{ schoolId: schools[0]!.id, heldOn: "2026-09-01", startsAt: "09:00" }],
    });
    if (planned.outcome !== "planned") throw new Error("fixture failed to plan");
    await cancelSession(
      pic,
      (await sessionsOf(planned.perjadinId))[0]!.id,
      "Sekolah meminta ulang",
    );
    await db.insert(schema.session).values({
      schoolId: schools[0]!.id,
      perjadinId: planned.perjadinId,
      mode: "offline",
      heldOn: "2026-09-02",
      startsAt: "09:00",
    });

    const [trip] = await perjadinDirectory(pic);

    expect(trip?.schoolCount).toBe(1);
  });

  it("is null for an id naming no Perjadin, which is what a stale link is", async () => {
    const pic = await staff();

    expect(await perjadinDetail(pic, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("refuses a Teaching Team caller the money, which is the whole of the variant", async () => {
    const { pic, bagus, input } = await validPlan();
    const planned = await planPerjadin(pic, input);
    if (planned.outcome !== "planned") throw new Error("fixture failed to plan");

    await expect(perjadinAcquittal(bagus, planned.perjadinId)).rejects.toSatisfy(isNotStaffError);
    await expect(perjadinAcquittal(pic, planned.perjadinId)).resolves.not.toBeNull();
  });
});

describe("replacing a Group", () => {
  beforeEach(resetDatabase);

  async function plannedTrip() {
    const { pic, bagus, sari, schools, input } = await validPlan();
    const planned = await planPerjadin(pic, input);
    if (planned.outcome !== "planned") throw new Error("fixture failed to plan");
    return { pic, bagus, sari, schools, perjadinId: planned.perjadinId };
  }

  /**
   * Substituting a professor submits an entire replacement Group. The Perjadin keeps its
   * id, so its Sessions, its Advance and its transactions are untouched — which is the
   * criterion, and is why this is a replacement rather than a delete-and-recreate.
   */
  it("deletes every member row and inserts the new set, leaving Sessions and money alone", async () => {
    const { pic, bagus, perjadinId } = await plannedTrip();
    const rian = await addPerson({
      fullName: "Rian Saputra",
      email: "rian@itb.ac.id",
      role: "Teaching Team",
    });
    await addTransaction({ perjadinId, amountIdr: 250_000, createdByPersonId: pic.id });

    const result = await replacePerjadinGroup(pic, perjadinId, [
      { personId: bagus.id, stream: "STEM" },
      { personId: rian.id, stream: "Research" },
    ]);

    expect(result.outcome).toBe("replaced");
    const group = await groupOf(perjadinId);
    expect(group.map((member) => member.personId).sort()).toEqual(
      [pic.id, bagus.id, rian.id].sort(),
    );
    // Untouched, which is the point of keeping the id.
    expect(await sessionsOf(perjadinId)).toHaveLength(2);
    const [acquittal] = [await perjadinAcquittal(pic, perjadinId)];
    expect(acquittal?.spentIdr).toBe(250_000);
    expect(acquittal?.advanceIdr).toBe(5_000_000);
  });

  it("refuses a replacement that leaves a Stream uncovered, and changes nothing", async () => {
    const { pic, bagus, perjadinId } = await plannedTrip();

    const result = await replacePerjadinGroup(pic, perjadinId, [
      { personId: bagus.id, stream: "STEM" },
    ]);

    expect(result).toEqual({ outcome: "stream-uncovered", missing: ["Research"] });
    expect(await groupOf(perjadinId)).toHaveLength(3);
  });

  it("keeps the PIC on the Group without being asked to", async () => {
    const { pic, bagus, sari, perjadinId } = await plannedTrip();

    await replacePerjadinGroup(pic, perjadinId, [
      { personId: bagus.id, stream: "STEM" },
      { personId: sari.id, stream: "Research" },
    ]);

    const group = await groupOf(perjadinId);
    expect(group.find((member) => member.personId === pic.id)?.role).toBe("Staff");
  });

  /**
   * `receiptsSettledAt` is the PIC's checklist and cannot be derived — a member with no
   * transactions is ambiguous between *spent nothing* and *has not handed anything over
   * yet*. Delete-and-reinsert would clear it for somebody who never left the trip, and the
   * PIC would have no way to know it had happened.
   */
  it("keeps a staying member's receipt mark, and gives a new member none", async () => {
    const { pic, bagus, sari, perjadinId } = await plannedTrip();
    const rian = await addPerson({
      fullName: "Rian Saputra",
      email: "rian@itb.ac.id",
      role: "Teaching Team",
    });
    await db
      .update(schema.groupMember)
      .set({ receiptsSettledAt: new Date("2026-09-04T00:00:00Z") })
      .where(eq(schema.groupMember.personId, bagus.id));

    await replacePerjadinGroup(pic, perjadinId, [
      { personId: bagus.id, stream: "STEM" },
      { personId: rian.id, stream: "Research" },
    ]);

    const settled = await db
      .select({
        personId: schema.groupMember.personId,
        receiptsSettledAt: schema.groupMember.receiptsSettledAt,
      })
      .from(schema.groupMember)
      .where(eq(schema.groupMember.perjadinId, perjadinId));

    expect(settled.find((row) => row.personId === bagus.id)?.receiptsSettledAt).not.toBeNull();
    expect(settled.find((row) => row.personId === rian.id)?.receiptsSettledAt).toBeNull();
    // Sari left the Group, so her row is gone rather than carried.
    expect(settled.find((row) => row.personId === sari.id)).toBeUndefined();
  });

  it("refuses a replacement naming one professor on both Streams, and changes nothing", async () => {
    const { pic, bagus, perjadinId } = await plannedTrip();

    const result = await replacePerjadinGroup(pic, perjadinId, [
      { personId: bagus.id, stream: "STEM" },
      { personId: bagus.id, stream: "Research" },
    ]);

    expect(result).toEqual({ outcome: "duplicate-teacher", personIds: [bagus.id] });
    expect(await groupOf(perjadinId)).toHaveLength(3);
  });

  it("refuses a Teaching Team caller", async () => {
    const { bagus, sari, perjadinId } = await plannedTrip();

    await expect(
      replacePerjadinGroup(bagus, perjadinId, [
        { personId: bagus.id, stream: "STEM" },
        { personId: sari.id, stream: "Research" },
      ]),
    ).rejects.toSatisfy(isNotStaffError);
  });
});
