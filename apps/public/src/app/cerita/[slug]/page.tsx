import { Band } from "-/components/band";
import { Prose } from "-/components/prose";
import { StoryGallery } from "-/components/story-gallery";
import { StoryImage } from "-/components/story-image";
import { STORY_KIND_LABELS } from "-/components/story-labels";
import { getStories, getStory } from "-/lib/aggregates";
import { StoryBody } from "@sugt/story-format/story-body";
import { Badge } from "@sugt/ui/components/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@sugt/ui/components/breadcrumb";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * **One Story** — the shared detail template for both kinds.
 *
 * A field Story and a Final Project piece are one table, one editor and one detail page; only the
 * lists that reach them differ (`/cerita` and `/final-project`). The revalidation contract also names
 * every detail `/cerita/${slug}`, so this is the one route the internal app refreshes on publish.
 *
 * The body renders through `StoryBody`, whose allowlist is the editor's schema (ADR-0015). A `null`
 * from `getStory` — a draft, a withdrawal, a stale link — is a 404, not a build failure; a down origin
 * still throws (`./lib/aggregates.ts`). `generateStaticParams` prebuilds every published slug.
 */
export const revalidate = 3600;

export async function generateStaticParams() {
  const { stories } = await getStories();
  return stories.map((story) => ({ slug: story.slug }));
}

export async function generateMetadata({ params }: PageProps<"/cerita/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStory(slug);
  return { title: story?.title ?? "Cerita" };
}

export default async function Page({ params }: PageProps<"/cerita/[slug]">) {
  const { slug } = await params;
  const story = await getStory(slug);
  if (story === null) notFound();

  const backHref = story.kind === "final_project" ? "/final-project" : "/cerita";

  return (
    <>
      <Band className="py-16">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={backHref}>{STORY_KIND_LABELS[story.kind]}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{story.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        {story.stream !== null && (
          <Badge
            variant="secondary"
            className="mt-4"
          >
            {story.stream}
          </Badge>
        )}
        <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight text-balance">
          {story.title}
        </h1>
      </Band>

      {story.coverUrl !== null && (
        <Band>
          <StoryImage
            url={story.coverUrl}
            alt={story.title}
            className="aspect-[16/9] rounded-lg"
          />
        </Band>
      )}

      <Band>
        <Prose>
          <StoryBody markdown={story.body} />
        </Prose>
      </Band>

      {story.gallery.length > 0 && (
        <Band>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">Dokumentasi</h2>
          <div className="mt-6">
            <StoryGallery photos={story.gallery} />
          </div>
        </Band>
      )}
    </>
  );
}
