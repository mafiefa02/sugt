# The Preparation Checklist is stored per level and frozen for finished Perjadins

A Perjadin's **Preparation Checklist** items are **rows in the database**, defined at three levels:
**Semua Perjadin**, one **Cluster**, or one **Perjadin**. Before this, the list was a constant in code,
the same six items for every trip. Only the ticks were stored
([ADR-0018](./0018-the-preparation-checklist-stores-ticks-and-derives-the-list.md) and its amendment).

Settled with the product owner on 2026-10-07
([#421](https://github.com/sugt-itb/sugt-itb-26/issues/421)).

## Why the list moved into the database

The company replaced its pre-departure checklist with 14 items of its own. It wants an
**Administrator** to adjust them for every Perjadin, for one Cluster, or for one Perjadin
(Pengaturan Perjadin, [#422](https://github.com/sugt-itb/sugt-itb-26/issues/422)), and wants
Pimpinan to follow the ticks week by week. A constant can be changed only by a deploy, and only for
every trip at once.

## Three levels; the most specific wins

- A **Semua** item applies to every Perjadin.
- A **Cluster** item applies to that Cluster's Perjadins. A Perjadin's Cluster is its Sub-Cluster's,
  so it is known before the trip has any Session.
- A **Perjadin** item applies to that one Perjadin.

For a Cluster or a Perjadin, a wider item may be **hidden** (left out there only) or **reworded**
(a wording used there only). The most specific level wins: a Perjadin's wording over its Cluster's,
and its Cluster's over the item's own. The order is Semua items first, then the Cluster's, then the
Perjadin's own, each level by its own position. A rewording never moves an item.

## A change does not reach a finished Perjadin

An add, a removal, a hide or a show-again at the **Semua or Cluster** level is **dated** with the
day it was made, in WIB. It reaches Perjadin P only if `P.ends_on` is that day or later:

- An item added on day A applies to P if `A <= P.ends_on`.
- An item removed on day R stops applying to P if `R <= P.ends_on`. So it still applies to every
  Perjadin that ended before R, with its ticks. Removing a Semua or Cluster item is therefore a
  dated soft-remove, not a delete.
- A Cluster hide is the same: each hide is its own row, from the day it was hidden to the day it was
  shown again. A Cluster may hide, show and hide an item again, and the rule stays a pure function of
  the dates.

A **Perjadin-level** change is undated and always applies to that Perjadin, finished or not.
Removing a Perjadin item deletes it, and its ticks with it.

**The freeze follows the trip's end date as it stands.** Nothing is copied onto a Perjadin when it
ends; its list is worked out from its `ends_on` each time it is read. So moving a trip's dates
(Ubah tanggal) re-decides which dated changes reach it. A finished trip moved to end after the
cutover shows the 14 instead of the old six, and its ticks on the six drop out of sight, kept in the
table. This ADR chooses that over snapshotting each list at the end date, because a date move is rare,
deliberate and made by Staff, and a snapshot would be a second copy of the list to keep in step. The
product owner has not ruled on it yet; it is raised on the pull request for #421.

**A wording change is not dated.** Rewording an item, at its own level or as a Cluster or Perjadin
wording, keeps it **the same item**: the same id, its ticks kept, counted as one item. The new
wording shows wherever the item applies, finished Perjadins included. Removing a wording restores
the wider one.

### The rejected alternative: fully live

The alternative was to resolve every Perjadin's list from today's definitions. A new Semua item
would then appear on every finished trip, unticked. Every finished Perjadin's `x/N`, and every past
week Pimpinan monitor, would drop the day it was added, and an item removed today would erase what
a finished trip had ticked. Pimpinan read the checklist back as how each trip's preparation went.
A definition made today should not rewrite that reading.

Wording is the exception on purpose. Fixing a typo, or renaming a task the company has renamed, is
not a change to what was asked of the trip.

## Ticks reference the item

A tick is `(perjadin_id, preparation_item_id)`. An item hidden for a Perjadin keeps its ticks, so
showing it again brings them back. Only the ticks are stored, as before: an un-tick is a `DELETE`.

## The system item

One item carries the auto-untick the amendment to ADR-0018 gave "Narasumber sudah lengkap": any
change to a Perjadin's Teaching Team (a name added, renamed or removed) deletes that Perjadin's tick
on it. It is now **"Fiksasi Dosen/Narasumber oleh PIC Dosen"**.

- It is marked in the data by a flag, `clears_on_teaching_team_change`, not by an id or a label, so
  the coupling survives a rewording.
- At most one item carries the flag, and it is a Semua item that is never removed. The database
  holds both of those rules.
- It may be reworded, but never removed or hidden, at any level. The query layer refuses those
  writes; the screen is not the only guard.

Everything else in ADR-0018 still holds. The checklist is not a gate and not a record of the trip.
Nothing ticks a box automatically. Any Staff member may tick any Perjadin's boxes.

## The cutover

Migration `0043_preparation_levels` does the cutover itself. It cannot be left to a seed run,
because the remote database is populated and its full seed cannot be re-applied.

- **The old six** become Semua items, added on a date before any Perjadin and **removed on the day
  the migration runs** (WIB). Every Perjadin that ended before that day keeps them and its ticks,
  which are converted by matching `item_key`.
- **Ticks on retired keys are dropped.** These are the `dosen:*` ticks from the per-teacher model and
  the `tiket_keberangkatan` and `tiket_kepulangan` ticks ADR-0041 folded into one box. They were
  already invisible orphans that no item matched, and they have no item to point at now.
- **The company's 14** become Semua items **added on that same day**, in the company's order and
  wording. Only two typos are corrected. The second, "Fiksasi Dosen/Narasumber oleh PIC Dosen",
  carries the flag.
- Perjadins that have not ended on that day show the 14 and lose sight of their ticks on the old six.
  That was accepted: there is no mapping from the old items to the new ones.
- The old `perjadin_preparation_item` table is dropped.
