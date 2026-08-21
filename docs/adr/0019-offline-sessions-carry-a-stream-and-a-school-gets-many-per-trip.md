# Offline Sessions carry a Stream and a School gets many per trip

An offline **Session** now carries an **Aliran (Stream)** — STEM or Research — and a School may have
**several** offline Sessions on one Perjadin, each single-Stream, on its own date and start time. The
distinction between STEM and Research is no longer a property of who teaches; it is a property of the
Session. One Session can be Research, the next STEM, and the same people may teach both.

This reverses the shape recorded through most of `CONTEXT.md` and `data-model.md`, where a Session was
"one teaching occasion at one School at which all three Classes are taught," both Streams present, one
per School per Perjadin. That shape is kept **for online Sessions only** — this decision is scoped to
offline/Perjadin Sessions.

## Why

A School's participants are too many for one room, so a class period is split into **parallel rooms
running at the same time** — same topic, same Stream — each staffed by a different teaching-team
member. The old model had no way to say "this occasion was Research, taught by these four in parallel."
A Stream on the Session, plus a set of teachers per Session ([ADR-0020](./0020-teaching-team-members-on-a-perjadin-are-trip-scoped-names.md)),
says it.

## Consequences

- **`session.stream` is set for offline, null for online** — a CHECK mirrors the existing
  `mode`/`perjadin_id` equivalence: `(mode = 'offline') = (stream is not null)`.
- **`session_one_per_school_per_perjadin` is dropped.** Many offline Sessions per School per trip is
  now the point, not a collision.
- **`session_one_school_at_a_time_per_perjadin` is relaxed to be permissive.** Two Sessions at the
  _same_ School and the _same_ moment are allowed (parallel Streams); two Sessions at _different_
  Schools at the same moment stay forbidden — the Group is one travelling party and cannot be in two
  places. The old unique index on `(perjadin_id, held_on, starts_at)` cannot express that and is
  replaced.
- **The "ten Sessions per School (four offline + six online)" invariant and the `delivered / 10`
  progress metric no longer hold for the offline half.** Redefining that metric is deliberately
  **out of scope here** and is its own follow-up — see the open question added to `CONTEXT.md`. Online
  progress (six per School) is untouched.
- **`session_teacher` is scoped to online Sessions only.** Offline Sessions record who taught through
  the name-based link in [ADR-0020](./0020-teaching-team-members-on-a-perjadin-are-trip-scoped-names.md),
  not through the Person-based `session_teacher` table.
- **Offline Class Records fall out of scope** as a consequence, because their filers are no longer
  People — again see [ADR-0020](./0020-teaching-team-members-on-a-perjadin-are-trip-scoped-names.md)
  and the `CONTEXT.md` open question.
- A safety cap of **10 offline Sessions per School per Perjadin** is enforced in the application, the
  way the other Group caps are, not in the database. Ten is practically unreachable; the real maximum
  is six or seven.
