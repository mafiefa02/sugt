import { coverage } from "@sugt/db/queries";
import { beforeEach, describe, expect, it } from "vitest";

import { addCluster, addProvince, addSchool, addSession, resetDatabase } from "./support/fixtures";
import { signInAsPerson } from "./support/sign-in";

/**
 * **Coverage** — the first real read through the query layer.
 *
 * The `Person` these assertions pass in is a real one, produced the only way the app
 * produces one: sign in through seam 1, take the `Set-Cookie`, resolve it through
 * seam 2. Fabricating an object of the right shape would test the fold below and
 * nothing about the choke point the payload is reached through.
 *
 * What is asserted is external behaviour — the payload a screen renders — and never
 * that a particular join was written a particular way.
 */
describe("the Coverage payload", () => {
  beforeEach(resetDatabase);

  /** A Staff Person, signed in for real. Online Sessions need one as their PIC. */
  const signInAsStaff = () => signInAsPerson("Staff", "rina@ditsama.itb.ac.id", "Rina Nurhayati");

  /**
   * Two Clusters, three Schools, and one School carrying a Session of every status.
   *
   * Deliberately not the real forty-two: the assertions here are about counting and
   * grouping, and a fixture whose numbers come from a seed file nobody edits for a
   * test is a fixture whose failures are unreadable.
   */
  async function seedTwoClusters(picPersonId: string) {
    await addProvince("JB", "Jawa Barat");

    const alpha = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
    const beta = await addCluster({ slug: "beta", name: "Cluster Beta" });

    const busy = await addSchool({
      slug: "sman-1-bandung",
      name: "SMAN 1 Bandung",
      clusterId: alpha.id,
      provinceCode: "JB",
    });
    const untouched = await addSchool({
      slug: "sman-2-bandung",
      name: "SMAN 2 Bandung",
      clusterId: alpha.id,
      provinceCode: "JB",
    });
    const other = await addSchool({
      slug: "sman-3-bogor",
      name: "SMAN 3 Bogor",
      clusterId: beta.id,
      provinceCode: "JB",
      kabupatenKota: "Kota Bogor",
    });

    // Two delivered, plus one of each status that must count for nothing.
    await addSession({
      schoolId: busy.id,
      heldOn: "2026-09-01",
      status: "delivered",
      onlinePicPersonId: picPersonId,
    });
    await addSession({
      schoolId: busy.id,
      heldOn: "2026-09-08",
      status: "delivered",
      onlinePicPersonId: picPersonId,
    });
    await addSession({
      schoolId: busy.id,
      heldOn: "2026-09-15",
      status: "arranged",
      onlinePicPersonId: picPersonId,
    });
    await addSession({
      schoolId: busy.id,
      heldOn: "2026-09-22",
      status: "cancelled",
      onlinePicPersonId: picPersonId,
    });

    await addSession({
      schoolId: other.id,
      heldOn: "2026-09-02",
      status: "delivered",
      onlinePicPersonId: picPersonId,
    });

    return { alpha, beta, busy, untouched, other };
  }

  it("groups every School under its Cluster", async () => {
    const person = await signInAsStaff();
    await seedTwoClusters(person.id);

    const clusters = await coverage(person);

    expect(clusters.map((cluster) => cluster.name)).toEqual(["Cluster Alpha", "Cluster Beta"]);
    expect(clusters[0]?.schools.map((school) => school.name)).toEqual([
      "SMAN 1 Bandung",
      "SMAN 2 Bandung",
    ]);
    expect(clusters[1]?.schools.map((school) => school.name)).toEqual(["SMAN 3 Bogor"]);
  });

  it("counts delivered Sessions only — arranged and cancelled count for nothing", async () => {
    const person = await signInAsStaff();
    await seedTwoClusters(person.id);

    const clusters = await coverage(person);
    const counts = clusters.flatMap((cluster) =>
      cluster.schools.map((school) => [school.name, school.deliveredSessions] as const),
    );

    expect(Object.fromEntries(counts)).toEqual({
      // Four Sessions: two delivered, one arranged, one cancelled.
      "SMAN 1 Bandung": 2,
      "SMAN 3 Bogor": 1,
      "SMAN 2 Bandung": 0,
    });
  });

  it("renders a School nobody has reached yet, at zero", async () => {
    /**
     * The School with no Sessions at all is the one a reader of this screen is
     * looking for, so it must not be filtered out. It would be, were the delivered
     * predicate in a WHERE rather than in the JOIN.
     */
    const person = await signInAsStaff();
    const { untouched } = await seedTwoClusters(person.id);

    const clusters = await coverage(person);
    const found = clusters
      .flatMap((cluster) => cluster.schools)
      .find((school) => school.id === untouched.id);

    expect(found).toMatchObject({ name: "SMAN 2 Bandung", deliveredSessions: 0 });
  });

  it("is open to a Teaching Team member, who reads the same counts", async () => {
    /**
     * ADR-0004: delivery data is open to everyone signed in. Coverage carries no
     * money, so the only thing narrowing it is the `Person` arm of the `Caller`
     * union — not a role check.
     */
    const staff = await signInAsStaff();
    await seedTwoClusters(staff.id);

    const teacher = await signInAsPerson("Teaching Team", "budi@gmail.com", "Budi Santoso");

    expect(teacher.role).toBe("Teaching Team");
    await expect(coverage(teacher)).resolves.toEqual(await coverage(staff));
  });
});
