# Managed Postgres, chosen for the invariants rather than the scale

Programme data lives in a managed Postgres instance, with receipts, scans and photos in object storage.

> **Amended.** The vendor is Supabase Pro, with both apps deployed to Vercel — see [ADR-0011](./0011-supabase-and-better-auth.md), which also records why sign-in is Better Auth rather than Supabase Auth and why access control is not RLS.
>
> The invariants listed below are enforced in the database as this ADR intends, with two corrections.
>
> **"Six parts to a Session Record" reads differently now, though the count survives.** A Session expects six Class Records — two professors, one per Stream, each filing for all three Classes — but the unit is the filer rather than the teaching thread, and the PIC files a separate Session Record about the visit instead. The argument for a relational database is unaffected, and the new shape adds rules a CHECK does hold: that a Rating of 7 or below cannot be filed without an explanation, that every Aspect is Rated, and — via composite foreign keys into `person (id, role)` — that only Teaching Team file Class Records and only Staff file Session Records.
>
> **Two rules turned out to be inexpressible**, both for the same underlying reason: they are counts or memberships across rows that no CHECK can see. "At least one Teaching Team member per Stream" is validated where a Group is submitted whole. "Only the Group that travelled may file a Perjadin Evaluation" is validated where the evaluation is written, because the composite foreign key that would enforce it is incompatible with replacing a Group wholesale — verified, and recorded in the data model.
>
> The schema, and an honest list of everything it does not hold, are in [`docs/data-model.md`](../data-model.md).

## Why

At this size — around 42 Schools, ten Sessions each, a few dozen users — nothing would be too slow, so scale is not the reason. The domain is unusually rule-heavy for its volume: one PIC per Perjadin, at least one Teaching Team member per Stream, all three Classes taught at every Session, six parts to a Session Record, four offline and six online Sessions per School. Those invariants are the substance of the system, and a relational database enforces them at the point of writing rather than leaving every one of them to application code.

## Considered options

- **The existing spreadsheet as source of truth.** No migration and no retraining. Rejected: it cannot enforce any of the rules above, and the Group composition rule from the interview becomes unimplementable.
- **Firestore.** Pairs neatly with the Google sign-in in [ADR-0003](./0003-google-sign-in-with-an-invite-list.md) and covers file storage on the same platform. Rejected for the same reason — the invariants would all move into application code.
- **SQLite (Turso/libSQL).** Ample for the volume and cheaper to run, still relational. A reasonable fallback if Postgres hosting proves awkward. Keeping this fallback affordable is part of why [ADR-0011](./0011-supabase-and-better-auth.md) puts identity in Better Auth rather than Supabase Auth.

## Note

No prior system holds this data. Schools are already fixed and will not change; Clusters and Topics are not yet confirmed but will not change once set. All three are reference data seeded once, not records with an editing lifecycle — so they need a migration, not admin screens.
