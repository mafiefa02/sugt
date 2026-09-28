# Offline Sessions carry no Stream, and parallel rooms are one Session

An **offline Session** no longer carries an **Aliran (Stream)**. `session.stream` is dropped, with
`session_stream_check` and `session_offline_stream_not_null`; since
[ADR-0034](./0034-online-sessions-are-no-longer-single-stream.md) already left online Sessions without
one, **no Session carries a Stream** any more. With the Stream gone, the offline duplicate guard
narrows: `session_no_duplicate_offline_per_school_per_perjadin` keys on `(perjadin_id, school_id,
held_on, starts_at)`, still partial on `status <> 'cancelled'` — **one live offline Session per School
per date and start time on a trip**. Parallel rooms are recorded as **one** Session whose Teaching
Team lists everyone who taught.

This **supersedes the Stream half of [ADR-0019](./0019-offline-sessions-carry-a-stream-and-a-school-gets-many-per-trip.md)**
and reverses its "two Sessions at the _same_ School and the _same_ moment are allowed". The rest of
ADR-0019 stands: a School still gets **many** offline Sessions per trip, each on its own date and start
time, under the app-level ten-per-School ceiling; two _different_ Schools still cannot share a moment.

## Why

The material taught in a Session is not specific to the STEM or the Research stream; it is a
combination of both. So a Session has no Stream to record, and asking for one on `/perjadin/baru` and
on the `/perjadin/[id]` dialog made Staff pick a value that described nothing.

Once the Stream is gone, two live Sessions at one School, date and start time would differ by nothing
the row records. ADR-0019 allowed that pair because the Stream told them apart (a STEM room and a
Research room at the same hour). Without it, the pair is either a mistake or two rooms of one
occasion — and the second is exactly what a Session's Teaching Team
([ADR-0020](./0020-teaching-team-members-on-a-perjadin-are-trip-scoped-names.md)) already records: the
set of names who taught its parallel rooms.

## The decision

- **Only `session.stream` goes.** Stream survives as a Programme concept: `STREAMS` / `Stream` in
  `@sugt/domain`, `assessment_completion.stream` (pretest and the Dashboard assessment grid),
  `story.stream` (Cerita and the public app) and `group_member.stream` are untouched.
- **Existing values are dropped, not preserved.** The STEM/Research values recorded on offline
  Sessions are thrown away with the column; nothing read them except the surfaces this removes.
- **The duplicate guard narrows and does not disappear.** At most one live offline Session per School
  per date and start time in a Perjadin. The index keeps its name and its partial predicate, so a
  **cancelled Session never blocks its slot**.
- **Every write that can hit the index answers with a readable Indonesian message**, never a raw
  violation: planning returns a typed `duplicate-session` refusal naming each slot (and the form
  flags the repeated row before submit); adding or editing a Session on `/perjadin/[id]` returns
  `duplicate-session`; moving a Session's date returns `collided` naming the offline index.

## Consequences

- **The narrowed index needs the data to already be unique.** ADR-0019 permitted a STEM and a Research
  Session at the same School and moment, so a populated database may hold a live pair the narrowed
  index would refuse. Unlike migration 0028 (ADR-0034), migration **0032 resolves nothing itself**:
  merging or cancelling a real Session is a human's call. It looks for those pairs first and, if any
  exist, **aborts with a message listing them** (perjadin id, school id, date, time) before anything is
  dropped. A human resolves the pairs and re-runs. Remote Supabase was checked before merge: no
  conflicting pairs.
- `MAX_OFFLINE_SESSIONS_PER_SCHOOL_PER_PERJADIN` still caps Sessions per School per trip; it now counts
  Sessions at distinct moments.
- It is **hard to reverse**: the recorded Stream values are gone. Reinstating a per-Stream offline
  model would need every Session's Stream re-entered by hand and the index widened again.
