import { asc, eq } from "drizzle-orm";

import { db } from "../client";
import { session } from "../schema/delivery";
import { cluster, school } from "../schema/reference";
import type { Person } from "./caller";
import { deliveredSessionCount, onDeliveredSessions } from "./delivered-sessions";

/**
 * **Coverage** — the landing screen. Every School with its delivered Session count,
 * grouped by Cluster.
 *
 * Open to anyone signed in, so the signature takes a `Person` and applies no further
 * check: delivery data carries no money, and ADR-0004 opens it to both roles. The
 * two actions the screen offers on a selection are Staff-only, and that is the
 * screen's rule rather than this query's — neither writes anything here.
 */

/**
 * One School's row: its name, where it is, and how much teaching has happened.
 *
 * No `slug`, though the column exists and public URLs are keyed on it. Nothing this
 * screen renders needs one, and the convention beside these modules is that nothing is
 * exported that a surface does not render. Detail Sekolah
 * ([#26](https://github.com/mafiefa02/sugt/issues/26)) is what adds it, if a link from
 * here is what it wants.
 */
export type CoverageSchool = {
  id: string;
  name: string;
  kabupatenKota: string;
  /**
   * Delivered Sessions. **Arranged and cancelled count for nothing.**
   *
   * The denominator is not in this payload: it is `TOTAL_SESSIONS_PER_SCHOOL` in
   * `@sugt/domain`, the same for every School and fixed from the start, and the
   * screen reads it there. Returning it per row would be a second source of truth
   * for a constant.
   */
  deliveredSessions: number;
};

/** One Cluster and the Schools in it. Between six and seventeen; the sizes are lopsided. */
export type CoverageCluster = {
  id: string;
  name: string;
  topic: string;
  schools: CoverageSchool[];
};

/**
 * What the Coverage screen renders, in one round trip.
 *
 * **One module per surface's payload**, and one function returning exactly what one
 * screen shows — settled on [#12](https://github.com/mafiefa02/sugt/issues/12). Two
 * consequences are the point of that choice: the choke point has exactly one visible
 * application per function, and no screen ever assembles its own joins.
 *
 * SQL shared between two of these modules belongs in an unexported helper beneath
 * them. Direktori Sekolah ([#26](https://github.com/mafiefa02/sugt/issues/26)) is the
 * second module wanting a School's delivered count, so the expression moved to
 * `./delivered-sessions.ts` rather than being copied. Nothing else about this query
 * changed with it.
 */
export async function coverage(_caller: Person): Promise<CoverageCluster[]> {
  const rows = await db
    .select({
      clusterId: cluster.id,
      clusterName: cluster.name,
      clusterTopic: cluster.topic,
      schoolId: school.id,
      schoolName: school.name,
      kabupatenKota: school.kabupatenKota,
      deliveredSessions: deliveredSessionCount,
    })
    .from(cluster)
    // Inner, never outer: `school.cluster_id` is NOT NULL, so "a School with no
    // Cluster" is not a state this screen ever has to render.
    .innerJoin(school, eq(school.clusterId, cluster.id))
    // Both the join condition and the count come from `./delivered-sessions.ts`, which
    // Direktori Sekolah reads too. Why the delivered filter sits in the JOIN rather
    // than in a WHERE is documented there, beside the condition it applies to.
    .leftJoin(session, onDeliveredSessions)
    .groupBy(cluster.id, school.id)
    // `cluster.id` is in the ordering so a Cluster's Schools are guaranteed
    // contiguous, which the fold below depends on. Names alone would interleave two
    // Clusters that shared one.
    .orderBy(asc(cluster.name), asc(cluster.id), asc(school.name));

  const clusters: CoverageCluster[] = [];
  let current: CoverageCluster | undefined;

  for (const row of rows) {
    if (current?.id !== row.clusterId) {
      current = {
        id: row.clusterId,
        name: row.clusterName,
        topic: row.clusterTopic,
        schools: [],
      };
      clusters.push(current);
    }
    current.schools.push({
      id: row.schoolId,
      name: row.schoolName,
      kabupatenKota: row.kabupatenKota,
      deliveredSessions: row.deliveredSessions,
    });
  }

  return clusters;
}
