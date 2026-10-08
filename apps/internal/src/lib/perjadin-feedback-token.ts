import { db, schema, tripSchoolNames } from "@sugt/db";
import type { PerjadinToken } from "@sugt/db/queries";
import { eq } from "drizzle-orm";

/**
 * Turning a Perjadin feedback token into the caller a Perjadin Evaluation write is checked against
 * — the sibling of `feedback-token.ts`, one table over (ADR-0024).
 *
 * **Why this lives in the app rather than in `@sugt/db`.** The same deliberate exception the
 * Participant resolver is: `@sugt/db`'s query layer takes a caller it is given and never resolves
 * one, because resolving is what *produces* the caller its queries are checked against — so it
 * cannot itself be one of them. `caller.ts` says as much about the `PerjadinToken` arm: the token
 * has to be checked before there is a caller to check it as. See ADR-0012 and ADR-0024.
 */

/**
 * A resolved token — carrying the Perjadin's display info the public form shows — or `gone`.
 *
 * **`gone` means an unknown token**, the only way here: a link no longer expires and is never
 * replaced (ADR-0049), and there is no cancelled-trip case — a Perjadin is a real trip once it
 * exists. It carries no reason, exactly as the Participant resolver's `gone` does.
 *
 * The `open` arm carries what the trip is named from — its Sub-Cluster's name, its dates and its
 * Schools (ADR-0044) — so the form can name which trip is being rated without a second query. The
 * page puts the name together with `perjadinName`, as every other Perjadin surface does.
 */
export type ResolvedPerjadinFeedbackToken =
  | {
      outcome: "open";
      caller: PerjadinToken;
      perjadin: {
        subClusterName: string;
        startsOn: string;
        endsOn: string;
        schoolNames: string[];
      };
    }
  | { outcome: "gone" };

/**
 * Resolve the token in an `/ep/{token}` URL.
 *
 * A lookup by token, and nothing about when it was issued (ADR-0049). A Perjadin may hold several
 * links (`db:reattach-links`), and each resolves to that Perjadin.
 */
export async function resolvePerjadinFeedbackToken(
  token: string,
): Promise<ResolvedPerjadinFeedbackToken> {
  const [row] = await db
    .select({
      perjadinId: schema.perjadinFeedbackToken.perjadinId,
      subClusterName: schema.subCluster.name,
      startsOn: schema.perjadin.startsOn,
      endsOn: schema.perjadin.endsOn,
      schoolNames: tripSchoolNames(schema.perjadin.id),
    })
    .from(schema.perjadinFeedbackToken)
    .innerJoin(schema.perjadin, eq(schema.perjadin.id, schema.perjadinFeedbackToken.perjadinId))
    .innerJoin(schema.subCluster, eq(schema.subCluster.id, schema.perjadin.subClusterId))
    .where(eq(schema.perjadinFeedbackToken.token, token))
    .limit(1);

  if (!row) return { outcome: "gone" };

  return {
    outcome: "open",
    caller: { kind: "perjadin", perjadinId: row.perjadinId },
    perjadin: {
      subClusterName: row.subClusterName,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      schoolNames: row.schoolNames,
    },
  };
}
