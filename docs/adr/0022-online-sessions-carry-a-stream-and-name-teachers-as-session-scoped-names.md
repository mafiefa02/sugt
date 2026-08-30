# Online Sessions carry a Stream and name their teachers as session-scoped free-text names

An **online Session** is now **single-Stream** — it carries one `stream`, STEM or Research, exactly
like an offline Session has since [ADR-0019](./0019-offline-sessions-carry-a-stream-and-a-school-gets-many-per-trip.md) —
and names its teachers as **plain names entered on the Session**, capped at ten, not a selection of
**`person`** rows. They are not invited, hold no sign-in and are not `session_teacher` rows. Each
online Session's names live in a new `session_teacher_name` table, scoped to that one Session. This
is the online mirror of [ADR-0020](./0020-teaching-team-members-on-a-perjadin-are-trip-scoped-names.md),
which made the offline/Perjadin teaching team trip-scoped names.

This ticket is the **write path and the model**. `session_teacher` and the `person` role
`'Teaching Team'` are **left in place** — nothing this ticket writes touches them — and their
retirement is **T3**. Editing an online Session on `/sesi-daring/[id]` is **T2**.

## Why

The professors who teach online, like the ones who teach offline, are external to DITSAMA and will
not sign in to the tool. Modelling them as People — the invite list — required an email
(`person.email` is `NOT NULL`) and implied they could authenticate and file records, neither of
which is true. This was already wrong offline, and it was wrong online for the same reasons; ADR-0020
fixed the offline half and left the online half as the one place Person-based teachers survived.

Making the online Session single-Stream is the same move ADR-0019 made offline: the STEM/Research
split is a property of the Session, not of who teaches it. An online Session that "taught both
Streams" carried the split in its two `session_teacher` rows; once the teachers are names rather
than one-per-Stream Persons, the Session has to carry its own Stream, so a School holds one STEM and
one Research online Session on a date rather than one Session teaching both.

## Considered options

- **A two-table split mirroring offline** — an online analogue of `perjadin_teacher` +
  `session_teaching_team`. Rejected: offline names are scoped to the _trip_ and linked to the
  Sessions that used them, so the two tables express "a name on the trip" and "who taught this
  Session" separately. An online Session has no Perjadin, so a name belongs to the one Session and
  nothing else — the split has nothing to express.
- **Session-scoped names in one table (chosen).** A `session_teacher_name` row is a name on one
  online Session, cascading with it. No Stream (the Session carries its own) and no Person.

## Consequences

- **`stream` is now required for both modes.** The old CHECK `session_offline_iff_stream` —
  `(mode = 'offline') = (stream is not null)` — is replaced by `session_stream_not_null`, plain
  `stream is not null`. Stream no longer tells you the mode; `mode`/`perjadin_id` still do.
- **The online uniqueness index widens to include Stream.** `session_one_online_per_school_per_day`
  keys on `(school_id, held_on, stream)`, so a School may hold a STEM and a Research online Session
  on one date; only a second Session of the _same_ Stream collides. The partial predicate
  (`perjadin_id is null and status <> 'cancelled'`) is unchanged.
- **The count of online Sessions per School is unchanged — still six** — and so is online progress
  (`delivered / TOTAL_SESSIONS_PER_SCHOOL`). What changes is that a School's six are now single-Stream
  rather than each teaching both Streams. How online Class Records and their counts follow from this
  is **deferred with the offline open question** in `CONTEXT.md`, not settled here.
- **`session_teacher` and the `'Teaching Team'` Person role live on for now, but the write path no
  longer creates either.** `arrangeOnlineSession` writes `session_teacher_name` and touches
  `session_teacher` not at all. Dropping `session_teacher` and retiring the role — the last thing
  that kept it — is **T3**.
- **The cap is app-enforced**, like ADR-0020's: `MAX_TEACHING_TEAM_PER_ONLINE_SESSION` is a safety
  ceiling the database does not hold, refused as a value before the write.
