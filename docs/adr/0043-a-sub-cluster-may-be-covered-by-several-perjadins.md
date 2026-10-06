# A Sub-Cluster may be covered by several Perjadins

A **Sub-Cluster** is no longer read as "exactly one journey". It bounds which Schools one Perjadin
may combine, and **one Sub-Cluster may be covered by one Perjadin or by several**, on the same dates
or different ones. A Perjadin still goes to **exactly one** Sub-Cluster, and every School on it
belongs to that Sub-Cluster. The same School may sit on several Perjadins, but never twice at the
same date and start time.

Settled with the product owner on 2026-10-06
([#406](https://github.com/sugt-itb/sugt-itb-26/issues/406)).

## Why

The Schools of one Sub-Cluster cannot always be scheduled close together. A Sub-Cluster has three
Schools: two of them can be visited on Monday and Tuesday, but the third only on the following
Monday. That is two journeys for one Sub-Cluster, so two Perjadins.

**The data already allowed it.** There is no unique constraint on `perjadin.sub_cluster_id`;
`/perjadin/baru` keeps only the Schools given a Session; the same School can have Sessions on two
trips; and `addPerjadinSession` adds a School to an existing trip. What was missing was the word for
it — the glossary called a Sub-Cluster one journey — and a way to tell the two trips apart, which
[ADR-0044](./0044-a-perjadin-is-named-by-its-kelompok-and-dates.md) gives.

## Considered options

- **One Perjadin per Sub-Cluster, stretched over both weeks.** Rejected: a Perjadin is one journey,
  with one Advance, one Group and one Report deadline counted from its end. A trip that spans a week
  at home misstates all three.
- **A Perjadin spanning Sub-Clusters.** Rejected: a Perjadin is still one journey's worth of Schools.
  The Sub-Cluster is exactly the bound on which Schools can share a journey; letting a trip cross it
  removes the only thing the grouping is for.
- **Several Perjadins per Sub-Cluster (chosen).** It is what the data model already permits; this
  ADR makes it the stated rule.

## Consequences

- **Names must tell trips apart.** Two trips of one Kelompok used to show the same `destination`
  line on every screen and could get identical Drive folder names. ADR-0044 names a Perjadin by its
  Kelompok and dates, adds the trip's Schools as a second line, and puts a `P-` id in its Drive
  folder name.
- **The Sub-Cluster rule is checked in two writes, not one.** Planning (`planPerjadin`) and adding a
  Session (`addPerjadinSession`) both refuse a School outside the trip's Sub-Cluster.
  [ADR-0016](./0016-sub-clusters-are-editable-because-nobody-allocated-them.md)'s "the only place it can be
  violated" is amended accordingly.
- **No double-booking across trips, and a note of what is already covered**, are follow-up tickets
  ([#408](https://github.com/sugt-itb/sugt-itb-26/issues/408),
  [#409](https://github.com/sugt-itb/sugt-itb-26/issues/409)). The cap of two offline Sessions per
  School is still not enforced.

## Amendment (2026-10-06): Consequence: the double-booking guard

[#408](https://github.com/sugt-itb/sugt-itb-26/issues/408). "Never twice at the same date and start
time" is now held by the database across every Perjadin. `session_no_duplicate_offline_per_school`,
on `(school_id, held_on, starts_at)` and partial on `status <> 'cancelled' and perjadin_id is not
null`, replaces the per-trip `session_no_duplicate_offline_per_school_per_perjadin`, whose key led
with `perjadin_id` and so let two trips book one School at one moment unnoticed. Only an exact match
on date and start time collides. Planning a trip, and adding, editing or moving a Session, read the
slot first, so a double-booking is refused with a sentence that names and links the other trip — and
a race past that read gets the same sentence. Two **different** Schools at one moment stays an
application rule **per trip**: two Groups can be in two places at once.
