import { requireEnv } from "-/lib/env";

/**
 * **The seam to `@sugt/public`'s revalidation.**
 *
 * Publishing or withdrawing a Story sets or clears `published_at` in this app's database, but the
 * public site serves its last good payload until its next deploy (ADR-0008's endpoint contract), so
 * it has to be told to refresh — otherwise a withdrawn photograph stays up. This is the one place
 * the cross-app call lives: it `POST`s to `@sugt/public`'s revalidate route with the shared
 * `REVALIDATE_SECRET`, and turns that route's per-step answer into the report the editor renders.
 *
 * The refresh runs in order — **detail entry → list → School page** — so the list never points at a
 * detail page the refresh has not reached yet. The order is the public route's; this side reports
 * what it did.
 */

/** The three pages a publish or withdrawal invalidates, in the order they must run. */
export type RevalidationTarget = "detail" | "list" | "school";

/**
 * A step's result. `"ok"` when the public site refreshed that page, `"failed"` when it did not —
 * which the editor renders as "gagal, halaman lama masih tayang", the "says plainly when it failed"
 * half of the requirement.
 */
export type RevalidationOutcome = "ok" | "failed";

export type RevalidationStepReport = {
  target: RevalidationTarget;
  /** What the operator sees for this step, in Indonesian to match the surface. */
  label: string;
  outcome: RevalidationOutcome;
};

export type RevalidationReport = {
  steps: RevalidationStepReport[];
};

const STEPS: { target: RevalidationTarget; label: string }[] = [
  { target: "detail", label: "Memuat ulang halaman Cerita" },
  { target: "list", label: "Memuat ulang daftar" },
  { target: "school", label: "Memuat ulang halaman Sekolah" },
];

/** The shape `@sugt/public`'s revalidate route answers with — one outcome per target it ran. */
type RevalidateResponse = {
  revalidated: { target: RevalidationTarget; outcome: RevalidationOutcome }[];
};

/** A report in which every step failed, for when the call itself never reached a per-step answer. */
function allFailed(): RevalidationReport {
  return { steps: STEPS.map((step) => ({ ...step, outcome: "failed" as const })) };
}

/**
 * Revalidate one Story's public pages and report each step. `slug` is the Story's public path
 * segment and `schoolSlug` its School's — both are what the public route needs to name the three
 * paths. A network failure or a non-2xx answer (a wrong secret is a 401) reports every step failed:
 * the publish still happened in this app's database, but the public site was not refreshed, and the
 * editor says so rather than implying success.
 */
export async function revalidatePublicStory(input: {
  slug: string;
  schoolSlug: string;
}): Promise<RevalidationReport> {
  let response: Response;
  try {
    response = await fetch(`${requireEnv("PUBLIC_APP_URL")}/api/revalidate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${requireEnv("REVALIDATE_SECRET")}`,
      },
      body: JSON.stringify({ slug: input.slug, school: input.schoolSlug }),
    });
  } catch {
    return allFailed();
  }
  if (!response.ok) return allFailed();

  const answer = (await response.json()) as RevalidateResponse;
  const byTarget = new Map(answer.revalidated.map((step) => [step.target, step.outcome]));
  return {
    steps: STEPS.map((step) => ({ ...step, outcome: byTarget.get(step.target) ?? "failed" })),
  };
}
