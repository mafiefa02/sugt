import { getScope, getStory } from "-/lib/aggregates";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * **The aggregates fetch wrapper — ADR-0014's two obligations as code.**
 *
 * `global.fetch` is mocked, so these assert what the wrapper does with a response, never a real
 * request. The load-bearing cases: a non-2xx **throws** (a bare fetch would bake `undefined` into the
 * HTML and build green), and a payload whose `version` this build does not know **throws** (rather
 * than render half of one). A Story detail 404 is the one expected absence — `null`, not a throw.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const VALID_SCOPE = { version: 1, clusters: [], schools: [] };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a list/scope payload", () => {
  it("returns the payload when the status is ok and the version matches", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse(VALID_SCOPE));

    await expect(getScope()).resolves.toEqual(VALID_SCOPE);
  });

  it("sends the bearer secret to the internal app's scope route", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse(VALID_SCOPE));

    await getScope();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://internal.test/api/aggregates/scope");
    expect((init?.headers as Record<string, string>).authorization).toBe(
      "Bearer test-aggregates-secret",
    );
  });

  it("throws on a non-2xx response — a down origin fails the build, never degrades to zeros", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse({}, 500));

    await expect(getScope()).rejects.toThrow(/responded 500/);
  });

  it("throws on a version it does not know, rather than render half a payload", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse({ ...VALID_SCOPE, version: 2 }));

    await expect(getScope()).rejects.toThrow(/version 2/);
  });
});

describe("a Story detail", () => {
  const VALID_STORY = {
    version: 1,
    slug: "s",
    title: "T",
    kind: "field",
    stream: null,
    body: "hai",
    coverUrl: null,
    gallery: [],
  };

  it("returns the Story when it resolves", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse(VALID_STORY));

    await expect(getStory("s")).resolves.toEqual(VALID_STORY);
  });

  it("is null on a 404 — a draft or a withdrawal, which the page turns into a 404", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse({}, 404));

    await expect(getStory("gone")).resolves.toBeNull();
  });

  it("still throws on any other non-2xx — a 404 is the only expected absence", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse({}, 500));

    await expect(getStory("s")).rejects.toThrow(/responded 500/);
  });
});
