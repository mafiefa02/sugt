import { and, asc, eq, like } from "drizzle-orm";

import { db } from "../client";
import { session } from "../schema/delivery";
import { cluster, school, subCluster } from "../schema/reference";
import { perjadin } from "../schema/travel";
import type { Person } from "./caller";
import { requireStaff } from "./staff-only";

/**
 * **Kelompok Sekolah** — the Sub-Cluster editing screen, and the only admin surface over
 * anything in `docs/data-model.md`'s reference-data section. It exists because DITSAMA
 * *invented* the Sub-Clusters rather than being handed them, and
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
export type KelompokSekolah = {
  id: string;
  name: string;
};

/** One Sub-Cluster, with the Schools currently in it. */
export type KelompokSubCluster = {
  id: string;
  name: string;
  schools: KelompokSekolah[];
};

/**
 * One Cluster and its Sub-Clusters. A Cluster with no Sub-Clusters is still returned — it is
 * where the "create the first Sub-Cluster here" affordance lives, and the create form needs
 * every Cluster to target one.
 */
export type KelompokCluster = {
  id: string;
  name: string;
  subClusters: KelompokSubCluster[];
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
export async function kelompokSekolah(_caller: Person): Promise<KelompokCluster[]> {
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

  const clusters = new Map<string, KelompokCluster>();
  const subClusters = new Map<string, KelompokSubCluster>();

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

/** Whether a driver error is a foreign-key violation, read from both places a driver may put it. */
function isForeignKeyViolation(error: unknown): boolean {
  const wrapped = error as { code?: string; cause?: { code?: string } };
  return (wrapped.cause?.code ?? wrapped.code) === "23503";
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
  | { outcome: "has-schools" };

/**
 * Delete a Sub-Cluster. Staff-only.
 *
 * The "not while it holds Schools" rule is the database's, not this function's:
 * `school.sub_cluster_id` references `sub_cluster(id)` with the default `NO ACTION`, so the
 * delete throws a foreign-key violation. ADR-0016 is explicit that emptying it first is the
 * only route and that this rule must **not** be duplicated in application code — so this
 * catches the refusal and names it, rather than re-counting the Schools itself.
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
    if (isForeignKeyViolation(error)) return { outcome: "has-schools" };
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
   * leaving. The refusal names those Perjadins so somebody can re-plan or cancel them first.
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
