# Participant Feedback has a comment per Aspect, not one shared comment

Participant Feedback Rates three Aspects — **Materials**, **Instructor**, **Relevance** — and now
carries one optional comment against each of them, in `materials_comment`, `instructor_comment`
and `relevance_comment`. It began with a single `comment` column shared across the three. This
records why that was reversed, and why the reversal is narrow.

## What the single comment could not say

The one query the whole Rating design exists to serve is the concerns list: every Aspect anyone
Rated at or below the threshold, newest first, so a Cluster's problems are visible without opening
thirty Sessions ([`data-model.md`](../data-model.md), "The concerns list in full"). A concern is
one low Aspect with the prose written about it — an internal filer's mandatory explanation, or a
Participant's optional comment.

With one shared `comment`, a Participant who Rated `instructor` a 3 and `materials` a 9 and wrote
"the room had no projector" produced a concern row on `instructor` carrying a comment that was
plainly about the facilities. The prose and the Rating it sat beside were about different subjects,
and the list had no way to tell. A single comment cannot say which of three Aspects it explains, so
pairing it with any one of them is a guess — and the concerns list showed that guess as if it were
attribution.

## The reversal

`CONTEXT.md` had glossed Participant Feedback as carrying "a comment". That is the line this change
reverses: it is now "a comment on each of the three Aspects." Each comment belongs to the Rating it
explains, so the concerns list shows the prose for the Aspect that was actually Rated low — or
none, when that box was left blank.

The concerns query expresses this by unpivoting each Participant Feedback row into
`(aspect, rating, said)` triples — `('instructor', f.instructor, f.instructor_comment)`, and so on
— where the other three sources unpivot into `(aspect, rating)` pairs and select a single shared
`problems`/`comment` for `said`. The Participant branch is the one source whose prose is per-Aspect,
because it is the one source with more than one Rating per row **and** optional prose per Rating.

## What is deliberately unchanged

- **The no-elaboration rule still does not reach Participants.** All three comments are nullable and
  none is ever required; the `CHECK` forcing prose on a low Rating remains on `class_record` and
  `session_record` only. A Participant owes nothing, and a low Rating with no comment still submits.
  Splitting one optional column into three optional columns changes what a comment is _about_, not
  whether one is owed.
- **The three Ratings, the self-typed `name`, the token/QR flow, and the "indicative, not a census"
  stance** are untouched.

## The cost, and why it is accepted

There is no backfill. The column is nullable, `participant_feedback` has no seed rows, and no
delivery has happened yet, so no real feedback is lost — but the migration does `DROP COLUMN
"comment"`, so any pre-existing free-text comment would be dropped rather than migrated. That is
correct precisely because of the problem above: an old shared comment cannot be attributed to one
Aspect, so there is no right column to move it into. Dropping it is the honest outcome of admitting
it was never attributable.

The form grows from one comment box to three, one under each Aspect's rating row. That is more to
fill on a phone in a classroom, but every box is optional and labelled by its subject ("Komentar
Materi"), so a Participant who wants to explain one low score writes one sentence and leaves the
rest empty — the common case stays cheap.
