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

## Amendment — the per-teacher boxes are gone, and one box auto-un-ticks

Two things changed when the teaching team stopped being People
([ADR-0020](./0020-teaching-team-members-on-a-perjadin-are-trip-scoped-names.md)).

**The per-teacher `Konfirmasi dengan {name}` boxes are removed.** They were keyed `dosen:{person_id}`,
and a Perjadin's teaching team no longer has person ids — it is a list of trip-scoped names, now up to
twenty of them, which would have been twenty boxes. In their place is a single fixed item
**`pengajar_lengkap`**, labelled **"Pengajar sudah lengkap"**. The set of items is therefore now a
flat, fixed seven — the original six plus this one — with **no per-member derivation left**. `N = 7`
for every Perjadin, and the read-time assembly no longer reads the Group at all.

**`pengajar_lengkap` is the one box the tool un-ticks by itself**, and this is a deliberate exception to
the rule stated above that nothing ticks a box automatically. It is ticked by hand like any other, but
**any change to the teaching team — a name added, removed or renamed — deletes the tick**. The reason
is exactly the mental-load argument the checklist exists to serve: every change to the roster is a
thing whoever manages the trip must re-confirm, so the box drops to unticked and forces a fresh manual
check that the team is, in fact, complete.

Mechanically this couples the teaching-team write to the checklist — a `DELETE` of the
`(perjadin_id, 'pengajar_lengkap')` row inside whatever mutates the team. That is the coupling this ADR
originally _declined_ for orphaned per-teacher ticks, and the trade is the opposite one on purpose:
there, leaving a tick alone lost nothing; here, un-ticking is the entire point. The exception is
narrow — one fixed key, cleared on one class of write — and does not generalise. No other box is ever
touched by anything but a hand.
