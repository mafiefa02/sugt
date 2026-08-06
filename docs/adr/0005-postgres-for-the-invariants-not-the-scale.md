# Managed Postgres, chosen for the invariants rather than the scale

Programme data lives in a managed Postgres instance, with receipts, scans and photos in object storage. The specific vendor is not yet chosen.

## Why

At this size — around 42 Schools, ten Sessions each, a few dozen users — nothing would be too slow, so scale is not the reason. The domain is unusually rule-heavy for its volume: one PIC per Perjadin, at least one Teaching Team member per Stream, all three Classes taught at every Session, six parts to a Session Record, four offline and six online Sessions per School. Those invariants are the substance of the system, and a relational database enforces them at the point of writing rather than leaving every one of them to application code.

## Considered options

- **The existing spreadsheet as source of truth.** No migration and no retraining. Rejected: it cannot enforce any of the rules above, and the Group composition rule from the interview becomes unimplementable.
- **Firestore.** Pairs neatly with the Google sign-in in [ADR-0003](./0003-google-sign-in-with-an-invite-list.md) and covers file storage on the same platform. Rejected for the same reason — the invariants would all move into application code.
- **SQLite (Turso/libSQL).** Ample for the volume and cheaper to run, still relational. A reasonable fallback if Postgres hosting proves awkward.

## Note

No prior system holds this data. Schools are already fixed and will not change; Clusters and Topics are not yet confirmed but will not change once set. All three are reference data seeded once, not records with an editing lifecycle — so they need a migration, not admin screens.
