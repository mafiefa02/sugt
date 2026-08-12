import { staffSurface } from "-/lib/staff-surface";
import { db, schema } from "@sugt/db";
import {
  arrangeOnlineSessions,
  isNotStaffError,
  onlineSessionBatch,
  type OnlineSessionRow,
} from "@sugt/db/queries";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addCluster,
  addOfflineSession,
  addPerjadin,
  addPerson,
  addProvince,
  addSchool,
  addSession,
  resetDatabase,
  revokePerson,
} from "./support/fixtures";
import { signInAsPerson } from "./support/sign-in";

/** The Staff Person every block here signs in as. Online Sessions need one as their PIC. */
const signInAsStaff = () => signInAsPerson("Staff", "rina@ditsama.itb.ac.id", "Rina Nurhayati");

/**
 * **Jadwalkan Sesi daring** — the batch that arranges an online Session for each School
 * in a Coverage selection, and the index that makes the batch safe.
 *
 * The index comes first because it is the older half. `docs/data-model.md` has carried
 * `session_one_online_per_school_per_day` in its *Decided, not applied* table since the
 * schema was written, and says in as many words that the claim worth verifying rather
 * than assuming when the migration lands is *"the new partial index actually rejecting a
 * second online Session for one School on one day"*. That is what the first block below
 * does, at the database rather than through the write function — a function-level test
 * would pass just as well against an index that was never created.
 */
describe("one online Session per School per day", () => {
  beforeEach(resetDatabase);

  /**
   * Which constraint refused a write, or `null` if nothing did.
   *
   * Named rather than asserted as "it threw", because *some* constraint firing proves
   * nothing here — the row these tests insert satisfies five CHECKs and a composite
   * foreign key, so a test that only knew it was rejected would pass against the wrong
   * rule. Drizzle wraps the driver error, so the name is one level down under `cause`.
   */
  async function refusedBy(write: Promise<unknown>): Promise<string | null> {
    return write.then(
      () => null,
      (error: { cause?: { constraint_name?: string } }) => error.cause?.constraint_name ?? null,
    );
  }

  /** One School to collide against, and a second to prove the index is not over-broad. */
  async function twoSchools() {
    await addProvince("JB", "Jawa Barat");
    const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
    const school = await addSchool({
      slug: "sman-1-bandung",
      name: "SMAN 1 Bandung",
      clusterId: cluster.id,
      provinceCode: "JB",
    });
    const neighbour = await addSchool({
      slug: "sman-2-bandung",
      name: "SMAN 2 Bandung",
      clusterId: cluster.id,
      provinceCode: "JB",
    });
    return { school, neighbour };
  }

  it("refuses a second online Session for one School on one day", async () => {
    /**
     * The gap `session_one_per_school_per_perjadin` cannot close: it keys on
     * `perjadin_id`, every online Session has none, and Postgres treats NULLs in a
     * unique index as distinct. Before this index nothing here collided at all.
     */
    const pic = await signInAsStaff();
    const { school } = await twoSchools();

    await addSession({ schoolId: school.id, heldOn: "2026-09-10", onlinePicPersonId: pic.id });

    await expect(
      refusedBy(
        addSession({ schoolId: school.id, heldOn: "2026-09-10", onlinePicPersonId: pic.id }),
      ),
    ).resolves.toBe("session_one_online_per_school_per_day");
  });

  it("lets a cancelled Session be replaced on the same day", async () => {
    /**
     * The first way the index is partial. Cancelled Sessions persist and accumulate, so
     * a School whose Session was called off and re-arranged for the same date must not
     * collide with its own dead row.
     */
    const pic = await signInAsStaff();
    const { school } = await twoSchools();

    await addSession({
      schoolId: school.id,
      heldOn: "2026-09-10",
      status: "cancelled",
      onlinePicPersonId: pic.id,
    });

    await expect(
      addSession({ schoolId: school.id, heldOn: "2026-09-10", onlinePicPersonId: pic.id }),
    ).resolves.toMatchObject({ status: "arranged" });
  });

  it("lets two cancelled Sessions share a day", async () => {
    /**
     * The same clause at its strongest. A School whose Session was called off twice for
     * one date has two dead rows and no live one, and neither is a duplicate of
     * anything — the predicate excludes both from the index entirely.
     */
    const pic = await signInAsStaff();
    const { school } = await twoSchools();

    for (const _ of [1, 2]) {
      await expect(
        addSession({
          schoolId: school.id,
          heldOn: "2026-09-10",
          status: "cancelled",
          onlinePicPersonId: pic.id,
        }),
      ).resolves.toMatchObject({ status: "cancelled" });
    }
  });

  it("leaves offline Sessions untouched", async () => {
    /**
     * The second way it is partial. An offline Session is the *other* index's business,
     * and a Perjadin reaching a School on the same date an online Session was arranged
     * for is a legal pair rather than a mis-click.
     */
    const pic = await signInAsStaff();
    const { school } = await twoSchools();
    const perjadin = await addPerjadin({
      advanceIdr: 5_000_000,
      picPersonId: pic.id,
      startsOn: "2026-09-09",
      endsOn: "2026-09-11",
    });

    await addSession({ schoolId: school.id, heldOn: "2026-09-10", onlinePicPersonId: pic.id });

    await expect(
      addOfflineSession({
        schoolId: school.id,
        heldOn: "2026-09-10",
        perjadinId: perjadin.id,
      }),
    ).resolves.toMatchObject({ mode: "offline" });
  });

  it("keys on the day and on the School, and on nothing else", async () => {
    /**
     * The other direction: an index that refused too much would be as wrong as one that
     * refused nothing. One School across two dates, and one date across two Schools, are
     * both ordinary.
     */
    const pic = await signInAsStaff();
    const { school, neighbour } = await twoSchools();

    await addSession({ schoolId: school.id, heldOn: "2026-09-10", onlinePicPersonId: pic.id });

    await expect(
      addSession({ schoolId: school.id, heldOn: "2026-09-17", onlinePicPersonId: pic.id }),
    ).resolves.toBeTruthy();
    await expect(
      addSession({ schoolId: neighbour.id, heldOn: "2026-09-10", onlinePicPersonId: pic.id }),
    ).resolves.toBeTruthy();
  });
});

/**
 * The screen's own half: the payload it renders before anything is written, and the
 * batch write behind its submit button.
 *
 * The sharpest test here is *"writes nothing at all when one row collides"*. Every other
 * assertion in this block would pass against a function that wrote the rows that fit and
 * reported the rest, which is the reading of "refused" this ticket does **not** take —
 * and it is also the assertion that fails the moment the transaction leaves
 * `@sugt/db`, which is the convention this ticket exists to exercise.
 */
describe("arranging online Sessions in a batch", () => {
  beforeEach(resetDatabase);
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /** Three Schools in one Cluster, which is the shape a Coverage selection arrives in. */
  async function threeSchools() {
    await addProvince("JB", "Jawa Barat");
    const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
    const schools = [];
    for (const [slug, name] of [
      ["sman-1-bandung", "SMAN 1 Bandung"],
      ["sman-2-bandung", "SMAN 2 Bandung"],
      ["sman-3-bogor", "SMAN 3 Bogor"],
    ] as const) {
      schools.push(await addSchool({ slug, name, clusterId: cluster.id, provinceCode: "JB" }));
    }
    return schools;
  }

  /** Every Session in the database, so a test can assert on what was *not* written. */
  const allSessions = () => db.select().from(schema.session);
  const allTeachers = () => db.select().from(schema.sessionTeacher);

  /**
   * A row naming nobody, which is the ordinary case at arrangement.
   *
   * The PIC is the row's rather than the batch's, because the form's shared PIC control
   * is a convenience applied *into* the rows — and `online_pic_person_id` is a column on
   * the Session.
   */
  const row = (picPersonId: string, schoolId: string, heldOn: string): OnlineSessionRow => ({
    schoolId,
    heldOn,
    picPersonId,
    teachers: [],
  });

  it("writes one online Session per row, with no Perjadin and the shared PIC", async () => {
    /**
     * Criterion 4, and the whole of it: `mode = 'online'`, no `perjadin_id`, and
     * `online_pic_person_id` set. The three are not independent — two CHECKs make them
     * an equivalence in both directions — so a row that got any one of them wrong would
     * not have been insertable at all.
     */
    const pic = await signInAsStaff();
    const [first, second] = await threeSchools();

    const result = await arrangeOnlineSessions(pic, [
      row(pic.id, first!.id, "2026-09-10"),
      row(pic.id, second!.id, "2026-09-10"),
    ]);

    expect(result).toMatchObject({ outcome: "arranged" });
    expect(await allSessions()).toMatchObject([
      {
        schoolId: first!.id,
        mode: "online",
        perjadinId: null,
        heldOn: "2026-09-10",
        status: "arranged",
        cancelledReason: null,
        onlinePicPersonId: pic.id,
        onlinePicRole: "Staff",
      },
      { schoolId: second!.id, mode: "online", perjadinId: null, onlinePicPersonId: pic.id },
    ]);
  });

  it("keeps the date each row was edited to, rather than one shared date", async () => {
    /**
     * The second half of criterion 2. The shared date is the form's default and the rows
     * are still editable before submit, so the write takes a date per row — a function
     * taking one date for the batch would satisfy "a shared default date" and quietly
     * lose the edit.
     */
    const pic = await signInAsStaff();
    const [first, second, third] = await threeSchools();

    await arrangeOnlineSessions(pic, [
      row(pic.id, first!.id, "2026-09-10"),
      row(pic.id, second!.id, "2026-09-11"),
      row(pic.id, third!.id, "2026-09-10"),
    ]);

    const written = await allSessions();
    expect(written.map((entry) => [entry.schoolId, entry.heldOn])).toEqual([
      [first!.id, "2026-09-10"],
      [second!.id, "2026-09-11"],
      [third!.id, "2026-09-10"],
    ]);
  });

  it("keeps the PIC each row was edited to, rather than one shared PIC", async () => {
    /**
     * The other half of the same criterion as the date above. *"Applies a shared date and
     * a shared Staff PIC, and lets every row be edited before submit"* — the rows are
     * what both values were applied to, so both are editable per row and
     * `online_pic_person_id` is a column on the Session rather than a property of the
     * batch. A function taking one PIC for the whole batch would lose this edit silently.
     */
    const pic = await signInAsStaff();
    const second = await signInAsPerson("Staff", "andi@ditsama.itb.ac.id", "Andi Wijaya");
    const [first, other] = await threeSchools();

    await arrangeOnlineSessions(pic, [
      row(pic.id, first!.id, "2026-09-10"),
      row(second.id, other!.id, "2026-09-10"),
    ]);

    const written = await allSessions();
    expect(written.map((entry) => [entry.schoolId, entry.onlinePicPersonId])).toEqual([
      [first!.id, pic.id],
      [other!.id, second.id],
    ]);
  });

  it("names a Teaching Team member per Stream where a row named one", async () => {
    /** Criterion 3's first half: a row *may* name them, one per Stream. */
    const pic = await signInAsStaff();
    const [first] = await threeSchools();
    const stem = await addPerson({
      fullName: "Budi Santoso",
      email: "budi@gmail.com",
      role: "Teaching Team",
    });
    const research = await addPerson({
      fullName: "Ratna Dewi",
      email: "ratna@gmail.com",
      role: "Teaching Team",
    });

    await arrangeOnlineSessions(pic, [
      {
        schoolId: first!.id,
        heldOn: "2026-09-10",
        picPersonId: pic.id,
        teachers: [
          { stream: "STEM", personId: stem.id },
          { stream: "Research", personId: research.id },
        ],
      },
    ]);

    const [written] = await allSessions();
    expect(await allTeachers()).toEqual(
      expect.arrayContaining([
        { sessionId: written!.id, stream: "STEM", personId: stem.id, personRole: "Teaching Team" },
        {
          sessionId: written!.id,
          stream: "Research",
          personId: research.id,
          personRole: "Teaching Team",
        },
      ]),
    );
  });

  it("arranges a row that names nobody", async () => {
    /**
     * Criterion 3's second half, and the one that matters more. Naming both Streams is
     * **optional here** and mandatory at Tandai terlaksana, because a batch must not be
     * blocked while one professor is not yet fixed — the ordinary case. A row naming one
     * Stream and not the other is the same rule at its most exposed.
     */
    const pic = await signInAsStaff();
    const [first, second] = await threeSchools();
    const stem = await addPerson({
      fullName: "Budi Santoso",
      email: "budi@gmail.com",
      role: "Teaching Team",
    });

    const result = await arrangeOnlineSessions(pic, [
      row(pic.id, first!.id, "2026-09-10"),
      {
        schoolId: second!.id,
        heldOn: "2026-09-10",
        picPersonId: pic.id,
        teachers: [{ stream: "STEM", personId: stem.id }],
      },
    ]);

    expect(result).toMatchObject({ outcome: "arranged" });
    expect(await allSessions()).toHaveLength(2);
    expect(await allTeachers()).toMatchObject([{ stream: "STEM", personId: stem.id }]);
  });

  it("refuses a row that collides with an existing Session, and names it", async () => {
    /** Criterion 5. The screen has the row in hand, so the School is named rather than described. */
    const pic = await signInAsStaff();
    const [first, second] = await threeSchools();
    await addSession({ schoolId: second!.id, heldOn: "2026-09-10", onlinePicPersonId: pic.id });

    const result = await arrangeOnlineSessions(pic, [
      row(pic.id, first!.id, "2026-09-10"),
      row(pic.id, second!.id, "2026-09-10"),
    ]);

    expect(result).toEqual({
      outcome: "collided",
      collisions: [{ schoolId: second!.id, heldOn: "2026-09-10" }],
    });
  });

  it("writes nothing at all when one row collides", async () => {
    /**
     * **The transaction, and the reason this ticket is the one that proves convention 5.**
     *
     * The criterion says a collision is *refused*, and the reading taken here is that the
     * batch is refused rather than the row: write-what-fits leaves Staff looking at a
     * list where some rows happened and some did not, with no way to retry the failures
     * without re-selecting from Coverage.
     *
     * So the assertion is on the database and not on the return value. The first row is
     * insertable, names two teachers, and is attempted before the collision is reached —
     * and none of it survives. Move the boundary out of `@sugt/db` and this is the test
     * that goes red.
     */
    const pic = await signInAsStaff();
    const [first, second] = await threeSchools();
    const stem = await addPerson({
      fullName: "Budi Santoso",
      email: "budi@gmail.com",
      role: "Teaching Team",
    });
    const blocker = await addSession({
      schoolId: second!.id,
      heldOn: "2026-09-10",
      onlinePicPersonId: pic.id,
    });

    await arrangeOnlineSessions(pic, [
      {
        schoolId: first!.id,
        heldOn: "2026-09-10",
        picPersonId: pic.id,
        teachers: [{ stream: "STEM", personId: stem.id }],
      },
      row(pic.id, second!.id, "2026-09-10"),
    ]);

    // The Session that was already there, and nothing else.
    expect((await allSessions()).map((entry) => entry.id)).toEqual([blocker.id]);
    expect(await allTeachers()).toEqual([]);
  });

  it("names every colliding row, not the first one it reached", async () => {
    /**
     * One submit, one list of what to fix. Stopping at the first collision would make a
     * batch of eleven take as many attempts as it has bad dates.
     */
    const pic = await signInAsStaff();
    const [first, second, third] = await threeSchools();
    await addSession({ schoolId: first!.id, heldOn: "2026-09-10", onlinePicPersonId: pic.id });
    await addSession({ schoolId: third!.id, heldOn: "2026-09-10", onlinePicPersonId: pic.id });

    const result = await arrangeOnlineSessions(pic, [
      row(pic.id, first!.id, "2026-09-10"),
      row(pic.id, second!.id, "2026-09-10"),
      row(pic.id, third!.id, "2026-09-10"),
    ]);

    expect(result).toEqual({
      outcome: "collided",
      collisions: [
        { schoolId: first!.id, heldOn: "2026-09-10" },
        { schoolId: third!.id, heldOn: "2026-09-10" },
      ],
    });
  });

  it("does not collide with a cancelled Session on the same day", async () => {
    /**
     * The write path's half of the index's first partial clause. `on conflict` repeats
     * the index predicate to name its arbiter, so a predicate that had drifted from the
     * index would refuse this — and Postgres would refuse to infer the index at all if
     * the two did not match, which is what makes this test load-bearing rather than
     * duplicative of the index block above.
     */
    const pic = await signInAsStaff();
    const [first] = await threeSchools();
    await addSession({
      schoolId: first!.id,
      heldOn: "2026-09-10",
      status: "cancelled",
      onlinePicPersonId: pic.id,
    });

    const result = await arrangeOnlineSessions(pic, [row(pic.id, first!.id, "2026-09-10")]);

    expect(result).toMatchObject({ outcome: "arranged" });
    expect(await allSessions()).toHaveLength(2);
  });

  it("reaches the browser as a 403 when the Server Action wraps it", async () => {
    /**
     * The claim `actions.ts` makes, asserted rather than written down. `staffSurface` was
     * built for a **read** — its doc reasoned entirely about a rendering pass — and this
     * ticket is the first to put a **write** behind it, so "it should read as a 403" was
     * prose nothing checked.
     *
     * The environment variable is what `experimental.authInterrupts` sets during a build.
     * `forbidden()` checks it at runtime and throws something else entirely when it is
     * off, so asserting under the deployed condition is the point.
     */
    vi.stubEnv("__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS", "1");
    const teacher = await signInAsPerson("Teaching Team", "budi@gmail.com", "Budi Santoso");
    const staff = await signInAsPerson("Staff", "rina@ditsama.itb.ac.id", "Rina Nurhayati");
    const [first] = await threeSchools();

    const thrown = await staffSurface(() =>
      arrangeOnlineSessions(teacher, [row(staff.id, first!.id, "2026-09-10")]),
    ).catch((error: unknown) => error);

    expect((thrown as { digest?: string }).digest).toBe("NEXT_HTTP_ERROR_FALLBACK;403");
    expect(await allSessions()).toEqual([]);
  });

  it("refuses a Teaching Team caller, and writes nothing", async () => {
    /**
     * Criterion 6. Staff-only is enforced here rather than only by the screen, because a
     * Next.js layout does not run before a Server Action — the layout's check protects
     * reads and leaves every write open.
     */
    const teacher = await signInAsPerson("Teaching Team", "budi@gmail.com", "Budi Santoso");
    const staff = await signInAsPerson("Staff", "rina@ditsama.itb.ac.id", "Rina Nurhayati");
    const [first] = await threeSchools();

    const refusal = await arrangeOnlineSessions(teacher, [
      row(staff.id, first!.id, "2026-09-10"),
    ]).catch((error: unknown) => error);

    expect(isNotStaffError(refusal)).toBe(true);
    expect(await allSessions()).toEqual([]);
  });
});

describe("the Jadwalkan Sesi daring payload", () => {
  beforeEach(resetDatabase);

  /** Two Schools whose names sort the opposite way round from their creation order. */
  async function twoSchoolsOutOfNameOrder() {
    await addProvince("JB", "Jawa Barat");
    const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
    const first = await addSchool({
      slug: "sman-2-bandung",
      name: "SMAN 2 Bandung",
      clusterId: cluster.id,
      provinceCode: "JB",
      kabupatenKota: "Kota Bandung",
    });
    const second = await addSchool({
      slug: "sman-1-bogor",
      name: "SMAN 1 Bogor",
      clusterId: cluster.id,
      provinceCode: "JB",
      kabupatenKota: "Kota Bogor",
    });
    return { first, second };
  }

  it("returns the selected Schools in name order, with where they are", async () => {
    const person = await signInAsStaff();
    const { first, second } = await twoSchoolsOutOfNameOrder();

    const batch = await onlineSessionBatch(person, [first.id, second.id]);

    expect(batch.schools).toEqual([
      { id: second.id, name: "SMAN 1 Bogor", kabupatenKota: "Kota Bogor" },
      { id: first.id, name: "SMAN 2 Bandung", kabupatenKota: "Kota Bandung" },
    ]);
  });

  it("drops a School id that matches nothing rather than refusing the screen", async () => {
    /**
     * A hand-edited URL is reachable. The screen lists every School it is about to write
     * a Session for, by name, so a dropped id shows up as an absence a reader can see —
     * which is a better answer than an error page for a selection that is mostly valid.
     */
    const person = await signInAsStaff();
    const { first } = await twoSchoolsOutOfNameOrder();

    const batch = await onlineSessionBatch(person, [
      first.id,
      "00000000-0000-0000-0000-000000000000",
    ]);

    expect(batch.schools).toMatchObject([{ id: first.id }]);
  });

  it("offers Staff for the PIC and Teaching Team for the Streams, split by role", async () => {
    const person = await signInAsStaff();
    await twoSchoolsOutOfNameOrder();
    const teacher = await addPerson({
      fullName: "Budi Santoso",
      email: "budi@gmail.com",
      role: "Teaching Team",
    });

    const batch = await onlineSessionBatch(person, []);

    expect(batch.staff).toEqual([{ id: person.id, fullName: "Rina Nurhayati" }]);
    expect(batch.teachingTeam).toEqual([{ id: teacher.id, fullName: "Budi Santoso" }]);
  });

  it("leaves a revoked Person out of both pickers", async () => {
    /**
     * `active = false` is the whole revocation mechanism. Naming a revoked Person as the
     * PIC of a Session nobody has taught yet would commit them to filing its Session
     * Record; naming them on a Stream would put them on the chase list for Class Records
     * they can no longer sign in to file.
     */
    const person = await signInAsStaff();
    const gone = await addPerson({
      fullName: "Budi Santoso",
      email: "budi@gmail.com",
      role: "Teaching Team",
    });
    await revokePerson(gone.id);

    const batch = await onlineSessionBatch(person, []);

    expect(batch.teachingTeam).toEqual([]);
  });

  it("refuses a Teaching Team caller", async () => {
    /**
     * The screen is Staff-only, so its read is too — otherwise a Teaching Team member
     * reaching the URL directly would be shown the whole form and refused only on
     * submit.
     */
    const teacher = await signInAsPerson("Teaching Team", "budi@gmail.com", "Budi Santoso");

    const refusal = await onlineSessionBatch(teacher, []).catch((error: unknown) => error);

    expect(isNotStaffError(refusal)).toBe(true);
  });
});
