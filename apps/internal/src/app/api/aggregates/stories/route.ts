import { authorizeServiceCaller, toStoriesPayload } from "-/lib/aggregates";
import { publishedStories } from "@sugt/db/queries";
import { NextResponse } from "next/server";

/**
 * **The Stories list route.** Every published Story with its title, slug, kind, stream, cover URL
 * and excerpt — and no bodies. Behind `AGGREGATES_SECRET`. Covers arrive as full public URLs, built
 * at this edge from the storage paths `@sugt/db` returns.
 */
export async function GET(request: Request) {
  const caller = authorizeServiceCaller(request);
  if (!caller) return new NextResponse("Unauthorized", { status: 401 });

  return NextResponse.json(toStoriesPayload(await publishedStories(caller)));
}
