import { StoryCard } from "-/components/story-card";
import type { StoryListItem } from "-/lib/aggregates-types";

/**
 * **A grid of Story cards, or a line saying there are none yet.**
 *
 * Shared by the Cerita and Final Project lists, which differ only in the kind they filter to and the
 * words they lead with — the grid and its empty state are the same shape, so they live once here.
 */
function StoryGrid({ stories, emptyMessage }: { stories: StoryListItem[]; emptyMessage: string }) {
  if (stories.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {stories.map((story) => (
        <StoryCard
          key={story.slug}
          story={story}
        />
      ))}
    </div>
  );
}

export { StoryGrid };
