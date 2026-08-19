import { StoryImage } from "-/components/story-image";
import type { StoryGalleryPhoto } from "-/lib/aggregates-types";

/**
 * **A Story's Dokumentasi gallery** — every photograph, in the order the payload gives them (by
 * `uploaded_at`, tie-broken by id; there is no author ordering, ADR-0015's amendment). Photographs
 * live here and never inside the body, which is why the body renderer omits the image node. A caption
 * shows under a frame that has one.
 */
function StoryGallery({ photos }: { photos: StoryGalleryPhoto[] }) {
  if (photos.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {photos.map((photo) => (
        <figure key={photo.url}>
          <StoryImage
            url={photo.url}
            alt={photo.caption ?? ""}
            className="aspect-[3/2] rounded-lg"
            sizes="(min-width: 640px) 540px, 100vw"
          />
          {photo.caption !== null && (
            <figcaption className="mt-2 text-sm text-muted-foreground">{photo.caption}</figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

export { StoryGallery };
