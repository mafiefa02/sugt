import { db, schema } from "@sugt/db";
import {
  attachTransactionEvidence,
  filePerjadinReport,
  isNotStaffError,
  markReceiptsSettled,
  perjadinAcquittal,
  recordTransaction,
} from "@sugt/db/queries";
import { REPORT_DEADLINE_DAYS_AFTER_RETURN, TRANSACTION_CATEGORIES } from "@sugt/domain";
import { eq } from "drizzle-orm";
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
 * of transactions, and every entry point refuses a Teaching Team `Person`.
 *
 * `staff-only.test.ts` covers the choke point itself at the sign-in seam. This file drives
 * the same guard on the four surfaces #30 added, and asserts on rows.
 */

async function pic(email = "rina@ditsama.itb.ac.id") {
  return addPerson({ fullName: "Rina Nurhayati", email, role: "Staff" });
}

async function professor(email = "budi@gmail.com") {
  return addPerson({ fullName: "Budi Santoso", email, role: "Teaching Team" });
}

/** A trip with an Advance, its PIC, and one professor on the Group. */
async function aTrip(advanceIdr = 5_000_000) {
  const staff = await pic();
  const teacher = await professor();
  const trip = await addPerjadin({
    advanceIdr,
    picPersonId: staff.id,
    teachers: [{ personId: teacher.id, stream: "STEM" }],
  });
  return { staff, teacher, trip };
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

  it("derives the deadline and the days left from the trip's end date", async () => {
    /**
     * Both follow from `ends_on` plus the constant, so the assertion computes the same way
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

    const due = new Date(Date.parse(`${endsOn}T00:00:00Z`));
    due.setUTCDate(due.getUTCDate() + REPORT_DEADLINE_DAYS_AFTER_RETURN);
    expect(acquittal?.reportDueOn).toBe(due.toISOString().slice(0, 10));
    expect(typeof acquittal?.daysRemaining).toBe("number");
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
    const { staff, teacher, trip } = await aTrip();
    await addTransaction({
      perjadinId: trip.id,
      amountIdr: 600_000,
      description: "Uang harian",
      spentOn: "2026-09-01",
      category: "Uang Harian",
      incurredByPersonId: teacher.id,
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
      personId: teacher.id,
      fullName: "Budi Santoso",
    });
    expect(acquittal?.transactions[1]?.incurredBy).toBeNull();
  });

  it("lists every Group member on the receipts checklist, settled or not", async () => {
    const { staff, teacher, trip } = await aTrip();

    const acquittal = await perjadinAcquittal(staff, trip.id);

    expect(acquittal?.receipts).toHaveLength(2);
    expect(acquittal?.receipts.map((member) => member.personId).sort()).toEqual(
      [staff.id, teacher.id].sort(),
    );
    expect(acquittal?.receipts.every((member) => member.settledAt === null)).toBe(true);
  });

  it("tells a missing Perjadin apart from a refusal", async () => {
    const staff = await pic();

    await expect(
      perjadinAcquittal(staff, "00000000-0000-0000-0000-000000000000"),
    ).resolves.toBeNull();
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

  it("refuses a Teaching Team Person with a distinguishable typed error", async () => {
    const { teacher, trip } = await aTrip();

    const refusal = await recordTransaction(teacher, {
      perjadinId: trip.id,
      spentOn: "2026-09-02",
      description: "Taksi",
      amountIdr: 50_000,
      category: "Transport Lokal Dalam Provinsi",
      incurredByPersonId: null,
    }).catch((error: unknown) => error);

    expect(isNotStaffError(refusal)).toBe(true);
  });

  it("refuses somebody who did not travel as the person who incurred it", async () => {
    const { staff, trip } = await aTrip();
    const outsider = await addPerson({
      fullName: "Sari Wulandari",
      email: "sari@gmail.com",
      role: "Teaching Team",
    });

    const result = await recordTransaction(staff, {
      perjadinId: trip.id,
      spentOn: "2026-09-02",
      description: "Uang harian",
      amountIdr: 600_000,
      category: "Uang Harian",
      incurredByPersonId: outsider.id,
    });

    expect(result).toEqual({ outcome: "incurred-by-not-in-group" });
    await expect(db.select().from(schema.transaction)).resolves.toHaveLength(0);
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

  it("refuses a Teaching Team Person", async () => {
    const { staff, teacher, trip } = await aTrip();
    const line = await addTransaction({
      perjadinId: trip.id,
      amountIdr: 50_000,
      createdByPersonId: staff.id,
    });

    const refusal = await attachTransactionEvidence(teacher, trip.id, line.id, [
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
     * over yet* — which is the whole reason the column exists.
     */
    const { staff, teacher, trip } = await aTrip();

    const before = await perjadinAcquittal(staff, trip.id);
    expect(before?.receipts.find((m) => m.personId === teacher.id)?.settledAt).toBeNull();

    const marked = await markReceiptsSettled(staff, trip.id, teacher.id, true);
    expect(marked.outcome).toBe("marked");

    const after = await perjadinAcquittal(staff, trip.id);
    expect(after?.receipts.find((m) => m.personId === teacher.id)?.settledAt).toBeInstanceOf(Date);
  });

  it("unticks by clearing the mark rather than storing a second event", async () => {
    const { staff, teacher, trip } = await aTrip();

    await markReceiptsSettled(staff, trip.id, teacher.id, true);
    await expect(markReceiptsSettled(staff, trip.id, teacher.id, false)).resolves.toEqual({
      outcome: "marked",
      settledAt: null,
    });
  });

  it("refuses a Teaching Team Person, and reports somebody off the Group as a value", async () => {
    const { staff, teacher, trip } = await aTrip();
    const outsider = await addPerson({
      fullName: "Sari Wulandari",
      email: "sari@gmail.com",
      role: "Teaching Team",
    });

    const refusal = await markReceiptsSettled(teacher, trip.id, teacher.id, true).catch(
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

  it("refuses a Teaching Team Person, and a stale link as a value", async () => {
    const { staff, teacher, trip } = await aTrip();

    const refusal = await filePerjadinReport(teacher, trip.id).catch((error: unknown) => error);
    expect(isNotStaffError(refusal)).toBe(true);

    await expect(
      filePerjadinReport(staff, "00000000-0000-0000-0000-000000000000"),
    ).resolves.toEqual({ outcome: "no-such-perjadin" });
  });
});
