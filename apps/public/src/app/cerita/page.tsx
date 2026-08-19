import { Band } from "-/components/band";
import { StoryGrid } from "-/components/story-grid";
import { getStories } from "-/lib/aggregates";
import type { Metadata } from "next";

/**
 * **Cerita — the field Stories.**
 *
 * Every published Story of kind `field`, newest first. A Final Project piece is the *same* table and
 * editor but its own section (`/final-project`), so it is filtered out here — Cerita is field work
 * about a School. The list carries covers and excerpts, never bodies (the body travels only on a
 * detail route).
 */
export const metadata: Metadata = { title: "Cerita" };

export const revalidate = 3600;

export default async function Page() {
  const { stories } = await getStories();
  const field = stories.filter((story) => story.kind === "field");

  return (
    <Band className="py-16">
      <h1 className="font-heading text-4xl font-bold tracking-tight">Cerita</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        Catatan dari lapangan — kunjungan ke Sekolah-Sekolah, ditulis oleh tim yang ada di sana.
      </p>
      <div className="mt-8">
        <StoryGrid
          stories={field}
          emptyMessage="Belum ada Cerita yang diterbitkan."
        />
      </div>
    </Band>
  );
}
