import { db, schema } from "@sugt/db";
import {
  arrangeOnlineSession,
  arrangeOnlineSessionAt,
  arrangeOnlineSessionForm,
  isNotStaffError,
} from "@sugt/db/queries";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addCluster,
  addPerson,
  addProvince,
  addSchool,
  addSession,
  resetDatabase,
} from "./support/fixtures";

/**
 * **Jadwalkan Sesi daring** — arranging one online Session at a time (#70). The write is the
 * substance: exactly one Session, `mode: 'online'`, its own date and start time and a Staff PIC,
 * optional teachers, and a collision on `session_one_online_per_school_per_day` returned as a
 * value. The index is **not** widened to `starts_at`, so two online Sessions at one School on one
 * day collide whatever the hour — the case a test has to pin.
 */

async function staffCaller(email = "rina@ditsama.itb.ac.id") {
  return addPerson({ fullName: "Rina Nurhayati", email, role: "Staff" });
}

async function oneSchool(slug = "sman-8", name = "SMAN 8") {
  await addProvince("JB", "Jawa Barat");
  const cluster = await addCluster({ slug: `cluster-${slug}`, name: `Cluster ${slug}` });
  return addSchool({ slug, name, clusterId: cluster.id, provinceCode: "JB" });
}

async function sessionsAt(schoolId: string) {
  return db
    .select({
      id: schema.session.id,
      mode: schema.session.mode,
      heldOn: schema.session.heldOn,
      startsAt: schema.session.startsAt,
      status: schema.session.status,
      perjadinId: schema.session.perjadinId,
      onlinePicPersonId: schema.session.onlinePicPersonId,
      onlinePicRole: schema.session.onlinePicRole,
    })
    .from(schema.session)
    .where(eq(schema.session.schoolId, schoolId));
}

describe("arrangeOnlineSession", () => {
  beforeEach(resetDatabase);

  it("arranges one online Session with its own date, time and Staff PIC", async () => {
    const staff = await staffCaller();
    const school = await oneSchool();

    const result = await arrangeOnlineSession(staff, {
      schoolId: school.id,
      heldOn: "2026-09-01",
      startsAt: "09:30",
      picPersonId: staff.id,
      teachers: [],
    });

    expect(result.outcome).toBe("arranged");
    const [row] = await sessionsAt(school.id);
    expect(row).toMatchObject({
      mode: "online",
      heldOn: "2026-09-01",
      status: "arranged",
      perjadinId: null,
      onlinePicPersonId: staff.id,
      onlinePicRole: "Staff",
    });
    expect(row?.startsAt).toMatch(/^09:30/);
  });

  it("writes session_teacher rows for the named Streams and none for the unnamed", async () => {
    const staff = await staffCaller();
    const prof = await addPerson({
      fullName: "Bagus",
      email: "bagus@itb.ac.id",
      role: "Teaching Team",
    });
    const school = await oneSchool();

    const result = await arrangeOnlineSession(staff, {
      schoolId: school.id,
      heldOn: "2026-09-01",
      startsAt: "09:00",
      picPersonId: staff.id,
      teachers: [{ stream: "STEM", personId: prof.id }],
    });
    if (result.outcome !== "arranged") throw new Error("unreachable");

    const teachers = await db
      .select({ stream: schema.sessionTeacher.stream, personId: schema.sessionTeacher.personId })
      .from(schema.sessionTeacher)
      .where(eq(schema.sessionTeacher.sessionId, result.sessionId));
    expect(teachers).toEqual([{ stream: "STEM", personId: prof.id }]);
  });

  it("writes no session_teacher rows when no teacher is named", async () => {
    const staff = await staffCaller();
    const school = await oneSchool();

    await arrangeOnlineSession(staff, {
      schoolId: school.id,
      heldOn: "2026-09-01",
      startsAt: "09:00",
      picPersonId: staff.id,
      teachers: [],
    });

    expect(await db.select().from(schema.sessionTeacher)).toEqual([]);
  });

  it("refuses a second online Session at one School on one day, and writes nothing", async () => {
    const staff = await staffCaller();
    const school = await oneSchool();
    await addSession({ schoolId: school.id, heldOn: "2026-09-01", onlinePicPersonId: staff.id });

    const result = await arrangeOnlineSession(staff, {
      schoolId: school.id,
      heldOn: "2026-09-01",
      startsAt: "13:00",
      picPersonId: staff.id,
      teachers: [],
    });

    expect(result).toEqual({ outcome: "collided", heldOn: "2026-09-01" });
    // Still just the one pre-existing Session — nothing was written.
    expect(await sessionsAt(school.id)).toHaveLength(1);
  });

  it("collides on the day, not the slot — a different start time is still refused", async () => {
    const staff = await staffCaller();
    const school = await oneSchool();
    await addSession({
      schoolId: school.id,
      heldOn: "2026-09-01",
      startsAt: "09:00",
      onlinePicPersonId: staff.id,
    });

    const result = await arrangeOnlineSession(staff, {
      schoolId: school.id,
      heldOn: "2026-09-01",
      startsAt: "15:00",
      picPersonId: staff.id,
      teachers: [],
    });

    expect(result.outcome).toBe("collided");
    expect(await sessionsAt(school.id)).toHaveLength(1);
  });

  it("does not collide with a cancelled Session on that day", async () => {
    const staff = await staffCaller();
    const school = await oneSchool();
    await addSession({
      schoolId: school.id,
      heldOn: "2026-09-01",
      status: "cancelled",
      onlinePicPersonId: staff.id,
    });

    const result = await arrangeOnlineSession(staff, {
      schoolId: school.id,
      heldOn: "2026-09-01",
      startsAt: "09:00",
      picPersonId: staff.id,
      teachers: [],
    });

    expect(result.outcome).toBe("arranged");
    // The cancelled row plus the new one.
    const rows = await sessionsAt(school.id);
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.status === "arranged")).toHaveLength(1);
  });

  it("throws NotStaffError for a Teaching Team caller", async () => {
    const teacher = await addPerson({
      fullName: "Prof",
      email: "prof@gmail.com",
      role: "Teaching Team",
    });
    const school = await oneSchool();

    const refusal = await arrangeOnlineSession(teacher, {
      schoolId: school.id,
      heldOn: "2026-09-01",
      startsAt: "09:00",
      picPersonId: teacher.id,
      teachers: [],
    }).catch((error: unknown) => error);

    expect(isNotStaffError(refusal)).toBe(true);
    expect(await db.select().from(schema.session)).toEqual([]);
  });
});

describe("arrangeOnlineSessionForm", () => {
  beforeEach(resetDatabase);

  it("returns every School in name order and the two rosters, split by role", async () => {
    const staff = await staffCaller();
    await addPerson({ fullName: "Bagus", email: "bagus@itb.ac.id", role: "Teaching Team" });
    await oneSchool("sman-2", "SMAN 2 Bandung");
    await oneSchool("sman-1", "SMAN 1 Bandung");

    const form = await arrangeOnlineSessionForm(staff);

    expect(form.schools.map((entry) => entry.name)).toEqual(["SMAN 1 Bandung", "SMAN 2 Bandung"]);
    expect(form.staff.map((entry) => entry.fullName)).toContain("Rina Nurhayati");
    expect(form.teachingTeam.map((entry) => entry.fullName)).toContain("Bagus");
  });

  it("throws NotStaffError for a Teaching Team caller", async () => {
    const teacher = await addPerson({
      fullName: "Prof",
      email: "prof@gmail.com",
      role: "Teaching Team",
    });

    const refusal = await arrangeOnlineSessionForm(teacher).catch((error: unknown) => error);

    expect(isNotStaffError(refusal)).toBe(true);
  });
});

describe("arrangeOnlineSessionAt", () => {
  beforeEach(resetDatabase);

  it("returns the School named by its slug and the rosters", async () => {
    const staff = await staffCaller();
    const school = await oneSchool("sman-8", "SMAN 8");

    const at = await arrangeOnlineSessionAt(staff, "sman-8");

    expect(at?.school).toMatchObject({ id: school.id, name: "SMAN 8" });
    expect(at?.staff.map((entry) => entry.fullName)).toContain("Rina Nurhayati");
  });

  it("is null for a slug naming no School", async () => {
    const staff = await staffCaller();

    expect(await arrangeOnlineSessionAt(staff, "tidak-ada")).toBeNull();
  });

  it("throws NotStaffError for a Teaching Team caller", async () => {
    const teacher = await addPerson({
      fullName: "Prof",
      email: "prof@gmail.com",
      role: "Teaching Team",
    });
    await oneSchool();

    const refusal = await arrangeOnlineSessionAt(teacher, "sman-8").catch(
      (error: unknown) => error,
    );

    expect(isNotStaffError(refusal)).toBe(true);
  });
});
