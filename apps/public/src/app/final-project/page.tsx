import { Band } from "-/components/band";
import { StoryGrid } from "-/components/story-grid";
import { getStories } from "-/lib/aggregates";
import type { Metadata } from "next";

/**
 * **Final Project — the curated pieces about what Project Teams produced.**
 *
 * Its own section, not a filter chip on Cerita (the acceptance criterion): the **same** Story table
 * and editor, a **second route filtered on `kind = 'final_project'`**. A Final Project detail opens on
 * the shared `/cerita/[slug]` template — one Story detail, reached from here for these and from Cerita
 * for the field ones.
 */
export const metadata: Metadata = { title: "Final Project" };

export const revalidate = 3600;

export default async function Page() {
  const { stories } = await getStories();
  const finalProjects = stories.filter((story) => story.kind === "final_project");

  return (
    <Band className="py-16">
      <h1 className="font-heading text-4xl font-bold tracking-tight">Final Project</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        Karya yang dihasilkan Project Team menjawab Masalah Cluster-nya, di penghujung Program.
      </p>
      <div className="mt-8">
        <StoryGrid
          stories={finalProjects}
          emptyMessage="Belum ada Final Project yang diterbitkan."
        />
      </div>
    </Band>
  );
}
