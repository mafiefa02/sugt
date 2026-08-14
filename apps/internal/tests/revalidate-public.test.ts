import { revalidatePublicStory } from "-/lib/revalidate-public";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * **The completed cross-app revalidation call.** `revalidate-public.ts` was a stub until this issue;
 * it now `POST`s to `@sugt/public`'s revalidate route. The `fetch` is stubbed at the network
 * boundary, the same seam `support/google.ts` stubs Google's token endpoint, because the one thing
 * a test cannot reach is the other app.
 *
 * What is asserted: the request the internal app sends (target, bearer, body), and that the public
 * site's answer — including a 401 from a wrong secret, and a dead network — turns into the report the
 * editor renders.
 */
describe("revalidatePublicStory", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts to the public revalidate route with the bearer and { slug, school }", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        revalidated: [
          { target: "detail", outcome: "ok" },
          { target: "list", outcome: "ok" },
          { target: "school", outcome: "ok" },
        ],
      }),
    );

    const report = await revalidatePublicStory({ slug: "kunjungan", schoolSlug: "sman-1" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:3000/api/revalidate");
    expect(init).toMatchObject({ method: "POST" });
    expect((init!.headers as Record<string, string>).authorization).toBe(
      "Bearer test-revalidate-secret",
    );
    expect(JSON.parse(init!.body as string)).toEqual({ slug: "kunjungan", school: "sman-1" });

    expect(report.steps.map((s) => s.target)).toEqual(["detail", "list", "school"]);
    expect(report.steps.every((s) => s.outcome === "ok")).toBe(true);
  });

  it("reports every step failed when the public site answers 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Unauthorized", { status: 401 }));

    const report = await revalidatePublicStory({ slug: "x", schoolSlug: "y" });

    expect(report.steps).toHaveLength(3);
    expect(report.steps.every((s) => s.outcome === "failed")).toBe(true);
  });

  it("reports every step failed when the call never reaches the public site", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

    const report = await revalidatePublicStory({ slug: "x", schoolSlug: "y" });

    expect(report.steps.every((s) => s.outcome === "failed")).toBe(true);
  });

  it("marks a single step failed when the public site reports it did not refresh that page", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        revalidated: [
          { target: "detail", outcome: "ok" },
          { target: "list", outcome: "failed" },
          { target: "school", outcome: "ok" },
        ],
      }),
    );

    const report = await revalidatePublicStory({ slug: "x", schoolSlug: "y" });

    expect(report.steps.find((s) => s.target === "list")!.outcome).toBe("failed");
    expect(report.steps.find((s) => s.target === "detail")!.outcome).toBe("ok");
  });
});
