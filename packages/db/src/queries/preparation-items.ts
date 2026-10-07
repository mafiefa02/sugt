import { MAX_PREPARATION_ITEM_LABEL_LENGTH } from "@sugt/domain";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

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
import { levelView } from "./preparation-settings";
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
 *
 * **A wording** is trimmed, may not be empty, and is at most `MAX_PREPARATION_ITEM_LABEL_LENGTH`
 * characters. A new item, or a wording given at a level, may not repeat one that already applies at
 * that level — compared ignoring case and repeated spaces.
 */

/** Where an item is defined. */
export type PreparationScope =
  | { level: "semua" }
  | { level: "cluster"; clusterId: string }
  | { level: "perjadin"; perjadinId: string };

/** Where a wider item is hidden or reworded: one Cluster, or one Perjadin. */
export type PreparationOverrideScope = { clusterId: string } | { perjadinId: string };

/** Why a wording is refused, before anything is read. */
type LabelRefusal = { outcome: "label-required" } | { outcome: "label-too-long" };

/** Trim a wording, or refuse it. */
function checkLabel(raw: string): { outcome: "ok"; label: string } | LabelRefusal {
  const label = raw.trim();
  if (label === "") return { outcome: "label-required" };
  if (label.length > MAX_PREPARATION_ITEM_LABEL_LENGTH) return { outcome: "label-too-long" };
  return { outcome: "ok", label };
}

/** Two wordings are the same item's if they differ only in case and spacing. */
function sameWording(a: string, b: string): boolean {
  const normal = (label: string) => label.trim().replace(/\s+/g, " ").toLocaleLowerCase("id");
  return normal(a) === normal(b);
}

/** The refusals more than one write shares. */
type ItemRefusal =
  /** No item has that id. */
  | { outcome: "no-such-item" }
  /** The Cluster or Perjadin named does not exist. */
  | { outcome: "no-such-scope" };

export type AddPreparationItemResult =
  | { outcome: "added"; itemId: string }
  | LabelRefusal
  /** An item with the same wording already applies at this level. */
  | { outcome: "duplicate-label" }
  | { outcome: "no-such-scope" };

/**
 * Add an item at the end of its level's list. A `semua` or `cluster` item is dated today, so it
 * reaches only the Perjadins ending today or later; a `perjadin` item is undated. Refused when its
 * wording repeats an item already on the level's list (`preparationSettings`'s list).
 */
export async function addPreparationItem(
  caller: Person,
  input: { scope: PreparationScope; label: string },
): Promise<AddPreparationItemResult> {
  requireGrant(caller, "Administrator");

  const checked = checkLabel(input.label);
  if (checked.outcome !== "ok") return checked;
  const { label } = checked;

  const { scope } = input;
  const clusterId = scope.level === "cluster" ? scope.clusterId : null;
  const perjadinId = scope.level === "perjadin" ? scope.perjadinId : null;
  const view = await levelView(scope);
  if (!view) return { outcome: "no-such-scope" };
  if (view.items.some((item) => sameWording(item.label, label))) {
    return { outcome: "duplicate-label" };
  }

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
  | LabelRefusal
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

  const checkedLabel = checkLabel(input.label);
  if (checkedLabel.outcome !== "ok") return checkedLabel;
  const { label } = checkedLabel;

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

/**
 * **The writes Pengaturan Perjadin makes**, each addressed to the level on screen (`at`) rather than
 * to a table: an item defined at that level is changed itself, a wider one is overridden there. The
 * level decides, so the screen cannot reword every Perjadin's item while editing one Cluster's list.
 */

/** Is the item defined at exactly this level — the same Cluster or Perjadin, too? */
function definedAt(
  item: { level: string; clusterId: string | null; perjadinId: string | null },
  at: PreparationScope,
): boolean {
  if (item.level !== at.level) return false;
  if (at.level === "cluster") return item.clusterId === at.clusterId;
  if (at.level === "perjadin") return item.perjadinId === at.perjadinId;
  return true;
}

/** A level as the scope an override is written in; Semua has none, since nothing is wider. */
function overrideScopeOf(at: PreparationScope): PreparationOverrideScope | null {
  if (at.level === "cluster") return { clusterId: at.clusterId };
  if (at.level === "perjadin") return { perjadinId: at.perjadinId };
  return null;
}

export type RewordPreparationItemAtResult =
  | RewordPreparationItemResult
  /** Another item on this level's list already has that wording. */
  | { outcome: "duplicate-label" };

/**
 * **Ubah**: reword an item as seen at a level. An item defined there gets a new wording of its own,
 * which reaches every Perjadin it is on; a wider one gets this level's override. Refused when the
 * wording repeats another item on the level's list.
 */
export async function rewordPreparationItemAt(
  caller: Person,
  input: { itemId: string; label: string; at: PreparationScope },
): Promise<RewordPreparationItemAtResult> {
  requireGrant(caller, "Administrator");

  const checked = checkLabel(input.label);
  if (checked.outcome !== "ok") return checked;
  const item = await itemById(input.itemId);
  if (!item) return { outcome: "no-such-item" };

  const view = await levelView(input.at);
  if (!view) return { outcome: "no-such-scope" };
  const others = view.items.filter((other) => other.itemId !== input.itemId);
  if (others.some((other) => sameWording(other.label, checked.label))) {
    return { outcome: "duplicate-label" };
  }

  if (definedAt(item, input.at)) {
    return rewordPreparationItem(caller, { itemId: input.itemId, label: checked.label });
  }
  const scope = overrideScopeOf(input.at);
  if (!scope) return { outcome: "not-wider" };
  return rewordPreparationItem(caller, { itemId: input.itemId, label: checked.label, scope });
}

export type RemovePreparationItemAtResult =
  | { outcome: "removed" }
  | { outcome: "hidden" }
  | Exclude<HidePreparationItemResult, { outcome: "hidden" }>;

/**
 * **Hapus**: take an item off a level's list. One defined there is removed (`removePreparationItem`);
 * a wider one is hidden there (`hidePreparationItem`). The system item is refused either way.
 */
export async function removePreparationItemAt(
  caller: Person,
  input: { itemId: string; at: PreparationScope },
): Promise<RemovePreparationItemAtResult> {
  requireGrant(caller, "Administrator");

  const item = await itemById(input.itemId);
  if (!item) return { outcome: "no-such-item" };
  if (definedAt(item, input.at)) return removePreparationItem(caller, input.itemId);

  const scope = overrideScopeOf(input.at);
  if (!scope) return { outcome: "not-wider" };
  return hidePreparationItem(caller, { itemId: input.itemId, scope });
}

export type MovePreparationItemResult =
  | { outcome: "moved" }
  /** Already first (up) or last (down) among its level's items. */
  | { outcome: "at-end" }
  | { outcome: "no-such-item" };

/**
 * **Up / down**: swap an item with its neighbour among the items in force at its own level — a
 * removed item is skipped and keeps its place. Order is undated, so the move shows on every Perjadin
 * with both items, finished ones included; it changes no item and no tick.
 *
 * The level's items are renumbered `1…n` in their current order first, so two items that share a
 * position (two adds at once) still swap. The rows are locked, so two moves at once queue.
 */
export async function movePreparationItem(
  caller: Person,
  input: { itemId: string; direction: "up" | "down" },
): Promise<MovePreparationItemResult> {
  requireGrant(caller, "Administrator");

  return db.transaction(async (tx) => {
    const [item] = await tx
      .select({
        level: preparationItem.level,
        clusterId: preparationItem.clusterId,
        perjadinId: preparationItem.perjadinId,
      })
      .from(preparationItem)
      .where(eq(preparationItem.id, input.itemId));
    if (!item) return { outcome: "no-such-item" };

    const siblings = await tx
      .select({ id: preparationItem.id, removedOn: preparationItem.removedOn })
      .from(preparationItem)
      .where(
        and(
          eq(preparationItem.level, item.level),
          item.clusterId === null
            ? isNull(preparationItem.clusterId)
            : eq(preparationItem.clusterId, item.clusterId),
          item.perjadinId === null
            ? isNull(preparationItem.perjadinId)
            : eq(preparationItem.perjadinId, item.perjadinId),
        ),
      )
      .orderBy(asc(preparationItem.position), asc(preparationItem.id))
      .for("update");

    const active = siblings.filter((row) => row.removedOn === null);
    const at = active.findIndex((row) => row.id === input.itemId);
    const neighbour = active[input.direction === "up" ? at - 1 : at + 1];
    if (at === -1 || !neighbour) return { outcome: "at-end" };

    const order = siblings.map((row) => row.id);
    const from = order.indexOf(input.itemId);
    const to = order.indexOf(neighbour.id);
    [order[from], order[to]] = [order[to]!, order[from]!];

    for (const [index, id] of order.entries()) {
      await tx
        .update(preparationItem)
        .set({ position: index + 1 })
        .where(eq(preparationItem.id, id));
    }
    return { outcome: "moved" };
  });
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
      perjadinId: preparationItem.perjadinId,
      clearsOnTeachingTeamChange: preparationItem.clearsOnTeachingTeamChange,
    })
    .from(preparationItem)
    .where(eq(preparationItem.id, itemId));
  return item ?? null;
}

async function clusterExists(clusterId: string): Promise<boolean> {
  const [row] = await db.select({ id: cluster.id }).from(cluster).where(eq(cluster.id, clusterId));
  return row !== undefined;
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
    if (!(await clusterExists(scope.clusterId))) {
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
