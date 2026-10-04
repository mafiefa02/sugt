import {
  finalizeReceiptsAction,
  mintReceiptUploadsAction,
} from "-/app/(app)/perjadin/[id]/laporan/actions";
import { requirePerson } from "-/lib/person";
import { mintReceiptUpload, readReceiptFacts } from "-/lib/receipt-media";
import { MAX_RECEIPTS_PER_TRANSACTION } from "@sugt/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addDriveConnection,
  addPerjadin,
  addPerson,
  addTransaction,
  resetDatabase,
} from "./support/fixtures";

/**
 * **The row's own Unggah bukti, at the seam where it meets Storage** (#355, ADR-0039). Recording a
 * new line goes to Drive since #373 and is tested in `catat-transaksi-drive.test.ts`; the row's
 * upload still writes to the Supabase `receipts` bucket until #374.
 *
 * The queries they call are driven against the real database in `perjadin-report.test.ts`. What
 * only the action layer holds is the order around Storage: the Staff check and the Perjadin read
 * run **before** any service-role read-back, and the mint hands out no more URLs than one line may
 * carry — and, since ADR-0040, both are closed whenever Drive is. So Storage and the signed-in
 * session are stubbed here — the two things a test cannot reach — and the database stays real.
 */

vi.mock("-/lib/person", () => ({ requirePerson: vi.fn() }));
vi.mock("-/lib/receipt-media", () => ({ mintReceiptUpload: vi.fn(), readReceiptFacts: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/**
 * What a non-Staff caller gets back: `staffSurface` turns `NotStaffError` into `forbidden()`, whose
 * error carries this digest — the 403 `forbidden.tsx` renders. `forbidden()` needs Next's auth
 * interrupts switched on, which `next.config` does at build time and the test does below, as
 * `staff-only.test.ts` does.
 */
const FORBIDDEN = "NEXT_HTTP_ERROR_FALLBACK;403";

async function digestOf(call: Promise<unknown>) {
  const thrown = await call.then(
    () => null,
    (error: unknown) => error,
  );
  return (thrown as { digest?: string } | null)?.digest;
}

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

/** A trip, with Drive connected so the receipt controls are open. */
async function aTripWithDrive() {
  const made = await aTrip();
  await addDriveConnection({ connectedByPersonId: made.staff.id });
  return made;
}

beforeEach(async () => {
  await resetDatabase();
  vi.clearAllMocks();
  vi.stubEnv("__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS", "1");
  readBack.mockResolvedValue({ contentType: "image/webp", byteSize: 4096 });
  mint.mockImplementation(async () => ({ path: "key", signedUrl: "https://storage.test/put" }));
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

    await expect(digestOf(finalizeReceiptsAction(trip.id, line.id, [{ path: "a" }]))).resolves.toBe(
      FORBIDDEN,
    );

    expect(readBack).not.toHaveBeenCalled();
  });
});

describe("finalizeReceiptsAction's bound", () => {
  it("refuses more receipts than a line may carry without reading any of them back", async () => {
    const { staff, trip } = await aTripWithDrive();
    const line = await addTransaction({
      perjadinId: trip.id,
      amountIdr: 50_000,
      createdByPersonId: staff.id,
    });
    signedInAs.mockResolvedValue(staff);
    const landed = Array.from({ length: MAX_RECEIPTS_PER_TRANSACTION + 1 }, (_, i) => ({
      path: `k${i}`,
    }));

    await expect(finalizeReceiptsAction(trip.id, line.id, landed)).resolves.toEqual({
      outcome: "too-many-receipts",
      limit: MAX_RECEIPTS_PER_TRANSACTION,
    });
    expect(readBack).not.toHaveBeenCalled();
  });
});

describe("mintReceiptUploadsAction", () => {
  it("mints no more upload URLs than one line may carry", async () => {
    const { staff, trip } = await aTripWithDrive();
    signedInAs.mockResolvedValue(staff);

    const minted = await mintReceiptUploadsAction(trip.id, MAX_RECEIPTS_PER_TRANSACTION + 5);

    expect(minted.outcome === "minted" && minted.targets).toHaveLength(
      MAX_RECEIPTS_PER_TRANSACTION,
    );
  });
});

describe("the row's Unggah bukti while Drive cannot take an upload", () => {
  it.each([
    ["not connected", undefined],
    ["broken", "broken" as const],
  ])("is closed with the reason when Drive is %s", async (_, status) => {
    const { staff, trip } = await aTrip();
    if (status) await addDriveConnection({ connectedByPersonId: staff.id, status });
    const line = await addTransaction({
      perjadinId: trip.id,
      amountIdr: 50_000,
      createdByPersonId: staff.id,
    });
    signedInAs.mockResolvedValue(staff);

    const minted = await mintReceiptUploadsAction(trip.id, 1);
    const finalized = await finalizeReceiptsAction(trip.id, line.id, [{ path: "a" }]);

    for (const result of [minted, finalized]) {
      expect(result).toMatchObject({
        outcome: "uploads-closed",
        reason: expect.stringMatching(status ? /terputus sejak/ : /belum terhubung/),
      });
    }
    expect(mint).not.toHaveBeenCalled();
    expect(readBack).not.toHaveBeenCalled();
  });
});
