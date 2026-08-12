import { db, schema } from "@sugt/db";
import type { SessionMode, SessionStatus, Stream, Role } from "@sugt/domain";
import { eq, sql } from "drizzle-orm";

export type PersonFixture = {
  fullName: string;
  email: string;
  role: Role;
  active?: boolean;
};

/** Put a Person on the invite list. A row **is** the invitation. */
export async function addPerson(fixture: PersonFixture) {
  const [person] = await db
    .insert(schema.person)
    .values({
      fullName: fixture.fullName,
      email: fixture.email,
      role: fixture.role,
      active: fixture.active ?? true,
    })
    .returning();
  return person!;
}

/** Revoke a Person. One write — this is the whole revocation mechanism. */
export async function revokePerson(id: string) {
  await db.update(schema.person).set({ active: false }).where(eq(schema.person.id, id));
}

/** Every `better_auth.user` row. The invite gate's job is to leave this empty. */
export async function authUsers() {
  return db.select().from(schema.user);
}

/** Every `better_auth.session` row. */
export async function authSessions() {
  return db.select().from(schema.authSession);
}

/**
 * Reference data: a Province, then a Cluster, then Schools in it.
 *
 * **The test database has none of the real forty-two.** `migrate-from-empty.ts`
 * applies the migrations and stops; `reference-data.sql` is a separate `db:seed`
 * against `$DIRECT_URL`. That is the right split — seeding the real roster here would
 * make every count assertion depend on a file nobody edits for a test — so a test
 * that needs Schools builds the handful it is about.
 */
export async function addProvince(code: string, name: string) {
  const [province] = await db
    .insert(schema.province)
    .values({ code, name })
    .onConflictDoNothing()
    .returning();
  return province ?? { code, name };
}

export type ClusterFixture = { slug: string; name: string; topic?: string; problem?: string };

export async function addCluster(fixture: ClusterFixture) {
  const [cluster] = await db
    .insert(schema.cluster)
    .values({
      slug: fixture.slug,
      name: fixture.name,
      topic: fixture.topic ?? "Mitigasi Bencana",
      problem: fixture.problem ?? "Peringatan dini banjir",
    })
    .returning();
  return cluster!;
}

export type SchoolFixture = {
  slug: string;
  name: string;
  clusterId: string;
  provinceCode: string;
  kabupatenKota?: string;
};

export async function addSchool(fixture: SchoolFixture) {
  const [school] = await db
    .insert(schema.school)
    .values({
      slug: fixture.slug,
      name: fixture.name,
      clusterId: fixture.clusterId,
      provinceCode: fixture.provinceCode,
      kabupatenKota: fixture.kabupatenKota ?? "Kota Bandung",
    })
    .returning();
  return school!;
}

export type SessionFixture = {
  schoolId: string;
  heldOn: string;
  status?: SessionStatus;
  /** A Staff Person. An online Session carries its own PIC, since it has no Perjadin. */
  onlinePicPersonId: string;
};

/**
 * An **online** Session, which is the cheap one to build: `mode = 'online'` means no
 * Perjadin, so it needs nothing but a School and a Staff PIC. The two CHECKs are
 * exact mirrors — an offline Session has a Perjadin and an online one has none — so
 * an offline fixture would have to build a whole trip first.
 *
 * A cancelled Session needs its reason in the same statement, by CHECK.
 */
export async function addSession(fixture: SessionFixture) {
  const status: SessionStatus = fixture.status ?? "arranged";
  const [session] = await db
    .insert(schema.session)
    .values({
      schoolId: fixture.schoolId,
      mode: "online" satisfies SessionMode,
      heldOn: fixture.heldOn,
      status,
      cancelledReason: status === "cancelled" ? "Sekolah meminta penjadwalan ulang" : null,
      onlinePicPersonId: fixture.onlinePicPersonId,
      onlinePicRole: "Staff",
    })
    .returning();
  return session!;
}

export type PerjadinFixture = {
  destination?: string;
  startsOn?: string;
  endsOn?: string;
  advanceIdr: number;
  /** Staff. They are the PIC and, by the deferred foreign key, a member of their own Group. */
  picPersonId: string;
  /** Teaching Team, each carrying the Stream they cover. Staff never carry one. */
  teachers?: { personId: string; stream: Stream }[];
};

/**
 * A Perjadin and its Group, **in one transaction** — which is not a stylistic choice.
 * `perjadin_pic_is_a_group_member` is `DEFERRABLE INITIALLY DEFERRED` precisely
 * because neither row can go first: the Perjadin names its PIC, and the PIC's
 * membership row names the Perjadin. Checked at COMMIT the pair is consistent;
 * checked per statement no valid ordering exists, so two separate inserts fail.
 */
export async function addPerjadin(fixture: PerjadinFixture) {
  return db.transaction(async (tx) => {
    const [perjadin] = await tx
      .insert(schema.perjadin)
      .values({
        destination: fixture.destination ?? "Bandung",
        startsOn: fixture.startsOn ?? "2026-09-01",
        endsOn: fixture.endsOn ?? "2026-09-03",
        advanceIdr: fixture.advanceIdr,
        picPersonId: fixture.picPersonId,
        picRole: "Staff",
      })
      .returning();

    await tx.insert(schema.groupMember).values([
      { perjadinId: perjadin!.id, personId: fixture.picPersonId, role: "Staff", stream: null },
      ...(fixture.teachers ?? []).map((teacher) => ({
        perjadinId: perjadin!.id,
        personId: teacher.personId,
        role: "Teaching Team",
        stream: teacher.stream,
      })),
    ]);

    return perjadin!;
  });
}

export type TransactionFixture = {
  perjadinId: string;
  amountIdr: number;
  description?: string;
  spentOn?: string;
  createdByPersonId: string;
};

/** One line item against the Advance. A transaction is not attributed to a person. */
export async function addTransaction(fixture: TransactionFixture) {
  const [transaction] = await db
    .insert(schema.transaction)
    .values({
      perjadinId: fixture.perjadinId,
      spentOn: fixture.spentOn ?? "2026-09-02",
      description: fixture.description ?? "Transport lokal",
      amountIdr: fixture.amountIdr,
      createdByPersonId: fixture.createdByPersonId,
    })
    .returning();
  return transaction!;
}

/**
 * Each test starts from a known set of rows and leaves none behind.
 *
 * The list names the **roots** — the tables a fixture writes directly. `cascade`
 * reaches everything hanging off them, which is every evaluation table, the feedback
 * token and `transaction_evidence`, so a new table that references one of these needs
 * no entry here. A new *root* does.
 *
 * `public."session"` and `better_auth."session"` are both here and both qualified.
 * That collision is the whole reason Better Auth was given a Postgres schema of its
 * own — `session` is a teaching occasion at one School.
 */
export async function resetDatabase() {
  await db.execute(sql`
    truncate
      better_auth."user",
      better_auth."session",
      better_auth."account",
      better_auth."verification",
      public."person",
      public."province",
      public."cluster",
      public."school",
      public."session",
      public."perjadin",
      public."group_member",
      public."transaction"
    restart identity cascade
  `);
}
