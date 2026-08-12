import { requirePerson } from "-/lib/person";
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

/**
 * Placeholder, and deliberately two things at once until the screens that replace it
 * arrive. **A greeting is not a dashboard** — the two real ones are issue #40, Coverage
 * is #25, and the rest of the eighteen internal surfaces each belong to their own spec.
 *
 * The greeting shows what auth produces: a Person with a name, and a `role` a Staff-only
 * surface can branch on. The specimens below are the only place `Rating` and
 * `RatingInput` are currently rendered, so they stay until a real form carries them.
 */

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

export default async function Home() {
  const person = await requirePerson();

  return (
    <div className="p-8">
      <h1 className="font-heading text-lg font-medium">Halo, {person.fullName}.</h1>
      <p className="text-sm text-muted-foreground">
        {STREAMS.join(" · ")} — {TOTAL_SESSIONS_PER_SCHOOL} sesi per sekolah
      </p>
      {person.role === "Staff" && (
        <p className="text-sm text-muted-foreground">
          Anda masuk sebagai Tim DITSAMA, jadi layar khusus Staff terbuka untuk Anda.
        </p>
      )}

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
