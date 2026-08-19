# The Preparation Checklist stores ticks and derives the list

A Perjadin carries a **Preparation Checklist** — a private, hand-ticked list of pre-departure
to-dos, shown only on the trip's own screen, with a `Persiapan: x/N` pill on the Perjadin list.
This records the two decisions that shape it: the _set of items_ is derived rather than stored, and
a tick left behind by a dropped teacher is left alone.

## The items are derived; only the ticks are stored

`perjadin_preparation_item` holds **one row per ticked item** and nothing else. The set of items a
Perjadin has — the six fixed boxes plus one per Teaching Team member of its Group — is assembled in
the query layer at read time, from the fixed list (in code) and the current Group.

The alternative would materialise a row per item per Perjadin, ticked or not, and keep it in step
with the Group. That is a synchronisation problem with no upside here: the fixed six are the same
for every trip, and the per-teacher items are a projection of `group_member`, which already exists
and is already replaced wholesale on every substitution. Storing the unticked rows would mean a
substitution has to insert and delete checklist rows to match — a second write that can disagree
with the first — to represent boxes that carry no information until someone ticks them. Deriving the
list means the Group is the single source of which teacher-boxes exist, and un-ticking is a plain
`DELETE` rather than a flag flip.

`N = 6 + (Teaching Team members)`. The **`staff` box is a single box** — "confirmed with the Staff",
not one per Staff member — so the up-to-three extra Staff a Group carries never add items. That is
what keeps `N` a function of the teacher count alone.

## A per-teacher tick is glued to the Person, and orphans are left

A per-teacher box is keyed `dosen:{person_id}`, not by name or by Group position. Two things follow,
both deliberate:

- **A rename never disturbs a box.** The `Konfirmasi dengan {name}` label is rendered live from the
  current Person; the tick is bound to the id. Change the name and the same box stays ticked.
- **A dropped teacher's tick becomes an orphan, and we leave it (decision (a)).** A Group is
  replaced wholesale, and `replacePerjadinGroup` is **not** changed to clean up checklist rows. When
  a teacher leaves, their `dosen:` tick stays in the table; read-time derivation only counts
  `dosen:` rows whose person is still a Teaching Team member, so the orphan is silently ignored — it
  is absent from the list, the `x/N` count and the pill. If that person is ever re-added, their old
  tick reappears, because it was never deleted.

The rejected alternative was to delete orphaned ticks inside `replacePerjadinGroup`. It costs a
join and a delete on every substitution to erase information a re-add would want back, and it
couples the Group write to a checklist it otherwise knows nothing about. Leaving orphans is cheaper
and loses nothing: an orphan is invisible, and re-adding a teacher restoring their prior ticks is a
reasonable behaviour rather than a surprising one. Cascade delete on `perjadin_id` still removes
every tick when a Perjadin is deleted, so orphans never outlive their trip.

## What this is not

It is not a record, a deadline or a gate. Nothing ticks a box automatically — not an uploaded
ticket, not a filed confirmation — and nothing in the tool waits on the checklist being complete. It
is an internal-monitoring aid for Staff, and any signed-in Staff may tick any Perjadin's boxes; the
write opens with the Staff-only choke point for the usual reason (a Server Action is a public
endpoint), not because it touches money, which it does not.
