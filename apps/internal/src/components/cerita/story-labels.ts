import type { StoryKind, Stream } from "@sugt/domain";

/**
 * **How a Story's kind and Stream read on screen, in one place** — shared by the `/cerita` index
 * badges and the editor's pills. A `field` Story reads Cerita, the same word as Story itself,
 * deliberately. A `null` Stream is a real choice, not a blank — it means the Story is about both
 * Streams — so it reads STEM & Research.
 */
export const STORY_KIND_LABELS: Record<StoryKind, string> = {
  field: "Cerita",
  final_project: "Final Project",
};

export function streamLabel(stream: Stream | null): string {
  return stream ?? "STEM & Research";
}
