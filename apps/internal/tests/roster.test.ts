import { db, schema } from "@sugt/db";
import { addPerson, isNotStaffError, revokePerson, roster } from "@sugt/db/queries";
import { STAFF_EMAIL_DOMAIN } from "@sugt/domain";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addCluster,
  addPerjadin,
  addPerson as seedPerson,
  addProvince,
  addSchool,
  refusedBy,
  resetDatabase,
} from "./support/fixtures";
import { signInAsPerson } from "./support/sign-in";

/**
 * **Orang** — the roster and the invite list. The rules under test are the ones ADR-0013 draws:
 * revoking is one write, a duplicate active email is refused by the partial index, a Staff member
 * must hold a DITSAMA address, and `used` — the write-once lock — is computed from all **seven**
 * composite foreign keys, the Story author included.
 */

/** A Staff Person to hand the writes as their caller. */
async function staffCaller() {
  return seedPerson({ fullName: "Rina Nurhayati", email: "rina@ditsama.itb.ac.id", role: "Staff" });
}

async function oneSchool() {
  await addProvince("JB", "Jawa Barat");
  const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
  return addSchool({ slug: "sman-8", name: "SMAN 8", clusterId: cluster.id, provinceCode: "JB" });
}

const byEmail = (list: Awaited<ReturnType<typeof roster>>, email: string) =>
  list.find((entry) => entry.email === email);

describe("addPerson", () => {
  beforeEach(resetDatabase);

  it("the partial person_email_key refuses a second active row for one email", async () => {
    await seedPerson({ fullName: "Budi", email: "budi@gmail.com", role: "Teaching Team" });

    const refusal = await refusedBy(
      db
        .insert(schema.person)
        .values({ fullName: "Budi Dua", email: "budi@gmail.com", role: "Teaching Team" }),
    );

    expect(refusal).toBe("person_email_key");
  });

  it("refuses a duplicate active email as a value", async () => {
    const staff = await staffCaller();
    await addPerson(staff, { fullName: "Budi", email: "budi@gmail.com", role: "Teaching Team" });

    const again = await addPerson(staff, {
      fullName: "Budi Dua",
      email: "budi@gmail.com",
      role: "Teaching Team",
    });

    expect(again).toEqual({ outcome: "email-taken" });
  });

  it("adds a Teaching Team member with any email", async () => {
    const staff = await staffCaller();

    const result = await addPerson(staff, {
      fullName: "Budi",
      email: "budi@gmail.com",
      role: "Teaching Team",
    });

    expect(result.outcome).toBe("added");
  });

  it("refuses a Staff member without a DITSAMA address, and writes nothing", async () => {
    const staff = await staffCaller();

    const result = await addPerson(staff, {
      fullName: "Doni",
      email: "doni@gmail.com",
      role: "Staff",
    });

    expect(result).toEqual({ outcome: "staff-needs-domain" });
    const rows = await db
      .select()
      .from(schema.person)
      .where(eq(schema.person.email, "doni@gmail.com"));
    expect(rows).toHaveLength(0);
  });

  it("adds a Staff member with a DITSAMA address", async () => {
    const staff = await staffCaller();

    const result = await addPerson(staff, {
      fullName: "Dewi",
      email: `dewi${STAFF_EMAIL_DOMAIN}`,
      role: "Staff",
    });

    expect(result.outcome).toBe("added");
  });

  it("refuses a blank name or email", async () => {
    const staff = await staffCaller();

    expect(
      await addPerson(staff, { fullName: "   ", email: "x@gmail.com", role: "Teaching Team" }),
    ).toEqual({ outcome: "incomplete" });
  });

  it("re-adds an email once the active row is revoked", async () => {
    const staff = await staffCaller();
    const first = await addPerson(staff, {
      fullName: "Budi",
      email: "budi@gmail.com",
      role: "Teaching Team",
    });
    if (first.outcome !== "added") throw new Error("unreachable");
    await revokePerson(staff, first.personId);

    const again = await addPerson(staff, {
      fullName: "Budi Baru",
      email: "budi@gmail.com",
      role: "Teaching Team",
    });

    expect(again.outcome).toBe("added");
  });

  it("throws NotStaffError for a Teaching Team caller", async () => {
    const teacher = await seedPerson({
      fullName: "Prof",
      email: "prof@gmail.com",
      role: "Teaching Team",
    });

    const refusal = await addPerson(teacher, {
      fullName: "Budi",
      email: "budi@gmail.com",
      role: "Teaching Team",
    }).catch((error: unknown) => error);

    expect(isNotStaffError(refusal)).toBe(true);
  });
});

describe("revokePerson", () => {
  beforeEach(resetDatabase);

  it("sets active to false in one write", async () => {
    const staff = await staffCaller();
    const person = await seedPerson({
      fullName: "Budi",
      email: "budi@gmail.com",
      role: "Teaching Team",
    });

    expect(await revokePerson(staff, person.id)).toEqual({ outcome: "revoked" });
    const [row] = await db.select().from(schema.person).where(eq(schema.person.id, person.id));
    expect(row?.active).toBe(false);
  });

  it("reports no-such-person when the row is already revoked", async () => {
    const staff = await staffCaller();
    const person = await seedPerson({
      fullName: "Budi",
      email: "budi@gmail.com",
      role: "Teaching Team",
      active: false,
    });

    expect(await revokePerson(staff, person.id)).toEqual({ outcome: "no-such-person" });
  });

  it("throws NotStaffError for a Teaching Team caller", async () => {
    const teacher = await seedPerson({
      fullName: "Prof",
      email: "prof@gmail.com",
      role: "Teaching Team",
    });
    const target = await seedPerson({
      fullName: "Budi",
      email: "budi@gmail.com",
      role: "Teaching Team",
    });

    const refusal = await revokePerson(teacher, target.id).catch((error: unknown) => error);

    expect(isNotStaffError(refusal)).toBe(true);
  });
});

describe("roster", () => {
  beforeEach(resetDatabase);

  it("shows the three states — invited, signed in, and revoked", async () => {
    const staff = await staffCaller();
    await seedPerson({ fullName: "Invited", email: "invited@gmail.com", role: "Teaching Team" });
    await signInAsPerson("Teaching Team", "signed@gmail.com", "Signed In");
    const revoked = await seedPerson({
      fullName: "Revoked",
      email: "revoked@gmail.com",
      role: "Teaching Team",
    });
    await revokePerson(staff, revoked.id);

    const list = await roster(staff);
    expect(byEmail(list, "invited@gmail.com")).toMatchObject({ active: true, signedIn: false });
    expect(byEmail(list, "signed@gmail.com")).toMatchObject({ active: true, signedIn: true });
    expect(byEmail(list, "revoked@gmail.com")).toMatchObject({ active: false });
  });

  it("flags a used Person and leaves an unused one unlocked", async () => {
    const staff = await staffCaller();
    const teacher = await seedPerson({
      fullName: "Prof",
      email: "prof@gmail.com",
      role: "Teaching Team",
    });
    await seedPerson({ fullName: "Unused", email: "unused@gmail.com", role: "Teaching Team" });
    // The trip makes the PIC and the teacher Group members — used by the composite key.
    await addPerjadin({
      advanceIdr: 5_000_000,
      picPersonId: staff.id,
      teachers: [{ personId: teacher.id, stream: "STEM" }],
    });

    const list = await roster(staff);
    expect(byEmail(list, "prof@gmail.com")?.used).toBe(true);
    expect(byEmail(list, "unused@gmail.com")?.used).toBe(false);
  });

  it("flags a Story author as used — the seventh composite reference", async () => {
    const staff = await staffCaller();
    const author = await seedPerson({
      fullName: "Penulis",
      email: `penulis${STAFF_EMAIL_DOMAIN}`,
      role: "Staff",
    });
    const school = await oneSchool();
    await db.insert(schema.story).values({
      slug: "cerita-1",
      schoolId: school.id,
      title: "Judul",
      body: "Isi",
      writtenByPersonId: author.id,
    });

    const list = await roster(staff);
    expect(byEmail(list, `penulis${STAFF_EMAIL_DOMAIN}`)?.used).toBe(true);
  });
});
