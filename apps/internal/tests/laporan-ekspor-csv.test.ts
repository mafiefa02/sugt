import type { PerjadinAcquittal } from "@sugt/db/queries";
import { describe, expect, it } from "vitest";

import { csvOf } from "../src/app/(app)/perjadin/[id]/laporan/ekspor/csv";

/**
 * **The acquittal export, tested with no database and no HTTP.**
 *
 * `csvOf` is a total function of the payload, so the export's acceptance — the Pimpinan appear when
 * present and leave no stray row when absent (#142) — is provable here, without standing up the
 * Route Handler or its Staff-only read. Those are the handler's concern and are covered where the
 * choke point is; this pins the text.
 */

/** A minimal acquittal with no transactions and no Pimpinan — each test overrides what it exercises. */
function acquittal(overrides: Partial<PerjadinAcquittal> = {}): PerjadinAcquittal {
  return {
    perjadinId: "00000000-0000-0000-0000-000000000001",
    destination: "Bandung",
    startsOn: "2026-09-01",
    endsOn: "2026-09-03",
    advanceIdr: 5_000_000,
    spentIdr: 0,
    remainderIdr: 5_000_000,
    reportDueOn: "2026-09-05",
    daysRemaining: 3,
    transactions: [],
    receipts: [],
    pimpinan: [],
    returnedToTreasurerIdr: null,
    returnedAt: null,
    reportFiledAt: null,
    ...overrides,
  };
}

describe("the acquittal CSV", () => {
  it("names each Pimpinan on its own labelled row, after the reconciliation", () => {
    // `pimpinan` on the acquittal is a list of Pimpinan names now (#181) — the query orders them, so
    // the payload here is any two names in the order the query would hand back.
    const fatimah = "Fatimah Arofiati Noor";
    const anton = "Anton Timur Jaelani";
    const csv = csvOf(acquittal({ pimpinan: [anton, fatimah] }));

    // One labelled row per name, in the order the payload gave — the query orders them, not this.
    expect(csv).toContain(`"Pimpinan","${anton}","","","",""`);
    expect(csv).toContain(`"Pimpinan","${fatimah}","","","",""`);
    // After the reconciliation, so the file reads money-then-who-travelled.
    expect(csv.indexOf('"Sisa"')).toBeLessThan(csv.indexOf('"Pimpinan"'));
  });

  it("adds no Pimpinan row — and no stray separator — when none joined", () => {
    const csv = csvOf(acquittal({ pimpinan: [] }));

    expect(csv).not.toContain("Pimpinan");
    // The last content row is the reconciliation's "Sisa"; nothing trails it but the record
    // terminator, so an empty Pimpinan list leaves the file exactly as it was before #142.
    expect(csv.trimEnd().endsWith('"Sisa","","","","5000000",""')).toBe(true);
  });
});
