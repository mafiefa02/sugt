import {
  CONCERN_AT_OR_BELOW,
  RATING_MAX,
  RATING_MIN,
  STREAMS,
  TOTAL_SESSIONS_PER_SCHOOL,
  type ClassRecordAspect,
  type ParticipantFeedbackAspect,
} from "@sugt/domain";
import { Rating } from "@sugt/ui/components/rating";
import { RatingInput } from "@sugt/ui/components/rating-input";

// Placeholder. The Dashboard is issue #40 and Coverage is #25; this page exists so the
// app builds and so the shell has something beside it.
//
// The Ratings below are the boundary this app is on the near side of. `RATING_MIN`,
// `RATING_MAX` and `CONCERN_AT_OR_BELOW` live in `@sugt/domain`, which `@sugt/ui` may
// not import, so an app reads them and passes them down. There are no defaults to fall
// back on — see `packages/ui/README.md`.
const BOUNDS = {
  min: RATING_MIN,
  max: RATING_MAX,
  concernAtOrBelow: CONCERN_AT_OR_BELOW,
};

const SPECIMEN = [4, 7, 9] as const;

// An Aspect is an English column and an Indonesian label — see the Aspect labels table
// in `docs/design/system/readme.md`. The column is what a form posts; the label is what
// a reader, or a screen reader, gets. Each rubric's full table belongs to the form that
// carries it, so only the three shown here are named. The `satisfies` clause is what
// keeps a column name from drifting off the domain's lists.
const ASPECT_SPECIMEN = [
  { name: "comprehension", label: "Pemahaman", size: "default" },
  { name: "participation", label: "Partisipasi", size: "default" },
  { name: "relevance", label: "Relevansi", size: "sm" },
] as const satisfies readonly {
  name: ClassRecordAspect | ParticipantFeedbackAspect;
  label: string;
  size: "default" | "sm";
}[];

export default function Home() {
  return (
    <div className="p-8">
      <h1 className="text-lg font-medium">SUGT Internal</h1>
      <p className="text-sm text-muted-foreground">
        {STREAMS.join(" · ")} — {TOTAL_SESSIONS_PER_SCHOOL} sesi per sekolah
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {SPECIMEN.map((value) => (
          <div
            key={value}
            className="flex items-center gap-6"
          >
            <Rating
              {...BOUNDS}
              value={value}
              label="Pemahaman"
            />
            <Rating
              {...BOUNDS}
              value={value}
              variant="compact"
            />
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {ASPECT_SPECIMEN.map((aspect) => (
          <RatingInput
            key={aspect.name}
            {...BOUNDS}
            name={aspect.name}
            size={aspect.size}
            aria-label={aspect.label}
          />
        ))}
      </div>
    </div>
  );
}
