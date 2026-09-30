import type { StoryKind, Stream } from "@sugt/domain";

/**
 * **How a Story's kind and Stream read on screen, in one place.**
 *
 * The domain terms are English (`field`, `final_project`) and the site is Indonesian
 * (`CONTEXT.md` § Language), so this is the translation at the edge — typed against `StoryKind` so a
 * kind added to the domain fails the build here until it has a label. A `field` Story reads Cerita —
 * the same word as Story itself, deliberately; a `final_project` Story is a Final Project piece.
 */
export const STORY_KIND_LABELS: Record<StoryKind, string> = {
  field: "Cerita",
  final_project: "Final Project",
};

/**
 * **How a Story's Stream reads on screen.** A `null` Stream is not missing — it means the Story is
 * about both Streams — so it reads STEM & Research rather than rendering no badge at all.
 */
export function streamLabel(stream: Stream | null): string {
  return stream ?? "STEM & Research";
}
