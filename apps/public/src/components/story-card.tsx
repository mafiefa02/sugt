import { StoryImage } from "-/components/story-image";
import type { StoryListItem } from "-/lib/aggregates-types";
import { Badge } from "@sugt/ui/components/badge";
import Link from "next/link";

/**
 * **One Story in a list grid** — cover, title, excerpt, and its Stream if it has one.
 *
 * The whole card is one link to the Story's detail page, which is `/cerita/[slug]` for **both** kinds
 * (`docs/product.md`: the Final Project section is a second *list* route, and a Story detail is one
 * template; the revalidation contract also names every detail `/cerita/${slug}`). The excerpt is the
 * plain-text lead the payload carries — the body itself never travels to the list.
 */
function StoryCard({ story }: { story: StoryListItem }) {
  return (
    <Link
      href={`/cerita/${story.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border transition-colors hover:border-foreground/30"
    >
      {story.coverUrl === null ? (
        <div className="aspect-[3/2] bg-muted" />
      ) : (
        <StoryImage
          url={story.coverUrl}
          alt={story.title}
          className="aspect-[3/2]"
          sizes="(min-width: 768px) 360px, 100vw"
        />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {story.stream !== null && (
          <Badge
            variant="secondary"
            className="w-fit"
          >
            {story.stream}
          </Badge>
        )}
        <h3 className="font-semibold group-hover:underline">{story.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{story.excerpt}</p>
      </div>
    </Link>
  );
}

export { StoryCard };
