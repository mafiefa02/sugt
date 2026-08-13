# Sub-Clusters are editable, because nobody allocated them

Offline travel is planned around a **Sub-Cluster** — a set of Schools inside one Cluster close enough to be reached on one journey — rather than around Schools picked one at a time. A Sub-Cluster is seeded like the rest of the reference data, and unlike the rest of it, Staff can edit it: create one, rename one, and move Schools between them. That is a deliberate exception to a rule this repo had already written down twice, and this records why the exception is narrow rather than the rule being wrong.

## The rule being excepted

[`product.md`](../product.md) says there are **no admin screens for Schools, Clusters or Topics**, and [`data-model.md`](../data-model.md) scopes its whole reference-data section the same way: seeded by migration, no editing lifecycle. [ADR-0013](./0013-people-are-added-in-the-tool-and-their-role-is-write-once.md) already carved out `person` and was careful to say why that did not generalise — _"People are not reference data."_

A Sub-Cluster **is** reference data by every structural test. It is a small fixed-ish set, it is seeded, it has a slug, Schools point at it. So the ADR-0013 escape route is not available here, and the rule has to be restated rather than dodged.

## What the rule was actually about

Every noun the rule names — School, Cluster, Topic, Province — has one thing in common that "reference data" does not capture: **DITSAMA was given it.** Kementerian Pendidikan Tinggi allocated the Clusters and their Topics; the Schools are the Programme's participants; the Provinces are the Republic's. The tool's job for all four is to reflect a fact decided elsewhere, and an edit screen over them would be an invitation to disagree with the source. That is the real principle, and "no admin screens for reference data" was a shorthand for it that held only as long as every piece of reference data happened to be allocated.

**Nobody allocated the Sub-Clusters.** They are DITSAMA's own judgement about which Schools are near enough to visit on one trip. Nothing external says whether two Schools four hours apart on the same island are one journey or two — the answer depends on roads, flights, and what the team learns after doing it once. A judgement is precisely the kind of fact that turns out wrong, and the first Perjadin is what teaches you it was.

So the rule is not weakened. It is stated at the altitude it was always meant to hold at: **reference data DITSAMA was given has no admin screen; reference data DITSAMA invented does.** As it happens the Sub-Cluster is the only thing on the second side of that line, and it should stay lonely — if a future concept lands there, it earns its screen by the same argument, not by being adjacent to this one.

## Why not a seed file, given everything else is one

The same argument [ADR-0013](./0013-people-are-added-in-the-tool-and-their-role-is-write-once.md) makes for the People screen, and it lands harder here. Maintaining Sub-Clusters the way `reference-data.sql` maintains Schools makes every regrouping a commit and a deploy by the single developer. The difference from Schools is what triggers the change: a School's row changes when the Programme's participants change, which is never; a Sub-Cluster's changes when somebody comes back from a trip having learnt that the road is impassable in the wet season. The first is a fact to reflect, the second is feedback to capture, and putting feedback behind a deploy is how it stops being captured.

## Why the first rows are still seeded

Unlike the People seed, this is not a bootstrap breaking a cycle — nobody is locked out of the app by an empty `sub_cluster` table. It is seeded because `school.sub_cluster_id` is **NOT NULL** and there are forty-two Schools. Shipping the migration without the seed would mean no Perjadin could be planned at all until somebody hand-assigned every School through a screen, which is a bad first day and a strong temptation to make the column nullable instead. The seed exists to make NOT NULL affordable.

The initial groupings are DITSAMA's to supply. They are judgement, and a plausible-looking set invented by whoever wrote the migration would be indistinguishable on screen from a real one.

## What it costs: a rule that cannot be a foreign key

This is the part worth knowing before anyone tries to tighten the schema.

"Every School a Perjadin teaches at belongs to that Perjadin's Sub-Cluster" is a real rule, and it is enforceable declaratively — denormalise `sub_cluster_id` onto `session`, then make `(school_id, sub_cluster_id) → school` and `(perjadin_id, sub_cluster_id) → perjadin` composite foreign keys, the same trick that already makes "the PIC is Staff" unbreakable through `person (id, role)`. It was designed that way first.

**Editability is what kills it.** Those keys default to `NO ACTION`, so Postgres would refuse to move a School between Sub-Clusters while any Session referenced the old pairing — including delivered ones. Every School has four offline Sessions, so each would be frozen into its original Sub-Cluster by its first completed trip, and the screen this ADR exists to justify would stop working part-way through the Programme. `on update cascade` is not the answer, for the reason ADR-0013 gives when it rejects the same escape for `person.role`: it rewrites history, making a past Perjadin claim it travelled somewhere it did not — and here it fails mechanically too, because the trip's own Sub-Cluster does not move with the School, so the cascade violates the other half of the pair.

The general shape: **a mutable grouping cannot be a key into immutable history.** Choosing editability means choosing that this rule lives in the application, and it does — checked when a trip is planned, which is the only place it can be violated, since there is no write that adds a School to an existing Perjadin. Its mirror is checked on the other side: moving a School is refused while an _arranged_ Session at it sits on a Perjadin against the Sub-Cluster it is leaving. Delivered and cancelled Sessions never block a move, which is the whole point.

## Consequences

- One more Staff-only screen, and the first admin surface over something in `data-model.md`'s reference-data section. `product.md`'s "no admin screens for Schools, Clusters or Topics" stays literally true — none of those three gets one.
- **Two rules move out of the database and into `@sugt/db`**, joining `heldOnWithinPerjadin` in [what the database does not hold](../data-model.md#what-the-database-does-not-hold). Both are cheap for the reason the others there are: every write path goes through one package, and the constraint trigger stays available if raw SQL ever produces a row they refuse.
- **Deleting a Sub-Cluster is declaratively blocked while it holds Schools**, free, from `school.sub_cluster_id` being NOT NULL with the default `NO ACTION`. Emptying it first is the only route — which is what keeps "every School belongs to exactly one Sub-Cluster" true without inventing an unassigned state to represent on screens.
- A `slug` on `sub_cluster`, as everywhere else here, so the seed stays re-runnable with `on conflict (slug) do update`. Note the consequence: **the seed is authoritative for the rows it names.** Re-running it after somebody has renamed a Sub-Cluster in the screen reverts that rename, exactly as it would for a School — the seed is not a floor, and a Sub-Cluster created through the screen has no slug conflict and survives.
