import { FeedbackView } from "-/components/feedback-view";
import { requirePerson } from "-/lib/person";
import {
  NO_FEEDBACK_FILTERS,
  participantFeedbackAverages,
  participantFeedbackPage,
} from "@sugt/db/queries";

/**
 * **Feedback** — what Participants said about the Sessions they sat in. The Peserta tab lists
 * every submission, newest first, filtered and paged in the browser through a Server Action.
 *
 * One `requirePerson()` and no role check: feedback carries no money, so ADR-0004 opens it to
 * everyone signed in — the same stance as Concerns beside it. Two reads on the server for the
 * first paint: the first page of the unfiltered list, and the dataset-wide averages the three
 * summary cards show. Everything after that first paint is the client's, via the action.
 *
 * (The Perjadin tab and retiring `/concerns` are a blocked follow-up, so only Peserta renders
 * here — no dead Perjadin tab, #168.)
 */
export default async function Page() {
  const person = await requirePerson();
  const [firstPage, averages] = await Promise.all([
    participantFeedbackPage(person, { filters: NO_FEEDBACK_FILTERS, cursor: null }),
    participantFeedbackAverages(person),
  ]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border px-7 py-5">
        <h1 className="font-heading text-lg font-medium">Feedback</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Masukan Peserta atas setiap Sesi, terbaru dulu. Saring berdasarkan nilai untuk menemukan
          yang perlu diperhatikan.
        </p>
      </header>

      <FeedbackView
        initialRows={firstPage.rows}
        initialCursor={firstPage.nextCursor}
        averages={averages}
      />
    </div>
  );
}
