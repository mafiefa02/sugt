import type { StoryKind } from "@sugt/domain";

/**
 * **How a Story's kind reads on screen, in one place.**
 *
 * The domain terms are English (`field`, `final_project`) and the site is Indonesian
 * (`CONTEXT.md` § Language), so this is the translation at the edge — typed against `StoryKind` so a
 * kind added to the domain fails the build here until it has a label. A `field` Story is a Cerita
 * Lapangan; a `final_project` Story is a Final Project piece.
 */
export const STORY_KIND_LABELS: Record<StoryKind, string> = {
  field: "Cerita Lapangan",
  final_project: "Final Project",
};
