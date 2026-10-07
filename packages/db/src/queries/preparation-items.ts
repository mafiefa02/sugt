import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "../client";
import { cluster, subCluster } from "../schema/reference";
import {
  perjadin,
  preparationItem,
  preparationItemHide,
  preparationItemWording,
} from "../schema/travel";
import type { Person } from "./caller";
import { todayInDeadlineZone } from "./deadline";
import { requireGrant } from "./staff-only";

/**
 * **Defining the Preparation Checklist's items** (ADR-0045): adding, removing, hiding, showing again
 * and rewording an item at its level. Pengaturan Perjadin (#422) is the screen over these; the rules
 * live here, so the screen cannot break them.
 *
 * **Every write is an Administrator's** (`requireGrant`), and none is written to the Activity Log.
 *
 * **What a change reaches is decided by its date, not by rewriting anything.** Adding, removing,
 * hiding or showing an item for every Perjadin or for a Cluster stamps the WIB day of the change
 * (`todayInDeadlineZone`), and `./preparation-checklist.ts` applies it only to the Perjadins that end
 * on or after that day — so a finished Perjadin's list never changes under it. A change for one
 * Perjadin is undated and always applies. A wording is undated everywhere.
 *
 * **The system item** — the one whose tick a Teaching-Team change clears — may be reworded but never
 * removed or hidden, at any level. That refusal is here, not only on the screen.
 */

/** Where an item is defined. */
export type PreparationScope =
  | { level: "semua" }
  | { level: "cluster"; clusterId: string }
  | { level: "perjadin"; perjadinId: string };

/** Where a wider item is hidden or reworded: one Cluster, or one Perjadin. */
export type PreparationOverrideScope = { clusterId: string } | { perjadinId: string };

/** The refusals more than one write shares. */
type ItemRefusal =
  /** No item has that id. */
  | { outcome: "no-such-item" }
  /** The Cluster or Perjadin named does not exist. */
  | { outcome: "no-such-scope" };

export type AddPreparationItemResult =
  | { outcome: "added"; itemId: string }
  | { outcome: "label-required" }
  | { outcome: "no-such-scope" };

/**
 * Add an item at the end of its level's list. A `semua` or `cluster` item is dated today, so it
 * reaches only the Perjadins ending today or later; a `perjadin` item is undated.
 */
export async function addPreparationItem(
  caller: Person,
  input: { scope: PreparationScope; label: string },
): Promise<AddPreparationItemResult> {
  requireGrant(caller, "Administrator");

  const label = input.label.trim();
  if (label === "") return { outcome: "label-required" };

  const { scope } = input;
  const clusterId = scope.level === "cluster" ? scope.clusterId : null;
  const perjadinId = scope.level === "perjadin" ? scope.perjadinId : null;
  if (!(await scopeExists({ clusterId, perjadinId }))) return { outcome: "no-such-scope" };

  const sameScope = and(
    eq(preparationItem.level, scope.level),
    clusterId === null
      ? isNull(preparationItem.clusterId)
      : eq(preparationItem.clusterId, clusterId),
    perjadinId === null
      ? isNull(preparationItem.perjadinId)
      : eq(preparationItem.perjadinId, perjadinId),
  );

  const [row] = await db
    .insert(preparationItem)
    .values({
      level: scope.level,
      clusterId,
      perjadinId,
      label,
      // After every item of the same scope, removed ones included. Two adds at once may take the
      // same position; the resolver then orders them by id, so the order stays stable.
      position: sql`(select coalesce(max(${preparationItem.position}), 0) + 1 from ${preparationItem} where ${sameScope})`,
      addedOn: scope.level === "perjadin" ? null : sql`${todayInDeadlineZone}`,
    })
    .returning({ id: preparationItem.id });

  return { outcome: "added", itemId: row!.id };
}

export type RemovePreparationItemResult =
  | { outcome: "removed" }
  | { outcome: "system-item" }
  | { outcome: "no-such-item" };

/**
 * Remove an item from its level. A `semua` or `cluster` item is **soft-removed**, dated today, so
 * every Perjadin that ended before today still shows it and its ticks; removing it again changes
 * nothing. A `perjadin` item is deleted, and its ticks with it. The system item is refused.
 */
export async function removePreparationItem(
  caller: Person,
  itemId: string,
): Promise<RemovePreparationItemResult> {
  requireGrant(caller, "Administrator");

  const item = await itemById(itemId);
  if (!item) return { outcome: "no-such-item" };
  if (item.clearsOnTeachingTeamChange) return { outcome: "system-item" };

  if (item.level === "perjadin") {
    await db.delete(preparationItem).where(eq(preparationItem.id, itemId));
  } else {
    await db
      .update(preparationItem)
      .set({ removedOn: sql`${todayInDeadlineZone}` })
      .where(and(eq(preparationItem.id, itemId), isNull(preparationItem.removedOn)));
  }
  return { outcome: "removed" };
}

export type HidePreparationItemResult =
  | { outcome: "hidden" }
  | { outcome: "system-item" }
  /** The item is not wider than the scope: hiding is for a wider item only. */
  | { outcome: "not-wider" }
  | ItemRefusal;

/**
 * Hide a wider item for one Cluster or one Perjadin — a `semua` item for either, a `cluster` item
 * for one of that Cluster's Perjadins. Its ticks are kept, so showing it again brings them back. A
 * Cluster hide is dated today, like a wider add; a Perjadin hide always applies. Hiding what is
 * already hidden changes nothing. The system item is refused.
 */
export async function hidePreparationItem(
  caller: Person,
  input: { itemId: string; scope: PreparationOverrideScope },
): Promise<HidePreparationItemResult> {
  requireGrant(caller, "Administrator");

  const checked = await checkOverride(input.itemId, input.scope);
  if (checked.outcome !== "ok") return checked;
  if (checked.item.clearsOnTeachingTeamChange) return { outcome: "system-item" };

  // One open spell per Cluster and one row per Perjadin are unique indexes, so a second hide is a
  // conflict that does nothing.
  await db
    .insert(preparationItemHide)
    .values(
      "clusterId" in input.scope
        ? {
            preparationItemId: input.itemId,
            clusterId: input.scope.clusterId,
            hiddenOn: sql`${todayInDeadlineZone}`,
          }
        : { preparationItemId: input.itemId, perjadinId: input.scope.perjadinId },
    )
    .onConflictDoNothing();
  return { outcome: "hidden" };
}

/**
 * Show a hidden item again. For a Cluster the open spell is closed today, so the Perjadins that had
 * ended by then stay as they were; for a Perjadin the hide is deleted. Showing what is not hidden
 * changes nothing.
 */
export async function showPreparationItem(
  caller: Person,
  input: { itemId: string; scope: PreparationOverrideScope },
): Promise<{ outcome: "shown" }> {
  requireGrant(caller, "Administrator");

  if ("clusterId" in input.scope) {
    await db
      .update(preparationItemHide)
      .set({ shownOn: sql`${todayInDeadlineZone}` })
      .where(
        and(
          eq(preparationItemHide.preparationItemId, input.itemId),
          eq(preparationItemHide.clusterId, input.scope.clusterId),
          isNull(preparationItemHide.shownOn),
        ),
      );
  } else {
    await db
      .delete(preparationItemHide)
      .where(
        and(
          eq(preparationItemHide.preparationItemId, input.itemId),
          eq(preparationItemHide.perjadinId, input.scope.perjadinId),
        ),
      );
  }
  return { outcome: "shown" };
}

export type RewordPreparationItemResult =
  | { outcome: "reworded" }
  | { outcome: "label-required" }
  | { outcome: "not-wider" }
  | ItemRefusal;

/**
 * Reword an item. Without a scope the item's own wording changes; with one, the wording is
 * overridden for that Cluster or Perjadin only (a wider item's). Either way it stays **the same
 * item** — same id, ticks kept — and the wording shows wherever it applies, finished Perjadins
 * included. The system item may be reworded like any other.
 */
export async function rewordPreparationItem(
  caller: Person,
  input: { itemId: string; label: string; scope?: PreparationOverrideScope },
): Promise<RewordPreparationItemResult> {
  requireGrant(caller, "Administrator");

  const label = input.label.trim();
  if (label === "") return { outcome: "label-required" };

  if (!input.scope) {
    const [updated] = await db
      .update(preparationItem)
      .set({ label })
      .where(eq(preparationItem.id, input.itemId))
      .returning({ id: preparationItem.id });
    return updated ? { outcome: "reworded" } : { outcome: "no-such-item" };
  }

  const checked = await checkOverride(input.itemId, input.scope);
  if (checked.outcome !== "ok") return checked;

  // One upsert on the scope's partial unique index, not a delete and an insert: two rewords at once
  // would both pass the delete, and the second insert would hit the index.
  const scope = input.scope;
  const byCluster = "clusterId" in scope;
  await db
    .insert(preparationItemWording)
    .values({
      preparationItemId: input.itemId,
      ...(byCluster ? { clusterId: scope.clusterId } : { perjadinId: scope.perjadinId }),
      label,
    })
    .onConflictDoUpdate({
      target: [
        preparationItemWording.preparationItemId,
        byCluster ? preparationItemWording.clusterId : preparationItemWording.perjadinId,
      ],
      targetWhere: byCluster
        ? sql`${preparationItemWording.clusterId} is not null`
        : sql`${preparationItemWording.perjadinId} is not null`,
      set: { label },
    });
  return { outcome: "reworded" };
}

/** Drop a Cluster's or Perjadin's wording, so the wider wording shows again. */
export async function clearPreparationItemWording(
  caller: Person,
  input: { itemId: string; scope: PreparationOverrideScope },
): Promise<{ outcome: "cleared" }> {
  requireGrant(caller, "Administrator");
  await db.delete(preparationItemWording).where(wordingIn(input.itemId, input.scope));
  return { outcome: "cleared" };
}

function wordingIn(itemId: string, scope: PreparationOverrideScope) {
  return and(
    eq(preparationItemWording.preparationItemId, itemId),
    "clusterId" in scope
      ? eq(preparationItemWording.clusterId, scope.clusterId)
      : eq(preparationItemWording.perjadinId, scope.perjadinId),
  );
}

async function itemById(itemId: string) {
  const [item] = await db
    .select({
      level: preparationItem.level,
      clusterId: preparationItem.clusterId,
      clearsOnTeachingTeamChange: preparationItem.clearsOnTeachingTeamChange,
    })
    .from(preparationItem)
    .where(eq(preparationItem.id, itemId));
  return item ?? null;
}

async function scopeExists(scope: {
  clusterId: string | null;
  perjadinId: string | null;
}): Promise<boolean> {
  if (scope.clusterId !== null) {
    const [row] = await db
      .select({ id: cluster.id })
      .from(cluster)
      .where(eq(cluster.id, scope.clusterId));
    return row !== undefined;
  }
  if (scope.perjadinId !== null) {
    const [row] = await db
      .select({ id: perjadin.id })
      .from(perjadin)
      .where(eq(perjadin.id, scope.perjadinId));
    return row !== undefined;
  }
  return true;
}

/**
 * Is the item wider than the scope it is to be hidden or reworded in? A `semua` item is wider than
 * any Cluster or Perjadin; a `cluster` item only than a Perjadin of that Cluster — a Perjadin's
 * Cluster being its Sub-Cluster's.
 */
async function checkOverride(
  itemId: string,
  scope: PreparationOverrideScope,
): Promise<
  | { outcome: "ok"; item: NonNullable<Awaited<ReturnType<typeof itemById>>> }
  | { outcome: "not-wider" }
  | ItemRefusal
> {
  const item = await itemById(itemId);
  if (!item) return { outcome: "no-such-item" };

  if ("clusterId" in scope) {
    if (!(await scopeExists({ clusterId: scope.clusterId, perjadinId: null }))) {
      return { outcome: "no-such-scope" };
    }
    return item.level === "semua" ? { outcome: "ok", item } : { outcome: "not-wider" };
  }

  const [trip] = await db
    .select({ clusterId: subCluster.clusterId })
    .from(perjadin)
    .innerJoin(subCluster, eq(subCluster.id, perjadin.subClusterId))
    .where(eq(perjadin.id, scope.perjadinId));
  if (!trip) return { outcome: "no-such-scope" };

  const wider =
    item.level === "semua" || (item.level === "cluster" && item.clusterId === trip.clusterId);
  return wider ? { outcome: "ok", item } : { outcome: "not-wider" };
}
