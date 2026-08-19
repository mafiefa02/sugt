import { authorizeRevalidate, revalidationTargets } from "-/lib/revalidate";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * **The one route that points back at the internal app.** Publishing or withdrawing a Story there
 * calls this, so a takedown is live in seconds instead of waiting for the next deploy (ADR-0008). It
 * writes nothing but its own cache — no database credential, no Supabase client.
 *
 * A wrong or missing `REVALIDATE_SECRET` answers **401 and revalidates nothing**: the authorization
 * check runs before any `revalidatePath`. With a valid secret it refreshes the Story's detail page,
 * then both lists, then the School page — in that order — and answers with a per-step status so a
 * partial failure is visible to the operator who triggered it rather than collapsed into one code.
 */
export async function POST(request: Request) {
  if (!authorizeRevalidate(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { slug, school } = (await request.json()) as { slug: string; school: string };

  const revalidated = revalidationTargets(slug, school).map(({ target, path }) => {
    try {
      revalidatePath(path);
      return { target, outcome: "ok" as const };
    } catch {
      return { target, outcome: "failed" as const };
    }
  });

  return NextResponse.json({ revalidated });
}
