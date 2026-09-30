import {
  finalizeReceiptsAction,
  mintReceiptUploadsAction,
  recordTransactionAction,
} from "-/app/(app)/perjadin/[id]/laporan/actions";
import { requirePerson } from "-/lib/person";
import { mintReceiptUpload, readReceiptFacts } from "-/lib/receipt-media";
import { db, schema } from "@sugt/db";
import { MAX_RECEIPTS_PER_TRANSACTION } from "@sugt/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addPerjadin, addPerson, addTransaction, resetDatabase } from "./support/fixtures";

/**
 * **The Perjadin Report's Server Actions, at the seam where they meet Storage** (#355, ADR-0039).
 *
 * The queries they call are driven against the real database in `perjadin-report.test.ts`. What
 * only the action layer holds is the order around Storage: the Staff check and the Perjadin read
 * run **before** any service-role read-back, a read-back that fails refuses the whole record, and
 * the mint hands out no more URLs than one line may carry. So Storage and the signed-in session are
 * stubbed here — the two things a test cannot reach — and the database stays real.
 */

vi.mock("-/lib/person", () => ({ requirePerson: vi.fn() }));
vi.mock("-/lib/receipt-media", () => ({ mintReceiptUpload: vi.fn(), readReceiptFacts: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const signedInAs = vi.mocked(requirePerson);
const readBack = vi.mocked(readReceiptFacts);
const mint = vi.mocked(mintReceiptUpload);

async function aTrip() {
  const staff = await addPerson({
    fullName: "Rina Nurhayati",
    email: "rina@ditsama.itb.ac.id",
    role: "Staff",
  });
  const pimpinan = await addPerson({
    fullName: "Fatimah Azzahra",
    email: "fatimah@ditsama.itb.ac.id",
    role: "Pimpinan",
  });
  const trip = await addPerjadin({ advanceIdr: 5_000_000, picPersonId: staff.id });
  return { staff, pimpinan, trip };
}

function aLine(perjadinId: string, paths: string[]) {
  return {
    perjadinId,
    spentOn: "2026-09-02",
    description: "Taksi bandara",
    amountIdr: 150_000,
    category: "Transport Bandara/Stasiun" as const,
    participantType: "Siswa" as const,
    receipts: paths.map((path) => ({ path })),
  };
}

beforeEach(async () => {
  await resetDatabase();
  vi.clearAllMocks();
  readBack.mockResolvedValue({ contentType: "image/webp", byteSize: 4096 });
  mint.mockImplementation(async () => ({ path: "key", signedUrl: "https://storage.test/put" }));
});

describe("recordTransactionAction", () => {
  it("refuses a non-Staff caller before reading anything back from Storage", async () => {
    const { pimpinan, trip } = await aTrip();
    signedInAs.mockResolvedValue(pimpinan);

    await expect(recordTransactionAction(aLine(trip.id, ["a"]))).rejects.toThrow();

    expect(readBack).not.toHaveBeenCalled();
    await expect(db.select().from(schema.transaction)).resolves.toHaveLength(0);
  });

  it("records the line with what Storage says each receipt is", async () => {
    const { staff, trip } = await aTrip();
    signedInAs.mockResolvedValue(staff);

    const result = await recordTransactionAction(aLine(trip.id, ["a", "b"]));

    expect(result.outcome).toBe("recorded");
    const evidence = await db.select().from(schema.transactionEvidence);
    expect(evidence.map((row) => row.storagePath).sort()).toEqual(["a", "b"]);
    expect(evidence.every((row) => row.contentType === "image/webp")).toBe(true);
  });

  it("records nothing when any receipt did not land", async () => {
    const { staff, trip } = await aTrip();
    signedInAs.mockResolvedValue(staff);
    readBack.mockImplementation(async (path) =>
      path === "lost" ? null : { contentType: "image/jpeg", byteSize: 10 },
    );

    await expect(recordTransactionAction(aLine(trip.id, ["a", "lost"]))).resolves.toEqual({
      outcome: "receipts-not-landed",
      failed: 1,
    });
    await expect(db.select().from(schema.transaction)).resolves.toHaveLength(0);
    await expect(db.select().from(schema.transactionEvidence)).resolves.toHaveLength(0);
  });

  it("refuses more receipts than a line may carry without reading any of them back", async () => {
    const { staff, trip } = await aTrip();
    signedInAs.mockResolvedValue(staff);
    const paths = Array.from({ length: MAX_RECEIPTS_PER_TRANSACTION + 1 }, (_, i) => `k${i}`);

    await expect(recordTransactionAction(aLine(trip.id, paths))).resolves.toEqual({
      outcome: "too-many-receipts",
      limit: MAX_RECEIPTS_PER_TRANSACTION,
      count: MAX_RECEIPTS_PER_TRANSACTION + 1,
    });
    expect(readBack).not.toHaveBeenCalled();
    await expect(db.select().from(schema.transaction)).resolves.toHaveLength(0);
  });

  it("passes the query's refusal of a line with no receipt through", async () => {
    const { staff, trip } = await aTrip();
    signedInAs.mockResolvedValue(staff);

    await expect(recordTransactionAction(aLine(trip.id, []))).resolves.toEqual({
      outcome: "evidence-missing",
    });
  });
});

describe("finalizeReceiptsAction", () => {
  it("refuses a non-Staff caller before reading anything back from Storage", async () => {
    const { staff, pimpinan, trip } = await aTrip();
    const line = await addTransaction({
      perjadinId: trip.id,
      amountIdr: 50_000,
      createdByPersonId: staff.id,
    });
    signedInAs.mockResolvedValue(pimpinan);

    await expect(finalizeReceiptsAction(trip.id, line.id, [{ path: "a" }])).rejects.toThrow();

    expect(readBack).not.toHaveBeenCalled();
  });
});

describe("mintReceiptUploadsAction", () => {
  it("mints no more upload URLs than one line may carry", async () => {
    const { staff, trip } = await aTrip();
    signedInAs.mockResolvedValue(staff);

    const targets = await mintReceiptUploadsAction(trip.id, MAX_RECEIPTS_PER_TRANSACTION + 5);

    expect(targets).toHaveLength(MAX_RECEIPTS_PER_TRANSACTION);
  });
});
