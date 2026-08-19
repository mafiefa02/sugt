import { POST } from "-/app/api/revalidate/route";
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * **The revalidation route's gate.** The internal app calls this when a Story is published or
 * withdrawn. `next/cache` is mocked, so the assertions are about *whether* and *in what order* the
 * route asks for a refresh — never about Next actually revalidating anything.
 *
 * The load-bearing case is the 401: a wrong or missing `REVALIDATE_SECRET` must revalidate nothing,
 * which is the check running before any `revalidatePath`.
 */
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const SECRET = "test-revalidate-secret";

function post(body: unknown, authorization?: string): Request {
  return new Request("http://localhost:3000/api/revalidate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("the public revalidation route", () => {
  beforeEach(() => vi.mocked(revalidatePath).mockClear());

  it("401s and revalidates nothing when the secret is missing", async () => {
    const res = await POST(post({ slug: "x", school: "y" }));

    expect(res.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("401s and revalidates nothing when the secret is wrong", async () => {
    const res = await POST(post({ slug: "x", school: "y" }, "Bearer nope"));

    expect(res.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates the detail page, then both lists, then the School page — in that order", async () => {
    const res = await POST(post({ slug: "kunjungan", school: "sman-1" }, `Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    // Both `/cerita` and `/final-project` are refreshed: the route does not know the Story's kind, so
    // it cannot tell which list gained it, and missing that list would hide a published piece.
    expect(vi.mocked(revalidatePath).mock.calls.map((call) => call[0])).toEqual([
      "/cerita/kunjungan",
      "/cerita",
      "/final-project",
      "/sekolah/sman-1",
    ]);

    const body = (await res.json()) as { revalidated: { target: string; outcome: string }[] };
    expect(body.revalidated).toEqual([
      { target: "detail", outcome: "ok" },
      { target: "list", outcome: "ok" },
      { target: "final-project-list", outcome: "ok" },
      { target: "school", outcome: "ok" },
    ]);
  });
});
