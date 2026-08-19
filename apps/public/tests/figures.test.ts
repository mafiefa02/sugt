import type { DeliveryPayload, ScopePayload } from "-/lib/aggregates-types";
import { clusterFigures, deliveryDenominator, hasDelivery, provinceCount } from "-/lib/figures";
import { TOTAL_SESSIONS_PER_SCHOOL } from "@sugt/domain";
import { describe, expect, it } from "vitest";

/**
 * **The figures the site derives rather than fetches.** `docs/product.md` keeps every count off the
 * wire so it can never disagree with the list it summarises; these prove the reader computes them.
 */

function school(slug: string, provinceCode: string, clusterSlug: string) {
  return {
    id: slug,
    slug,
    name: slug,
    kabupatenKota: "Kota",
    provinceCode,
    provinceName: provinceCode,
    clusterId: clusterSlug,
    clusterSlug,
  };
}

describe("provinceCount", () => {
  it("counts distinct Provinces, not Schools", () => {
    const schools = [
      school("a", "JB", "alpha"),
      school("b", "JB", "alpha"),
      school("c", "KT", "beta"),
    ];
    expect(provinceCount(schools)).toBe(2);
  });
});

describe("deliveryDenominator", () => {
  it("is the total possible Sessions across every School", () => {
    expect(deliveryDenominator(42)).toBe(TOTAL_SESSIONS_PER_SCHOOL * 42);
  });
});

describe("hasDelivery", () => {
  it("is false at zero, so the delivery band stays hidden on launch day", () => {
    expect(hasDelivery({ version: 1, deliveredTotal: 0, perCluster: [] })).toBe(false);
  });

  it("is true once a single Session is delivered", () => {
    expect(hasDelivery({ version: 1, deliveredTotal: 1, perCluster: [] })).toBe(true);
  });
});

describe("clusterFigures", () => {
  const scope: ScopePayload = {
    version: 1,
    clusters: [
      { id: "1", slug: "alpha", name: "Alpha", topic: "T", problem: "P" },
      { id: "2", slug: "beta", name: "Beta", topic: "T", problem: "P" },
    ],
    schools: [school("a", "JB", "alpha"), school("b", "JB", "alpha"), school("c", "KT", "beta")],
  };

  it("pairs each Cluster with its School count and delivered count, in scope order", () => {
    const delivery: DeliveryPayload = {
      version: 1,
      deliveredTotal: 3,
      perCluster: [
        { clusterId: "1", clusterSlug: "alpha", delivered: 3 },
        { clusterId: "2", clusterSlug: "beta", delivered: 0 },
      ],
    };

    const figures = clusterFigures(scope, delivery);

    expect(figures.map((f) => f.cluster.slug)).toEqual(["alpha", "beta"]);
    expect(figures[0]).toMatchObject({ schoolCount: 2, delivered: 3 });
    expect(figures[1]).toMatchObject({ schoolCount: 1, delivered: 0 });
  });

  it("reads a Cluster missing from the delivery split as zero delivered", () => {
    // A Cluster the delivery payload omits entirely (rather than reporting at zero) still reads 0 —
    // the site never shows a Cluster with a blank where a number should be.
    const delivery: DeliveryPayload = { version: 1, deliveredTotal: 0, perCluster: [] };

    expect(clusterFigures(scope, delivery).every((f) => f.delivered === 0)).toBe(true);
  });
});
