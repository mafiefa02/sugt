import { Band } from "-/components/band";
import { Search } from "-/components/search";
import { getScope, getStories } from "-/lib/aggregates";
import type { Metadata } from "next";

/**
 * **Pencarian — a search that queries nothing.**
 *
 * This server component fetches the scope and Stories payloads it already caches and hands the client
 * `<Search>` a **minimal** slice of each: Schools and Clusters by slug and name, and Stories by slug
 * and **title only**. No bodies cross to the browser — the whole point of searching titles rather than
 * reaching the database (`docs/product.md`). The filtering is entirely client-side; there is no route,
 * no query and no fetch behind the box.
 */
export const metadata: Metadata = { title: "Pencarian" };

export const revalidate = 3600;

export default async function Page() {
  const [scope, { stories }] = await Promise.all([getScope(), getStories()]);

  return (
    <Band className="py-16">
      <h1 className="font-heading text-4xl font-bold tracking-tight">Pencarian</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        Cari Sekolah, Cluster, atau Cerita. Pencarian berjalan di peramban — tidak ada yang dikirim
        ke mana pun.
      </p>
      <div className="mt-8">
        <Search
          schools={scope.schools.map((school) => ({ slug: school.slug, name: school.name }))}
          clusters={scope.clusters.map((cluster) => ({ slug: cluster.slug, name: cluster.name }))}
          stories={stories.map((story) => ({ slug: story.slug, title: story.title }))}
        />
      </div>
    </Band>
  );
}
