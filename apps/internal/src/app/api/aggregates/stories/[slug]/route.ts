import { authorizeServiceCaller, toStoryPayload } from "-/lib/aggregates";
import { publishedStory } from "@sugt/db/queries";
import { NextResponse } from "next/server";

/**
 * **The Story detail route.** One published Story's body and its ordered gallery, keyed on the slug.
 * Behind `AGGREGATES_SECRET`. A slug that names a draft or no Story at all is a 404 — which is what
 * a withdrawal (clearing `published_at`) makes a once-published slug become, so a taken-down Story
 * stops resolving the moment its list entry is revalidated away.
 *
 * Bodies travel only here, not on the list, so a visitor loads every Story's prose only when they
 * open it.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const caller = authorizeServiceCaller(request);
  if (!caller) return new NextResponse("Unauthorized", { status: 401 });

  const { slug } = await params;
  const story = await publishedStory(caller, slug);
  if (!story) return new NextResponse("Not Found", { status: 404 });

  return NextResponse.json(toStoryPayload(story));
}
