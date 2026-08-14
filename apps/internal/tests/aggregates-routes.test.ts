import { GET as deliveryRoute } from "-/app/api/aggregates/delivery/route";
import { GET as scopeRoute } from "-/app/api/aggregates/scope/route";
import { GET as storyRoute } from "-/app/api/aggregates/stories/[slug]/route";
import { GET as storiesRoute } from "-/app/api/aggregates/stories/route";
import {
  addStoryPhotos,
  createStory,
  publishStory,
  setStoryCover,
  storyForEditor,
} from "@sugt/db/queries";
import { beforeEach, describe, expect, it } from "vitest";

import { addCluster, addProvince, addSchool, resetDatabase } from "./support/fixtures";
import { signInAsPerson } from "./support/sign-in";

/**
 * **The aggregates route handlers** — the shared-secret gate in front of the four payloads.
 *
 * The handlers are exercised the way `sign-in.ts` exercises the auth handler: a real `Request` in,
 * a real `Response` out, no Next.js server and no browser. What these prove is the gate and the
 * edge work the query tests cannot — the 401 on a wrong or missing secret (so the routes are never
 * browser-reachable), the `version` stamp, and photographs leaving as full public URLs.
 */
const SECRET = "test-aggregates-secret";
const ORIGIN = "http://localhost:3001";
const authed = (path: string) =>
  new Request(`${ORIGIN}${path}`, { headers: { authorization: `Bearer ${SECRET}` } });

const staff = () => signInAsPerson("Staff", "rina@ditsama.itb.ac.id", "Rina Nurhayati");

async function oneSchool() {
  await addProvince("JB", "Jawa Barat");
  const cluster = await addCluster({ slug: "alpha", name: "Cluster Alpha" });
  return addSchool({ slug: "sman-1", name: "SMAN 1", clusterId: cluster.id, provinceCode: "JB" });
}

describe("the aggregates gate", () => {
  beforeEach(resetDatabase);

  it("401s a request with no Authorization header — the routes are never browser-reachable", async () => {
    const res = await scopeRoute(new Request(`${ORIGIN}/api/aggregates/scope`));
    expect(res.status).toBe(401);
  });

  it("401s a wrong secret, on every route", async () => {
    const wrong = () =>
      new Request(`${ORIGIN}/x`, { headers: { authorization: "Bearer nope" } });
    expect((await scopeRoute(wrong())).status).toBe(401);
    expect((await deliveryRoute(wrong())).status).toBe(401);
    expect((await storiesRoute(wrong())).status).toBe(401);
    expect(
      (await storyRoute(wrong(), { params: Promise.resolve({ slug: "x" }) })).status,
    ).toBe(401);
  });

  it("serves the scope payload with a version and no derived counts, to a valid secret", async () => {
    await oneSchool();

    const res = await scopeRoute(authed("/api/aggregates/scope"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.version).toBe(1);
    expect(body.clusters).toHaveLength(1);
    expect(body.schools[0]).toMatchObject({ slug: "sman-1", provinceName: "Jawa Barat" });
  });

  it("serves the delivery payload with a version", async () => {
    await oneSchool();
    const res = await deliveryRoute(authed("/api/aggregates/delivery"));
    const body = await res.json();
    expect(body).toMatchObject({ version: 1, deliveredTotal: 0 });
    expect(body.perCluster).toHaveLength(1);
  });

  it("serves the Stories list with cover as a full public URL, no body, and a version", async () => {
    const pic = await staff();
    const school = await oneSchool();
    const s = await createStory(pic, {
      schoolId: school.id,
      title: "Kunjungan",
      body: "Isi cerita.",
      kind: "field",
      stream: "STEM",
    });
    await addStoryPhotos(pic, s.id, [
      { storagePath: "story/x/cover.jpg", contentType: "image/jpeg", byteSize: 1, caption: null },
    ]);
    const editor = await storyForEditor(pic, s.id);
    await setStoryCover(pic, s.id, editor!.photos[0]!.id);
    await publishStory(pic, s.id);

    const res = await storiesRoute(authed("/api/aggregates/stories"));
    const body = await res.json();

    expect(body.version).toBe(1);
    expect(body.stories[0].coverUrl).toBe(
      "https://test-project.supabase.co/storage/v1/object/public/public-media/story/x/cover.jpg",
    );
    expect(body.stories[0]).not.toHaveProperty("coverPhotoPath");
    expect(body.stories[0]).not.toHaveProperty("body");
    expect(body.stories[0].excerpt).toContain("Isi cerita");
  });

  it("serves a published Story's detail with gallery URLs, and 404s a slug that does not resolve", async () => {
    const pic = await staff();
    const school = await oneSchool();
    const s = await createStory(pic, {
      schoolId: school.id,
      title: "Detail",
      body: "Isi lengkap.",
      kind: "field",
      stream: null,
    });
    await addStoryPhotos(pic, s.id, [
      { storagePath: "story/d/1.jpg", contentType: "image/jpeg", byteSize: 1, caption: "Satu" },
    ]);
    await publishStory(pic, s.id);

    const ok = await storyRoute(authed("/api/aggregates/stories/detail"), {
      params: Promise.resolve({ slug: "detail" }),
    });
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body).toMatchObject({ version: 1, slug: "detail", body: "Isi lengkap." });
    expect(body.gallery[0]).toEqual({
      url: "https://test-project.supabase.co/storage/v1/object/public/public-media/story/d/1.jpg",
      caption: "Satu",
    });

    const missing = await storyRoute(authed("/api/aggregates/stories/nope"), {
      params: Promise.resolve({ slug: "nope" }),
    });
    expect(missing.status).toBe(404);
  });
});
