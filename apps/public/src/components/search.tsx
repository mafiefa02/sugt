"use client";

import { Input } from "@sugt/ui/components/input";
import Link from "next/link";
import { useState } from "react";

/**
 * **Pencarian — a search that queries nothing.**
 *
 * `docs/product.md` is explicit: Schools, Clusters and Story **titles** are already on the page in
 * the payloads the site fetched, so searching them is a filter in the browser. There is no route, no
 * query and no fetch here — and no Story **bodies**, which is why the server passes titles only. A
 * search box that reached the database would be the one hole in an app that deliberately holds no
 * credentials.
 *
 * The three payload slices are passed down minimal — a slug and a label each — and filtered
 * case-insensitively on every keystroke. An empty box shows nothing rather than everything: this is a
 * lookup, not a directory.
 */
type Hit = { slug: string; label: string };

/**
 * One group of results. `section` picks the route prefix; the `href` is built with a **literal**
 * prefix per branch so `typedRoutes` validates it — a template built from a `string` variable widens
 * to `` `/${string}` `` and is rejected, so the branch, not a helper, holds the literal.
 */
function SearchResults({
  heading,
  section,
  hits,
}: {
  heading: string;
  section: "sekolah" | "cluster" | "cerita";
  hits: Hit[];
}) {
  if (hits.length === 0) return null;
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground">{heading}</h2>
      <ul className="mt-2 divide-y divide-border">
        {hits.map((hit) => (
          <li key={hit.slug}>
            <Link
              href={
                section === "sekolah"
                  ? `/sekolah/${hit.slug}`
                  : section === "cluster"
                    ? `/cluster/${hit.slug}`
                    : `/cerita/${hit.slug}`
              }
              className="block py-2.5 text-sm hover:underline"
            >
              {hit.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Search({
  schools,
  clusters,
  stories,
}: {
  schools: { slug: string; name: string }[];
  clusters: { slug: string; name: string }[];
  stories: { slug: string; title: string }[];
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const match = (haystack: string) => haystack.toLowerCase().includes(needle);

  const schoolHits = needle === "" ? [] : schools.filter((s) => match(s.name));
  const clusterHits = needle === "" ? [] : clusters.filter((c) => match(c.name));
  const storyHits = needle === "" ? [] : stories.filter((s) => match(s.title));
  const total = schoolHits.length + clusterHits.length + storyHits.length;

  return (
    <div>
      <Input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
        placeholder="Cari Sekolah, Cluster, atau Cerita…"
        aria-label="Cari"
        className="max-w-md"
      />

      {needle !== "" && total === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">Tidak ada yang cocok dengan “{query}”.</p>
      )}

      <div className="mt-8 flex flex-col gap-8">
        <SearchResults
          heading="Sekolah"
          section="sekolah"
          hits={schoolHits.map((s) => ({ slug: s.slug, label: s.name }))}
        />
        <SearchResults
          heading="Cluster"
          section="cluster"
          hits={clusterHits.map((c) => ({ slug: c.slug, label: c.name }))}
        />
        <SearchResults
          heading="Cerita"
          section="cerita"
          hits={storyHits.map((s) => ({ slug: s.slug, label: s.title }))}
        />
      </div>
    </div>
  );
}

export { Search };
