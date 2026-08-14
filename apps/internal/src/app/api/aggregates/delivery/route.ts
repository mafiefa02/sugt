import { authorizeServiceCaller, toDeliveryPayload } from "-/lib/aggregates";
import { delivery } from "@sugt/db/queries";
import { NextResponse } from "next/server";

/**
 * **The delivery route.** The delivered total and the delivered count per Cluster — never per
 * School, and never a denominator. Behind `AGGREGATES_SECRET`, on the delivery lifetime: it accrues
 * as trips happen, so `@sugt/public` revalidates it more often than scope.
 */
export async function GET(request: Request) {
  const caller = authorizeServiceCaller(request);
  if (!caller) return new NextResponse("Unauthorized", { status: 401 });

  return NextResponse.json(toDeliveryPayload(await delivery(caller)));
}
