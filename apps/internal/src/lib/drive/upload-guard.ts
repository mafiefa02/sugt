import type { DriveRefusal } from "-/app/(app)/perjadin/[id]/laporan/action-types";
import type { Person } from "-/lib/person";
import { staffSurface } from "-/lib/staff-surface";
import { perjadinAcquittal, requireStaff } from "@sugt/db/queries";

import type { driveAccessToken } from "./access-token";
import { uploadGate } from "./upload-gate";
import { DRIVE_FOLDERS_UNRESOLVED, DRIVE_NOT_CONNECTED } from "./upload-messages";

/**
 * **The two guards every upload to Drive shares** (ADR-0040, ADR-0042) — receipts and Perjadin
 * Documents alike — kept here so the two sets of Server Actions cannot drift apart.
 */

/**
 * **The guard every upload write runs before it touches Drive**: an explicit `requireStaff`, then a
 * read of the Perjadin. Returns whether the Perjadin exists.
 *
 * The order is load-bearing. An upload session is a write credential on the company Drive, and the
 * verify reads files with the company's own token; doing either first would give a non-Staff caller
 * an upload URL, or tell them whether a file exists and how big it is. The `requireStaff` is what
 * closes this: `perjadinAcquittal` is an open money read since #180 (ADR-0026), so the read alone
 * no longer refuses a Pimpinan.
 */
export async function staffOnTrip(person: Person, perjadinId: string): Promise<boolean> {
  const acquittal = await staffSurface(() => {
    requireStaff(person);
    return perjadinAcquittal(person, perjadinId);
  });
  return acquittal !== null;
}

/**
 * Why `driveAccessToken` said no, as an action answers it: with the gate's own sentence for the two
 * states the page also closes on, so the dialog says exactly what a fresh page would have.
 */
export async function driveRefusal(
  person: Person,
  outcome: Exclude<Awaited<ReturnType<typeof driveAccessToken>>["outcome"], "ok">,
): Promise<DriveRefusal> {
  if (outcome === "drive-unreachable") return { outcome };
  const gate = await uploadGate(person);
  const fallback =
    outcome === "drive-disconnected" ? DRIVE_NOT_CONNECTED : DRIVE_FOLDERS_UNRESOLVED;
  return { outcome, reason: gate.open ? fallback : gate.reason };
}
