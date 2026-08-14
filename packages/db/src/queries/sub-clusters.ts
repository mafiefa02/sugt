import { and, asc, eq, like } from "drizzle-orm";

import { db } from "../client";
import { session } from "../schema/delivery";
import { cluster, school, subCluster } from "../schema/reference";
import { perjadin } from "../schema/travel";
import type { Person } from "./caller";
import { requireStaff } from "./staff-only";

/**
 * **Kelompok Sekolah** — the Sub-Cluster editing screen (its Indonesian team name; the concept is
 * **Sub-Cluster** in code, per `CONTEXT.md`), and the only admin surface over anything in
 * `docs/data-model.md`'s reference-data section. It exists because DITSAMA *invented* the
 * Sub-Clusters rather than being handed them, and
 * [ADR-0016](../../../../docs/adr/0016-sub-clusters-are-editable-because-nobody-allocated-them.md)
 * is the whole argument. Two rules live here that no key can hold, and they are the point:
 *
 * - **A Sub-Cluster that still holds Schools cannot be deleted.** The database already
 *   refuses it — `school.sub_cluster_id` references `sub_cluster(id)` with the default
 *   `NO ACTION` — so `deleteSubCluster` does not re-check it; it catches the refusal and
 *   says "empty it first" rather than surfacing a constraint-violation stack trace.
 * - **A School cannot be moved out from under a trip still going to visit it.** No key can
 *   hold this — that is exactly what editability costs (ADR-0016) — so `moveSchool` checks
 *   it here: the move is refused while an **`arranged`** Session at the School sits on a
 *   Perjadin against the Sub-Cluster it is leaving, and the refusal **names those
 *   Perjadins**. Delivered and cancelled Sessions never block a move — they record where
 *   the Programme went, not where it is going.
 *
 * Reads follow the open-delivery rule: anyone signed in may look, since a Perjadin is
 * planned against these. Every write opens with `requireStaff` (convention 4) and owns its
 * own transaction where it needs one (convention 5) — a Next.js layout does not run before
 * a Server Action, so hiding the nav entry is not access control.
 */

/** One School under a Sub-Cluster, as the screen lists it. */
export type SubClusterSchool = {
  id: string;
  name: string;
};

/** One Sub-Cluster, with the Schools currently in it. */
export type SubClusterWithSchools = {
  id: string;
  name: string;
  schools: SubClusterSchool[];
};

/**
 * One Cluster and its Sub-Clusters. A Cluster with no Sub-Clusters is still returned — it is
 * where the "create the first Sub-Cluster here" affordance lives, and the create form needs
 * every Cluster to target one.
 */
export type ClusterWithSubClusters = {
  id: string;
  name: string;
  subClusters: SubClusterWithSchools[];
};

/**
 * The whole screen in one round trip: every Cluster, its Sub-Clusters, each Sub-Cluster's
 * Schools. Left joins throughout, so an empty Cluster and an empty Sub-Cluster both appear —
 * the first to be filled, the second to be deleted or filled by a move.
 *
 * A read open to anyone signed in, so **no `requireStaff`** — the caller is taken because
 * every query takes one (convention 1), not to gate on it. Schools whose `sub_cluster_id` is
 * still null (the column is nullable until the seed ticket) belong to no Sub-Cluster and so
 * appear under none; the screen offers no unassigned state, matching "a School is always in
 * exactly one".
 */
export async function subClusterBoard(_caller: Person): Promise<ClusterWithSubClusters[]> {
  const rows = await db
    .select({
      clusterId: cluster.id,
      clusterName: cluster.name,
      subClusterId: subCluster.id,
      subClusterName: subCluster.name,
      schoolId: school.id,
      schoolName: school.name,
    })
    .from(cluster)
    .leftJoin(subCluster, eq(subCluster.clusterId, cluster.id))
    .leftJoin(school, eq(school.subClusterId, subCluster.id))
    .orderBy(asc(cluster.name), asc(subCluster.name), asc(school.name));

  const clusters = new Map<string, ClusterWithSubClusters>();
  const subClusters = new Map<string, SubClusterWithSchools>();

  for (const row of rows) {
    let clusterEntry = clusters.get(row.clusterId);
    if (!clusterEntry) {
      clusterEntry = { id: row.clusterId, name: row.clusterName, subClusters: [] };
      clusters.set(row.clusterId, clusterEntry);
    }
    if (row.subClusterId === null) continue;

    let subClusterEntry = subClusters.get(row.subClusterId);
    if (!subClusterEntry) {
      subClusterEntry = { id: row.subClusterId, name: row.subClusterName!, schools: [] };
      subClusters.set(row.subClusterId, subClusterEntry);
      clusterEntry.subClusters.push(subClusterEntry);
    }
    if (row.schoolId === null) continue;

    subClusterEntry.schools.push({ id: row.schoolId, name: row.schoolName! });
  }

  return [...clusters.values()];
}

/**
 * A URL-safe slug from a Sub-Cluster's name, mirroring `cerita.ts`. Generated once at
 * creation and never re-derived — a rename does not move the slug, exactly as ADR-0016 notes:
 * the seed stays authoritative for the rows it names by slug, and a screen-created Sub-Cluster
 * carries a slug of its own that no seed collides with.
 */
function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-");
  return base === "" ? "kelompok" : base;
}

/** The FK constraint that refused a write, read from both places a driver may put it. */
function foreignKeyConstraintOf(error: unknown): string | null {
  const wrapped = error as { constraint_name?: string; cause?: { constraint_name?: string } };
  return wrapped.cause?.constraint_name ?? wrapped.constraint_name ?? null;
}

/** What the create form collects: a name, and the Cluster it lands in. */
export type NewSubCluster = {
  clusterId: string;
  name: string;
};

export type CreateSubClusterResult =
  | { outcome: "created"; subClusterId: string }
  /** A blank name. The form requires one, so this is a stale or hand-edited submit. */
  | { outcome: "incomplete" }
  /** No Cluster has that id — a stale screen, since Clusters are seeded and never deleted here. */
  | { outcome: "no-such-cluster" };

/**
 * Create a Sub-Cluster inside a Cluster. Staff-only. The slug is generated once here, as a free
 * suffix `base`, `base-2`, `base-3`… — the first no Sub-Cluster holds — in one transaction so
 * the read and the insert cannot race a second create onto the same slug.
 */
export async function createSubCluster(
  caller: Person,
  input: NewSubCluster,
): Promise<CreateSubClusterResult> {
  requireStaff(caller);

  const name = input.name.trim();
  if (name === "") return { outcome: "incomplete" };

  return db.transaction(async (tx) => {
    const [parent] = await tx
      .select({ id: cluster.id })
      .from(cluster)
      .where(eq(cluster.id, input.clusterId));
    if (!parent) return { outcome: "no-such-cluster" };

    const base = slugify(name);
    const taken = new Set(
      (
        await tx
          .select({ slug: subCluster.slug })
          .from(subCluster)
          .where(like(subCluster.slug, `${base}%`))
      ).map((row) => row.slug),
    );
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;

    const [row] = await tx
      .insert(subCluster)
      .values({ slug, name, clusterId: input.clusterId })
      .returning({ id: subCluster.id });
    return { outcome: "created", subClusterId: row!.id };
  });
}

export type RenameSubClusterResult =
  | { outcome: "renamed" }
  /** A blank name. */
  | { outcome: "incomplete" }
  /** No Sub-Cluster has that id — already deleted, or a stale screen. */
  | { outcome: "no-such-sub-cluster" };

/**
 * Rename a Sub-Cluster. Staff-only. **The slug does not move** — it is the public identity the
 * seed keys on, and a rename that shifted it would let a later `db:seed` fail to recognise the
 * row it renamed (ADR-0016). One write.
 */
export async function renameSubCluster(
  caller: Person,
  subClusterId: string,
  name: string,
): Promise<RenameSubClusterResult> {
  requireStaff(caller);

  const trimmed = name.trim();
  if (trimmed === "") return { outcome: "incomplete" };

  const [row] = await db
    .update(subCluster)
    .set({ name: trimmed })
    .where(eq(subCluster.id, subClusterId))
    .returning({ id: subCluster.id });

  return row ? { outcome: "renamed" } : { outcome: "no-such-sub-cluster" };
}

export type DeleteSubClusterResult =
  | { outcome: "deleted" }
  /** No Sub-Cluster has that id — already deleted, or a stale screen. */
  | { outcome: "no-such-sub-cluster" }
  /** Schools still point at it. `school.sub_cluster_id`'s `NO ACTION` refuses the delete. */
  | { outcome: "has-schools" }
  /**
   * A past Perjadin was planned against it. `perjadin.sub_cluster_id` also references
   * `sub_cluster(id)` with `NO ACTION`, and a completed trip cannot be un-referenced — a
   * Sub-Cluster the Programme has travelled to is history, not a School still to be moved out.
   */
  | { outcome: "planned-against" };

/**
 * Delete a Sub-Cluster. Staff-only.
 *
 * Two tables reference `sub_cluster` with the default `NO ACTION`, and they mean different
 * things: a School still in it (empty it first) versus a Perjadin planned against it (which
 * records where the Programme went and cannot be un-referenced). Both raise the same SQLSTATE,
 * so the two are told apart by the **constraint name** rather than lumped into one refusal —
 * the same precision `roster.ts` uses, and what keeps a trip-held Sub-Cluster from being
 * mislabelled "still holds Schools". ADR-0016 is explicit that the Schools rule must **not** be
 * duplicated in application code, so this catches and names it rather than re-counting.
 */
export async function deleteSubCluster(
  caller: Person,
  subClusterId: string,
): Promise<DeleteSubClusterResult> {
  requireStaff(caller);

  try {
    const [row] = await db
      .delete(subCluster)
      .where(eq(subCluster.id, subClusterId))
      .returning({ id: subCluster.id });
    return row ? { outcome: "deleted" } : { outcome: "no-such-sub-cluster" };
  } catch (error) {
    const constraint = foreignKeyConstraintOf(error);
    // Both `school`'s foreign keys into `sub_cluster` share this prefix — the single-column one
    // and the `(sub_cluster_id, cluster_id)` composite — and either firing means Schools remain.
    if (constraint?.startsWith("school_sub_cluster")) return { outcome: "has-schools" };
    if (constraint === "perjadin_sub_cluster_id_sub_cluster_id_fk") {
      return { outcome: "planned-against" };
    }
    throw error;
  }
}

/** A Perjadin still going to visit the School, named so it can be re-planned or cancelled. */
export type BlockingPerjadin = {
  id: string;
  destination: string;
  startsOn: string;
  endsOn: string;
};

export type MoveSchoolResult =
  | { outcome: "moved" }
  /** No School has that id — a stale screen. */
  | { outcome: "no-such-school" }
  /** No Sub-Cluster has the target id. */
  | { outcome: "no-such-target" }
  /**
   * The target Sub-Cluster is in a different Cluster. A School's Cluster is fixed reference
   * data, and the `(sub_cluster_id, cluster_id)` composite key would refuse the row anyway —
   * this returns it as a value rather than as a stack trace. The screen groups by Cluster, so
   * only a stale submit reaches this.
   */
  | { outcome: "different-cluster" }
  /**
   * An `arranged` Session at the School still sits on a Perjadin against the Sub-Cluster it is
   * leaving. The refusal names those Perjadins so somebody can re-plan or cancel them.
   */
  | { outcome: "still-visited"; perjadins: BlockingPerjadin[] };

/**
 * Move a School into another Sub-Cluster. Staff-only, and one write — a School is always in
 * exactly one Sub-Cluster, so this is a move, never an add-and-remove, and there is no
 * intermediate unassigned state.
 *
 * The blocking rule (ADR-0016): refuse while an **`arranged`** Session at the School sits on a
 * Perjadin whose `sub_cluster_id` is the one it is leaving. Delivered and cancelled Sessions
 * never block — including the case a test must prove: a School whose only Sessions on the old
 * Sub-Cluster are delivered or cancelled moves freely. Online Sessions carry no Perjadin, so
 * they never block either.
 */
export async function moveSchool(
  caller: Person,
  schoolId: string,
  toSubClusterId: string,
): Promise<MoveSchoolResult> {
  requireStaff(caller);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ subClusterId: school.subClusterId, clusterId: school.clusterId })
      .from(school)
      .where(eq(school.id, schoolId));
    if (!row) return { outcome: "no-such-school" };

    // A no-op move is idempotent, and short-circuiting it keeps the block check from
    // reading arranged Sessions at the Sub-Cluster the School would not actually leave.
    if (row.subClusterId === toSubClusterId) return { outcome: "moved" };

    const [target] = await tx
      .select({ clusterId: subCluster.clusterId })
      .from(subCluster)
      .where(eq(subCluster.id, toSubClusterId));
    if (!target) return { outcome: "no-such-target" };
    if (target.clusterId !== row.clusterId) return { outcome: "different-cluster" };

    // Only a Sub-Cluster the School currently belongs to can be one it is "leaving". A School
    // with a null Sub-Cluster (nullable until the seed ticket) leaves nothing, so no arranged
    // trip can block its first assignment.
    if (row.subClusterId !== null) {
      const blocking = await tx
        .selectDistinct({
          id: perjadin.id,
          destination: perjadin.destination,
          startsOn: perjadin.startsOn,
          endsOn: perjadin.endsOn,
        })
        .from(session)
        .innerJoin(perjadin, eq(perjadin.id, session.perjadinId))
        .where(
          and(
            eq(session.schoolId, schoolId),
            eq(session.status, "arranged"),
            eq(perjadin.subClusterId, row.subClusterId),
          ),
        )
        .orderBy(asc(perjadin.startsOn));
      if (blocking.length > 0) return { outcome: "still-visited", perjadins: blocking };
    }

    await tx.update(school).set({ subClusterId: toSubClusterId }).where(eq(school.id, schoolId));
    return { outcome: "moved" };
  });
}

/**
 * The ids of the Schools eligible for a Perjadin against one Sub-Cluster.
 *
 * The rule ADR-0016 says cannot be a foreign key — *"every School a Perjadin teaches at
 * belongs to that Perjadin's Sub-Cluster"* — is checked in `./perjadin-planning.ts` against
 * this set, before a trip is written and while it can still be refused as a value. Rencanakan
 * Perjadin is the one place that rule can be violated, since no write adds a School to an
 * existing Perjadin.
 *
 * **Imported by that module directly and not re-exported from `./index.ts`.** No surface
 * renders it — it is shared SQL beneath two modules, the case convention 3 makes room for,
 * the same way `heldOnWithinPerjadin` sits in `./session-detail.ts` without joining the public
 * surface. An id naming no Sub-Cluster returns an empty list, so every planned School reads as
 * outside it and the trip is refused — the honest response to a hand-edited id, and the reason
 * `planPerjadin` needs no separate `no-such-sub-cluster` outcome.
 */
export async function subClusterSchoolIds(subClusterId: string): Promise<string[]> {
  const rows = await db
    .select({ id: school.id })
    .from(school)
    .where(eq(school.subClusterId, subClusterId));
  return rows.map((row) => row.id);
}
