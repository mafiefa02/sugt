import { cn } from "@sugt/ui/lib/utils";
import Image from "next/image";

/**
 * **A Story photograph — a cover or a gallery frame.**
 *
 * The URL is a full Supabase public-bucket URL the aggregates payload already resolved, so this
 * renders it through `next/image` (the host is allowed in `next.config.ts`). `fill` with an
 * `object-cover` frame means the caller sets the aspect ratio through `className` and the image
 * covers it, whatever its own dimensions — the payload carries no width or height. A caller with a
 * `null` cover renders something else; this component always has an image.
 */
function StoryImage({
  url,
  alt,
  className,
  sizes = "(min-width: 1120px) 1120px, 100vw",
}: {
  url: string;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <Image
        src={url}
        alt={alt}
        fill
        sizes={sizes}
        className="object-cover"
      />
    </div>
  );
}

export { StoryImage };
