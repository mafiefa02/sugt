import type { PreparationItemLevel } from "@sugt/domain";
import { and, eq, inArray, or } from "drizzle-orm";

import { db } from "../client";
import { subCluster } from "../schema/reference";
import {
  perjadin,
  perjadinPreparationTick,
  preparationItem,
  preparationItemHide,
  preparationItemWording,
} from "../schema/travel";

/**
 * **A Perjadin's effective Preparation Checklist** (ADR-0045): which items apply to it, in what
 * order, in whose wording, and which are ticked. The items live in `preparation_item` at three
 * levels; this is the one place that turns them into one Perjadin's list, so the `/perjadin` list,
 * `/pendamping`, the detail page and the toggle can never disagree. Shared beneath those modules the
 * way `./group-rules.ts` is.
 *
 * The rules, each a pure function of the stored rows and the Perjadin's `ends_on` (E) and Cluster:
 * - **A `semua` or `cluster` item applies iff `added_on <= E` and `removed_on` is null or after E.**
 *   The dates are the WIB day of each change, so a change reaches only the Perjadins that had not
 *   ended by then, and a finished Perjadin's list is frozen. A `cluster` item applies only in its
 *   Cluster; a `perjadin` item, undated, always applies to its Perjadin.
 * - **A Cluster hide covers E** when some spell has `hidden_on <= E` and `shown_on` null or after E;
 *   a Perjadin hide always applies. A hidden item is left out, its ticks kept.
 * - **The most specific wording wins**: the Perjadin's override, then the Cluster's, then the label.
 *   Wording is undated, so it reaches finished Perjadins too.
 * - **Order**: `semua` items first, then the Cluster's, then the Perjadin's own, each by `position`.
 *   A wording override does not move an item.
 */

/** One item of a Perjadin's checklist, in render order, with its tick. */
export type PreparationItem = {
  itemId: string;
  /** The wording in force for this Perjadin: its own override, its Cluster's, or the item's. */
  label: string;
  level: PreparationItemLevel;
  /** The system item, whose tick a Teaching-Team change clears (ADR-0045). */
  clearsOnTeachingTeamChange: boolean;
  checked: boolean;
  /** Who last ticked it, and when — recorded for later use; nothing renders these yet. */
  checkedBy: string | null;
  checkedAt: Date | null;
};

/**
 * What the resolver needs to know about a Perjadin: its id, its Cluster and the day it ends.
 * Pengaturan Perjadin (`./preparation-settings.ts`) also resolves a Perjadin that does not exist —
 * "one ending today", with no id, in a Cluster or in none — to show what a level gives.
 */
export type ChecklistPerjadin = { id: string | null; clusterId: string | null; endsOn: string };

/** The database or a transaction on it: what the catalog and a level's view are read through. */
export type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The stored rows the resolver reads, already narrowed to the Perjadins at hand. */
export type ChecklistCatalog = {
  items: {
    id: string;
    level: PreparationItemLevel;
    clusterId: string | null;
    perjadinId: string | null;
    label: string;
    position: number;
    addedOn: string | null;
    removedOn: string | null;
    clearsOnTeachingTeamChange: boolean;
  }[];
  hides: {
    preparationItemId: string;
    clusterId: string | null;
    perjadinId: string | null;
    hiddenOn: string | null;
    shownOn: string | null;
  }[];
  wordings: {
    preparationItemId: string;
    clusterId: string | null;
    perjadinId: string | null;
    label: string;
  }[];
  ticks: { perjadinId: string; preparationItemId: string; checkedBy: string; checkedAt: Date }[];
};

const LEVEL_ORDER: Record<PreparationItemLevel, number> = { semua: 0, cluster: 1, perjadin: 2 };

/** Does a dated spell — an item's life, or a Cluster hide — cover a Perjadin ending on `endsOn`? */
function covers(from: string | null, until: string | null, endsOn: string): boolean {
  // ISO dates compare as strings. `from` is null only on undated rows, which never reach here.
  return from !== null && from <= endsOn && (until === null || until > endsOn);
}

/**
 * Resolve one Perjadin's checklist from the stored rows. **Pure**: every rule above is decided here
 * and nowhere else, so the batched read only has to fetch.
 */
export function resolvePreparationChecklist(
  trip: ChecklistPerjadin,
  catalog: ChecklistCatalog,
): PreparationItem[] {
  // A null id or Cluster matches nothing: a row's own null `perjadin_id` must not read as "this one".
  const onTrip = (perjadinId: string | null) => trip.id !== null && perjadinId === trip.id;
  const inCluster = (clusterId: string | null) =>
    trip.clusterId !== null && clusterId === trip.clusterId;

  const applies = catalog.items.filter((item) => {
    if (item.level === "perjadin") return onTrip(item.perjadinId);
    if (item.level === "cluster" && !inCluster(item.clusterId)) return false;
    return covers(item.addedOn, item.removedOn, trip.endsOn);
  });

  const hidden = new Set(
    catalog.hides
      .filter(
        (hide) =>
          onTrip(hide.perjadinId) ||
          (inCluster(hide.clusterId) && covers(hide.hiddenOn, hide.shownOn, trip.endsOn)),
      )
      .map((hide) => hide.preparationItemId),
  );

  const wordingFor = (itemId: string, label: string) =>
    catalog.wordings.find((w) => w.preparationItemId === itemId && onTrip(w.perjadinId))?.label ??
    catalog.wordings.find((w) => w.preparationItemId === itemId && inCluster(w.clusterId))?.label ??
    label;

  const ticks = new Map(
    catalog.ticks
      .filter((tick) => tick.perjadinId === trip.id)
      .map((tick) => [tick.preparationItemId, tick]),
  );

  return applies
    .filter((item) => !hidden.has(item.id))
    .toSorted(
      (a, b) =>
        LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
        a.position - b.position ||
        a.id.localeCompare(b.id),
    )
    .map((item) => {
      const tick = ticks.get(item.id);
      return {
        itemId: item.id,
        label: wordingFor(item.id, item.label),
        level: item.level,
        clearsOnTeachingTeamChange: item.clearsOnTeachingTeamChange,
        checked: tick !== undefined,
        checkedBy: tick?.checkedBy ?? null,
        checkedAt: tick?.checkedAt ?? null,
      };
    });
}

/**
 * **Many Perjadins' checklists in one read** — the batched form the `/perjadin` list, `/pendamping`
 * and a week of the Dashboard need, so no list pays one round trip per row. Every Perjadin asked
 * for that exists gets an entry; one that does not is absent from the map.
 *
 * Five selects, never one per Perjadin: the Perjadins themselves (their Cluster is their
 * Sub-Cluster's, known before any Session), then — concurrently — every item that could apply to
 * them, the hides and wordings in their Clusters or on them, and their ticks. `resolvePreparationChecklist`
 * then decides each list in memory.
 */
export async function preparationChecklists(
  perjadinIds: string[],
): Promise<Map<string, PreparationItem[]>> {
  if (perjadinIds.length === 0) return new Map();

  const trips = await db
    .select({ id: perjadin.id, clusterId: subCluster.clusterId, endsOn: perjadin.endsOn })
    .from(perjadin)
    .innerJoin(subCluster, eq(subCluster.id, perjadin.subClusterId))
    .where(inArray(perjadin.id, perjadinIds));
  if (trips.length === 0) return new Map();

  const catalog = await loadChecklistCatalog({
    clusterIds: [...new Set(trips.map((trip) => trip.clusterId))],
    perjadinIds: trips.map((trip) => trip.id),
  });
  return new Map(trips.map((trip) => [trip.id, resolvePreparationChecklist(trip, catalog)]));
}

/**
 * Every stored row that could bear on a checklist in these Clusters or of these Perjadins: all
 * `semua` items, the Clusters' and the Perjadins' own items, the hides and wordings on either, and the
 * Perjadins' ticks — four selects, run concurrently.
 */
export async function loadChecklistCatalog(
  scope: { clusterIds: string[]; perjadinIds: string[] },
  executor: Executor = db,
): Promise<ChecklistCatalog> {
  const { clusterIds, perjadinIds: ids } = scope;
  // `inArray` over an empty list is `false`, so a scope with no Cluster or no Perjadin is harmless.
  const inScope = (table: typeof preparationItemHide | typeof preparationItemWording) =>
    or(inArray(table.clusterId, clusterIds), inArray(table.perjadinId, ids));

  const [items, hides, wordings, ticks] = await Promise.all([
    executor
      .select({
        id: preparationItem.id,
        level: preparationItem.level,
        clusterId: preparationItem.clusterId,
        perjadinId: preparationItem.perjadinId,
        label: preparationItem.label,
        position: preparationItem.position,
        addedOn: preparationItem.addedOn,
        removedOn: preparationItem.removedOn,
        clearsOnTeachingTeamChange: preparationItem.clearsOnTeachingTeamChange,
      })
      .from(preparationItem)
      .where(
        or(
          eq(preparationItem.level, "semua"),
          and(eq(preparationItem.level, "cluster"), inArray(preparationItem.clusterId, clusterIds)),
          and(eq(preparationItem.level, "perjadin"), inArray(preparationItem.perjadinId, ids)),
        ),
      ),
    executor
      .select({
        preparationItemId: preparationItemHide.preparationItemId,
        clusterId: preparationItemHide.clusterId,
        perjadinId: preparationItemHide.perjadinId,
        hiddenOn: preparationItemHide.hiddenOn,
        shownOn: preparationItemHide.shownOn,
      })
      .from(preparationItemHide)
      .where(inScope(preparationItemHide)),
    executor
      .select({
        preparationItemId: preparationItemWording.preparationItemId,
        clusterId: preparationItemWording.clusterId,
        perjadinId: preparationItemWording.perjadinId,
        label: preparationItemWording.label,
      })
      .from(preparationItemWording)
      .where(inScope(preparationItemWording)),
    executor
      .select({
        perjadinId: perjadinPreparationTick.perjadinId,
        preparationItemId: perjadinPreparationTick.preparationItemId,
        checkedBy: perjadinPreparationTick.checkedBy,
        checkedAt: perjadinPreparationTick.checkedAt,
      })
      .from(perjadinPreparationTick)
      .where(inArray(perjadinPreparationTick.perjadinId, ids)),
  ]);

  return { items, hides, wordings, ticks };
}

/** One Perjadin's checklist, or `null` when there is no such Perjadin. */
export async function preparationChecklist(perjadinId: string): Promise<PreparationItem[] | null> {
  return (await preparationChecklists([perjadinId])).get(perjadinId) ?? null;
}
