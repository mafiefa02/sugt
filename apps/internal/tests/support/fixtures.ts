import { db, schema } from "@sugt/db";
import type { ClassKind, SessionMode, SessionStatus, Stream, Role } from "@sugt/domain";
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
 * an offline fixture would have to build a whole Perjadin first.
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

export type OfflineSessionFixture = {
  schoolId: string;
  heldOn: string;
  status?: SessionStatus;
  /** The Perjadin the Session happens on. `addPerjadin` builds one. */
  perjadinId: string;
};

/**
 * An **offline** Session, which needs a Perjadin first — the two CHECKs are exact
 * mirrors, so `mode = 'offline'` and a null `perjadin_id` cannot coexist.
 *
 * A sibling of `addSession` rather than an option on it. The two differ in every
 * column that is not the School and the date, and a fixture that took either shape
 * would spend its body deciding which one it was.
 *
 * Keep `heldOn` inside the Perjadin's date range. Nothing enforces that here — the
 * rule is the application's, and `docs/data-model.md` lists it under what the database
 * does not hold — so a fixture outside the range would model a state the app exists to
 * prevent.
 */
export async function addOfflineSession(fixture: OfflineSessionFixture) {
  const status: SessionStatus = fixture.status ?? "arranged";
  const [session] = await db
    .insert(schema.session)
    .values({
      schoolId: fixture.schoolId,
      mode: "offline" satisfies SessionMode,
      heldOn: fixture.heldOn,
      status,
      cancelledReason: status === "cancelled" ? "Sekolah meminta penjadwalan ulang" : null,
      perjadinId: fixture.perjadinId,
    })
    .returning();
  return session!;
}

/**
 * A Rating that is comfortably above `CONCERN_AT_OR_BELOW`, so a fixture reaches the
 * concerns list only where it says so. Every Rating column is NOT NULL, so each of the
 * three record fixtures below fills its whole rubric and takes overrides for the
 * Aspects a test is actually about.
 */
const FINE = 9;

/** Whether a filed record owes an explanation, which is a CHECK on two of the three tables. */
const needsProse = (ratings: number[]) => Math.min(...ratings) <= 7;

const WENT_WRONG = "Proyektor mati sepanjang sesi";

export type ClassRecordFixture = {
  sessionId: string;
  classKind: ClassKind;
  /** Teaching Team. A composite foreign key into `person (id, role)` refuses anyone else. */
  filedByPersonId: string;
  ratings?: Partial<
    Record<
      | "comprehension"
      | "participation"
      | "readiness"
      | "materials"
      | "delivery"
      | "facilities"
      | "timing",
      number
    >
  >;
};

/** What a Teaching Team member says about one Class they taught. Seven Aspects. */
export async function addClassRecord(fixture: ClassRecordFixture) {
  const ratings = {
    comprehension: FINE,
    participation: FINE,
    readiness: FINE,
    materials: FINE,
    delivery: FINE,
    facilities: FINE,
    timing: FINE,
    ...fixture.ratings,
  };
  const [record] = await db
    .insert(schema.classRecord)
    .values({
      sessionId: fixture.sessionId,
      classKind: fixture.classKind,
      filedByPersonId: fixture.filedByPersonId,
      filedByRole: "Teaching Team",
      ...ratings,
      problems: needsProse(Object.values(ratings)) ? WENT_WRONG : null,
    })
    .returning();
  return record!;
}

export type SessionRecordFixture = {
  sessionId: string;
  /** The PIC, who is Staff. The mirror composite foreign key refuses a professor. */
  filedByPersonId: string;
  ratings?: Partial<
    Record<"facilities" | "turnout" | "schoolSupport" | "timing" | "coordination", number>
  >;
};

/** What the PIC says about the visit as a whole. Five Aspects, none about teaching. */
export async function addSessionRecord(fixture: SessionRecordFixture) {
  const ratings = {
    facilities: FINE,
    turnout: FINE,
    schoolSupport: FINE,
    timing: FINE,
    coordination: FINE,
    ...fixture.ratings,
  };
  const [record] = await db
    .insert(schema.sessionRecord)
    .values({
      sessionId: fixture.sessionId,
      filedByPersonId: fixture.filedByPersonId,
      filedByRole: "Staff",
      ...ratings,
      problems: needsProse(Object.values(ratings)) ? WENT_WRONG : null,
    })
    .returning();
  return record!;
}

export type ParticipantFeedbackFixture = {
  sessionId: string;
  classKind: ClassKind;
  name?: string;
  ratings?: Partial<Record<"materials" | "instructor" | "relevance", number>>;
};

/**
 * What one Participant says about the Class they sat in. Three Aspects, no Person and
 * **no elaboration rule** — a Participant owes nothing — which makes this the cheapest
 * way to put a low Rating on a Session.
 */
export async function addParticipantFeedback(fixture: ParticipantFeedbackFixture) {
  const [feedback] = await db
    .insert(schema.participantFeedback)
    .values({
      sessionId: fixture.sessionId,
      classKind: fixture.classKind,
      name: fixture.name ?? "Siti",
      materials: FINE,
      instructor: FINE,
      relevance: FINE,
      ...fixture.ratings,
    })
    .returning();
  return feedback!;
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
 * The list names the tables a fixture writes directly. Several of them are already
 * reachable by `cascade` from another entry — `school` from `cluster`, `transaction`
 * from `perjadin` — and they are named anyway, because a truncate list that reads as
 * "what the tests populate" survives a fixture being deleted, while one pruned to the
 * cascade minimum quietly stops covering a table the day its parent leaves.
 *
 * `cascade` is what reaches everything **no** fixture writes: `perjadin_evaluation`,
 * `session_feedback_token` and `transaction_evidence`. A new table referencing one of
 * these therefore needs no entry; a new table nothing references does. The other three
 * evaluation tables are named below, because fixtures now write them directly.
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
      public."class_record",
      public."session_record",
      public."participant_feedback",
      public."perjadin",
      public."group_member",
      public."transaction"
    restart identity cascade
  `);
}
