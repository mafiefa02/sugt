import { db, schema } from "@sugt/db";
import {
  attachTransactionEvidence,
  filePerjadinReport,
  isNotStaffError,
  markReceiptsSettled,
  perjadinAcquittal,
  recordTransaction,
} from "@sugt/db/queries";
import { PIMPINAN, REPORT_DEADLINE_DAYS_AFTER_RETURN, TRANSACTION_CATEGORIES } from "@sugt/domain";
import type { Role } from "@sugt/domain";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addPerjadin,
  addPerson,
  addTransaction,
  addTransactionEvidence,
  refusedBy,
  resetDatabase,
} from "./support/fixtures";

/**
 * **The Perjadin Report** — the acquittal of one trip.
 *
 * The invariants under test are the ones no column holds: the reconciliation is derived
 * rather than typed, the evidence rule is checked when the Report is filed rather than when
 * a transaction is entered, the receipts checklist is an explicit mark rather than a count
 * of transactions, and every entry point refuses a non-Staff caller.
 *
 * `staff-only.test.ts` covers the choke point itself at the sign-in seam. This file drives
 * the same guard on the four surfaces #30 added, and asserts on rows.
 */

async function pic(email = "rina@ditsama.itb.ac.id") {
  return addPerson({ fullName: "Rina Nurhayati", email, role: "Staff" });
}

/**
 * A non-Staff caller, hand-built rather than invited. T3 (#153) retired the Teaching Team Role, so
 * no such Person can exist in the database any more — but the Staff-only choke point still has to
 * reject a non-Staff caller, and `requireStaff` throws on the role alone, before it touches the
 * row. The cast through `unknown` is the only way to name a role the type no longer admits.
 */
function nonStaff() {
  return {
    id: "00000000-0000-0000-0000-000000000009",
    fullName: "Budi Santoso",
    email: "budi@gmail.com",
    role: "Teaching Team" as unknown as Role,
  };
}

// Calendar-day arithmetic on the `YYYY-MM-DD` strings the `date` columns hold, at UTC midnight
// so the shift itself never crosses a boundary — the same helper `perjadin-detail.ts` keeps.
const MS_PER_DAY = 86_400_000;

function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Today's date in the zone the deadline is counted in.
 *
 * Read from `Intl` rather than from the machine's local clock: a test that took the runner's
 * zone would agree with the query only on a machine that happens to sit in Jakarta, which is
 * both of the machines this has ever run on and neither of the ones it needs to keep working
 * on.
 */
function jakartaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

/**
 * A trip with an Advance and its PIC. T3 (#153) made the Group Staff-only and Stream-less, so the
 * Group is now the PIC alone — no Teaching Team member rides on it any more.
 */
async function aTrip(advanceIdr = 5_000_000) {
  const staff = await pic();
  const trip = await addPerjadin({ advanceIdr, picPersonId: staff.id });
  return { staff, trip };
}

describe("the acquittal payload", () => {
  beforeEach(resetDatabase);

  it("derives the remainder from the Advance and the line items, and never stores it", async () => {
    const { staff, trip } = await aTrip(5_000_000);
    await addTransaction({
      perjadinId: trip.id,
      amountIdr: 1_250_000,
      createdByPersonId: staff.id,
    });
    await addTransaction({ perjadinId: trip.id, amountIdr: 400_000, createdByPersonId: staff.id });

    const acquittal = await perjadinAcquittal(staff, trip.id);

    expect(acquittal).toMatchObject({
      advanceIdr: 5_000_000,
      spentIdr: 1_650_000,
      remainderIdr: 3_350_000,
    });
    // The proof that it is derived: no column holds it. `perjadin` has the Advance and the
    // returned figure, and nothing between them.
    expect(Object.keys(schema.perjadin)).not.toContain("remainderIdr");
  });

  it("reads a trip that spent nothing as zero rather than as unknown", async () => {
    const { staff, trip } = await aTrip(2_000_000);

    await expect(perjadinAcquittal(staff, trip.id)).resolves.toMatchObject({
      spentIdr: 0,
      remainderIdr: 2_000_000,
      transactions: [],
    });
  });

  it("derives the deadline from the trip's end date", async () => {
    /**
     * It follows from `ends_on` plus the constant, so the assertion computes the same way
     * rather than hard-coding a date — a hard-coded one would only be testing the clock.
     */
    const staff = await pic();
    const endsOn = "2026-09-03";
    const trip = await addPerjadin({
      advanceIdr: 1_000_000,
      picPersonId: staff.id,
      startsOn: "2026-09-01",
      endsOn,
    });

    const acquittal = await perjadinAcquittal(staff, trip.id);

    expect(acquittal?.reportDueOn).toBe(shiftDate(endsOn, REPORT_DEADLINE_DAYS_AFTER_RETURN));
  });

  it("counts the days left in Jakarta's calendar, and past the deadline as negative", async () => {
    /**
     * The arithmetic, driven at four offsets rather than asserted to be a number.
     *
     * "Today" is a zone, and the query names `Asia/Jakarta` rather than inheriting whatever the
     * database session defaults to. So the expectation is computed in that zone too — reading
     * the machine's own clock here would make this test pass or fail by where it runs, which is
     * the exact bug the named zone exists to prevent.
     */
    const staff = await pic();
    const today = jakartaToday();

    for (const offset of [5, 0, -2, -10]) {
      const endsOn = shiftDate(today, offset - REPORT_DEADLINE_DAYS_AFTER_RETURN);
      const trip = await addPerjadin({
        advanceIdr: 1_000_000,
        picPersonId: staff.id,
        startsOn: shiftDate(endsOn, -2),
        endsOn,
      });

      const acquittal = await perjadinAcquittal(staff, trip.id);
      expect(acquittal?.daysRemaining).toBe(offset);
    }
  });

  it("carries each line item's evidence without multiplying the money", async () => {
    /**
     * The bug this shape exists to prevent: joining evidence onto transactions and summing
     * the result counts a line item once per receipt. Two receipts on one transaction must
     * still spend its amount once.
     */
    const { staff, trip } = await aTrip(5_000_000);
    const line = await addTransaction({
      perjadinId: trip.id,
      amountIdr: 900_000,
      createdByPersonId: staff.id,
    });
    await addTransactionEvidence({ transactionId: line.id, uploadedByPersonId: staff.id });
    await addTransactionEvidence({ transactionId: line.id, uploadedByPersonId: staff.id });

    const acquittal = await perjadinAcquittal(staff, trip.id);

    expect(acquittal?.spentIdr).toBe(900_000);
    expect(acquittal?.transactions).toHaveLength(1);
    expect(acquittal?.transactions[0]?.evidence).toHaveLength(2);
  });

  it("names who incurred a line item, and leaves it null where nobody did", async () => {
    // `incurred_by_person_id` is a foreign key into `person` — nothing more — so whoever ran up
    // the cost need only be a Person, not a Group member. T3 (#153) retired the Teaching Team, so
    // the traveller here is Staff; the column's claim is the same either way.
    const { staff, trip } = await aTrip();
    const traveller = await addPerson({
      fullName: "Budi Santoso",
      email: "budi@gmail.com",
      role: "Staff",
    });
    await addTransaction({
      perjadinId: trip.id,
      amountIdr: 600_000,
      description: "Uang harian",
      spentOn: "2026-09-01",
      category: "Uang Harian",
      incurredByPersonId: traveller.id,
      createdByPersonId: staff.id,
    });
    await addTransaction({
      perjadinId: trip.id,
      amountIdr: 75_000,
      spentOn: "2026-09-02",
      createdByPersonId: staff.id,
    });

    const acquittal = await perjadinAcquittal(staff, trip.id);

    expect(acquittal?.transactions[0]?.incurredBy).toEqual({
      personId: traveller.id,
      fullName: "Budi Santoso",
    });
    expect(acquittal?.transactions[1]?.incurredBy).toBeNull();
  });

  it("lists every Group member on the receipts checklist, settled or not", async () => {
    // The Group is the PIC alone now (T3 (#153) made `group_member` Staff-only and Stream-less),
    // so the checklist is the one member.
    const { staff, trip } = await aTrip();

    const acquittal = await perjadinAcquittal(staff, trip.id);

    expect(acquittal?.receipts).toHaveLength(1);
    expect(acquittal?.receipts.map((member) => member.personId)).toEqual([staff.id]);
    expect(acquittal?.receipts.every((member) => member.settledAt === null)).toBe(true);
  });

  it("tells a missing Perjadin apart from a refusal", async () => {
    const staff = await pic();

    await expect(
      perjadinAcquittal(staff, "00000000-0000-0000-0000-000000000000"),
    ).resolves.toBeNull();
  });

  it("names the Pimpinan who joined the trip, ordered, and reads none as an empty list", async () => {
    /**
     * The Laporan names who travelled (#142). A Pimpinan is record-only — just a name from the
     * fixed three — so the acquittal carries the names and nothing more, ordered so the screen
     * and its CSV read the same on every load.
     */
    const staff = await pic();
    const [fatimah, , anton] = PIMPINAN;
    const trip = await addPerjadin({
      advanceIdr: 1_000_000,
      picPersonId: staff.id,
      pimpinan: [fatimah, anton],
    });

    const acquittal = await perjadinAcquittal(staff, trip.id);
    expect(acquittal?.pimpinan).toEqual([fatimah, anton].sort());

    const noneTrip = await addPerjadin({ advanceIdr: 1_000_000, picPersonId: staff.id });
    const none = await perjadinAcquittal(staff, noneTrip.id);
    expect(none?.pimpinan).toEqual([]);
  });
});

describe("the category", () => {
  beforeEach(resetDatabase);

  it("accepts every value @sugt/domain declares", async () => {
    /**
     * The CHECK is written out character for character in `travel.ts` rather than composed
     * from `TRANSACTION_CATEGORIES`, so the two can drift silently. This drives every value
     * through the real constraint, which is the only thing that catches a typo in either.
     */
    const { staff, trip } = await aTrip(500_000_000);

    for (const category of TRANSACTION_CATEGORIES) {
      const result = await recordTransaction(staff, {
        perjadinId: trip.id,
        spentOn: "2026-09-02",
        description: category,
        amountIdr: 10_000,
        category,
        incurredByPersonId: null,
      });
      expect(result.outcome).toBe("recorded");
    }

    const rows = await db
      .select({ category: schema.transaction.category })
      .from(schema.transaction)
      .where(eq(schema.transaction.perjadinId, trip.id));
    expect(rows.map((row) => row.category).sort()).toEqual([...TRANSACTION_CATEGORIES].sort());
  });

  it("holds exactly the twelve, with the constraint read back rather than inferred", async () => {
    /**
     * The loop above catches drift in one direction only — a value the domain gains and the
     * CHECK lacks fails on insert. This catches the other: a value the CHECK still names after
     * the domain drops it would never be inserted, so no insert could notice. Reading the
     * constraint's own text out of Postgres is what closes it.
     *
     * `pg_get_constraintdef` returns the whole `CHECK (...)` expression, so the assertion is on
     * which quoted literals appear in it rather than on its exact formatting — Postgres
     * normalises that and pinning it would test the server's printer.
     */
    const [row] = await db.execute<{ definition: string }>(sql`
      select pg_get_constraintdef(oid) as definition
      from pg_constraint
      where conname = 'transaction_category_check'
    `);

    const named = [...(row?.definition ?? "").matchAll(/'((?:[^']|'')*)'/g)].map((match) =>
      match[1]!.replaceAll("''", "'"),
    );
    expect([...new Set(named)].sort()).toEqual([...TRANSACTION_CATEGORIES].sort());
  });

  it("refuses a value outside the closed set, at the database", async () => {
    const { staff, trip } = await aTrip();

    const refusal = await refusedBy(
      db.insert(schema.transaction).values({
        perjadinId: trip.id,
        spentOn: "2026-09-02",
        description: "Parkir",
        amountIdr: 10_000,
        // The cast is the point: this is what a caller bypassing the type would send, and
        // the database is what has to refuse it.
        category: "Parkir" as (typeof TRANSACTION_CATEGORIES)[number],
        createdByPersonId: staff.id,
      }),
    );

    expect(refusal).toBe("transaction_category_check");
  });
});

describe("recording a line item", () => {
  beforeEach(resetDatabase);

  it("refuses a non-Staff caller with a distinguishable typed error", async () => {
    const { trip } = await aTrip();

    const refusal = await recordTransaction(nonStaff(), {
      perjadinId: trip.id,
      spentOn: "2026-09-02",
      description: "Taksi",
      amountIdr: 50_000,
      category: "Transport Lokal Dalam Provinsi",
      incurredByPersonId: null,
    }).catch((error: unknown) => error);

    expect(isNotStaffError(refusal)).toBe(true);
  });

  it("names somebody who did not travel, because an honorarium is paid to exactly that", async () => {
    /**
     * The tempting rule — only a Group member can have incurred a cost on this trip — is false
     * against the category list it would police. `Honorarium Narasumber` pays a speaker, who is
     * a Person the Programme knows and is on no Group. The foreign key into `person` is the
     * whole of what this column claims — so the speaker is just a Person, Staff now that T3 (#153)
     * retired the Teaching Team Role, and on no Group regardless.
     */
    const { staff, trip } = await aTrip();
    const speaker = await addPerson({
      fullName: "Sari Wulandari",
      email: "sari@gmail.com",
      role: "Staff",
    });

    const result = await recordTransaction(staff, {
      perjadinId: trip.id,
      spentOn: "2026-09-02",
      description: "Honorarium narasumber",
      amountIdr: 600_000,
      category: "Honorarium Narasumber",
      incurredByPersonId: speaker.id,
    });

    expect(result.outcome).toBe("recorded");
    const acquittal = await perjadinAcquittal(staff, trip.id);
    expect(acquittal?.transactions[0]?.incurredBy).toEqual({
      personId: speaker.id,
      fullName: "Sari Wulandari",
    });
  });

  it("comes back as a value on a stale Perjadin link and on a non-positive amount", async () => {
    const { staff, trip } = await aTrip();

    await expect(
      recordTransaction(staff, {
        perjadinId: "00000000-0000-0000-0000-000000000000",
        spentOn: "2026-09-02",
        description: "Taksi",
        amountIdr: 50_000,
        category: "Transport Lokal Dalam Provinsi",
        incurredByPersonId: null,
      }),
    ).resolves.toEqual({ outcome: "no-such-perjadin" });

    await expect(
      recordTransaction(staff, {
        perjadinId: trip.id,
        spentOn: "2026-09-02",
        description: "Taksi",
        amountIdr: 0,
        category: "Transport Lokal Dalam Provinsi",
        incurredByPersonId: null,
      }),
    ).resolves.toEqual({ outcome: "amount-not-positive" });
  });
});

describe("attaching evidence", () => {
  beforeEach(resetDatabase);

  it("refuses a non-Staff caller", async () => {
    const { staff, trip } = await aTrip();
    const line = await addTransaction({
      perjadinId: trip.id,
      amountIdr: 50_000,
      createdByPersonId: staff.id,
    });

    const refusal = await attachTransactionEvidence(nonStaff(), trip.id, line.id, [
      { storagePath: "a", contentType: "image/jpeg", byteSize: 10 },
    ]).catch((error: unknown) => error);

    expect(isNotStaffError(refusal)).toBe(true);
  });

  it("refuses a line item belonging to another trip", async () => {
    /**
     * A Server Action is a public endpoint, so the transaction is named with its Perjadin
     * and the pair is checked rather than assumed from whatever screen sent it.
     */
    const { staff, trip } = await aTrip();
    const otherStaff = await addPerson({
      fullName: "Andi Pratama",
      email: "andi@ditsama.itb.ac.id",
      role: "Staff",
    });
    const otherTrip = await addPerjadin({ advanceIdr: 1_000_000, picPersonId: otherStaff.id });
    const line = await addTransaction({
      perjadinId: otherTrip.id,
      amountIdr: 50_000,
      createdByPersonId: otherStaff.id,
    });

    await expect(
      attachTransactionEvidence(staff, trip.id, line.id, [
        { storagePath: "forged", contentType: "image/jpeg", byteSize: 10 },
      ]),
    ).resolves.toEqual({ outcome: "no-such-transaction" });
    await expect(db.select().from(schema.transactionEvidence)).resolves.toHaveLength(0);
  });

  it("records what Storage said the file was", async () => {
    const { staff, trip } = await aTrip();
    const line = await addTransaction({
      perjadinId: trip.id,
      amountIdr: 50_000,
      createdByPersonId: staff.id,
    });

    const result = await attachTransactionEvidence(staff, trip.id, line.id, [
      {
        storagePath: "9f2c1e00-0000-4000-8000-000000000001",
        contentType: "image/webp",
        byteSize: 4096,
      },
    ]);

    expect(result).toEqual({ outcome: "attached", count: 1 });
    const [row] = await db.select().from(schema.transactionEvidence);
    expect(row).toMatchObject({
      contentType: "image/webp",
      byteSize: 4096,
      uploadedByPersonId: staff.id,
    });
  });

  it("refuses to attach one uploaded object twice", async () => {
    const { staff, trip } = await aTrip();
    const line = await addTransaction({
      perjadinId: trip.id,
      amountIdr: 50_000,
      createdByPersonId: staff.id,
    });
    const file = { storagePath: "one-object", contentType: "image/jpeg", byteSize: 10 };

    await attachTransactionEvidence(staff, trip.id, line.id, [file]);
    const refusal = await refusedBy(attachTransactionEvidence(staff, trip.id, line.id, [file]));

    expect(refusal).toBe("transaction_evidence_storage_path_unique");
  });
});

describe("the receipts checklist", () => {
  beforeEach(resetDatabase);

  it("is an explicit mark and not a count of transactions", async () => {
    /**
     * The member below has no transactions at all. Deriving the checklist would read that as
     * settled, when it is ambiguous between *spent nothing* and *has not handed anything
     * over yet* — which is the whole reason the column exists. The Group is the PIC alone now
     * (T3 (#153)), so the PIC is the member with nothing against them.
     */
    const { staff, trip } = await aTrip();

    const before = await perjadinAcquittal(staff, trip.id);
    expect(before?.receipts.find((m) => m.personId === staff.id)?.settledAt).toBeNull();

    const marked = await markReceiptsSettled(staff, trip.id, staff.id, true);
    expect(marked.outcome).toBe("marked");

    const after = await perjadinAcquittal(staff, trip.id);
    expect(after?.receipts.find((m) => m.personId === staff.id)?.settledAt).toBeInstanceOf(Date);
  });

  it("unticks by clearing the mark rather than storing a second event", async () => {
    const { staff, trip } = await aTrip();

    await markReceiptsSettled(staff, trip.id, staff.id, true);
    await expect(markReceiptsSettled(staff, trip.id, staff.id, false)).resolves.toEqual({
      outcome: "marked",
      settledAt: null,
    });
  });

  it("refuses a non-Staff caller, and reports somebody off the Group as a value", async () => {
    const { staff, trip } = await aTrip();
    const outsider = await addPerson({
      fullName: "Sari Wulandari",
      email: "sari@gmail.com",
      role: "Staff",
    });

    const refusal = await markReceiptsSettled(nonStaff(), trip.id, staff.id, true).catch(
      (error: unknown) => error,
    );
    expect(isNotStaffError(refusal)).toBe(true);

    await expect(markReceiptsSettled(staff, trip.id, outsider.id, true)).resolves.toEqual({
      outcome: "no-such-member",
    });
  });
});

describe("filing the Report", () => {
  beforeEach(resetDatabase);

  it("checks the evidence rule when the Report is filed, not when a transaction is entered", async () => {
    /**
     * A receipt may be attached later — `product.md` is explicit — so entering a line item
     * with nothing against it must succeed, and filing with it must not.
     */
    const { staff, trip } = await aTrip();

    const recorded = await recordTransaction(staff, {
      perjadinId: trip.id,
      spentOn: "2026-09-02",
      description: "Taksi bandara",
      amountIdr: 150_000,
      category: "Transport Bandara/Stasiun",
      incurredByPersonId: null,
    });
    expect(recorded.outcome).toBe("recorded");

    const refused = await filePerjadinReport(staff, trip.id);
    expect(refused).toEqual({
      outcome: "evidence-missing",
      transactionIds: [(recorded as { transactionId: string }).transactionId],
    });

    const [row] = await db
      .select({ filedAt: schema.perjadin.reportFiledAt })
      .from(schema.perjadin)
      .where(eq(schema.perjadin.id, trip.id));
    expect(row?.filedAt).toBeNull();
  });

  it("files once every line item carries a receipt", async () => {
    const { staff, trip } = await aTrip();
    const line = await addTransaction({
      perjadinId: trip.id,
      amountIdr: 150_000,
      createdByPersonId: staff.id,
    });
    await addTransactionEvidence({ transactionId: line.id, uploadedByPersonId: staff.id });

    const filed = await filePerjadinReport(staff, trip.id);

    expect(filed.outcome).toBe("filed");
    const acquittal = await perjadinAcquittal(staff, trip.id);
    expect(acquittal?.reportFiledAt).toBeInstanceOf(Date);
  });

  it("files a trip that spent nothing", async () => {
    /** A vacuous truth is the right answer, not an edge case to refuse. */
    const { staff, trip } = await aTrip();

    await expect(filePerjadinReport(staff, trip.id)).resolves.toMatchObject({ outcome: "filed" });
  });

  it("refuses to re-file, so the timestamp keeps meaning when it happened", async () => {
    const { staff, trip } = await aTrip();
    const first = await filePerjadinReport(staff, trip.id);

    await expect(filePerjadinReport(staff, trip.id)).resolves.toEqual({
      outcome: "already-filed",
      filedAt: (first as { filedAt: Date }).filedAt,
    });
  });

  it("refuses a non-Staff caller, and a stale link as a value", async () => {
    const { staff, trip } = await aTrip();

    const refusal = await filePerjadinReport(nonStaff(), trip.id).catch((error: unknown) => error);
    expect(isNotStaffError(refusal)).toBe(true);

    await expect(
      filePerjadinReport(staff, "00000000-0000-0000-0000-000000000000"),
    ).resolves.toEqual({ outcome: "no-such-perjadin" });
  });
});
