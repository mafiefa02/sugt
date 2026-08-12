# The data model

What is stored, and which rules the database holds rather than the application.

This assumes the vocabulary in [`CONTEXT.md`](../CONTEXT.md) and the surfaces in
[`docs/product.md`](./product.md). Why the vendor and the boundaries are what they are is in
[ADR-0005](./adr/0005-postgres-for-the-invariants-not-the-scale.md) and
[ADR-0011](./adr/0011-supabase-and-better-auth.md).

Postgres and object storage are Supabase; both apps deploy to Vercel.

Every SQL block below was applied to a real Postgres, seeded with the actual forty-two Schools
from `packages/db/seed/reference-data.sql`, and then attacked with the case each constraint is
meant to reject — 54 checks, all behaving as claimed. Where this document says a rule is
enforced by the database, that was verified rather than assumed; where it says a rule is not,
that is in [what the database does not hold](#what-the-database-does-not-hold).

**Except where a section says otherwise.** Several changes are decided but **not yet applied**,
and each says so where it appears. Nothing else in this document describes a schema that does
not exist, and nothing in this list has been checked against a real Postgres the way the rest
was:

| Decided, not applied                                           | Where                                       |
| -------------------------------------------------------------- | ------------------------------------------- |
| `transaction.category` and `transaction.incurred_by_person_id` | [Money](#money)                             |
| `perjadin_evaluation.lodging` becoming nullable                | [Perjadin Evaluation](#perjadin-evaluation) |
| the whole of `story` and `story_photo`                         | [Stories](#stories)                         |

One of these carries a claim worth verifying rather than assuming when the migration lands:
`least()` ignoring NULLs, which is what lets a nullable `lodging` leave the elaboration rule
intact.

**Three rows left this list.** The partial `person_email_key` and the four hand-declared
`better_auth` tables are applied, by migrations `0002` and `0003`. So is
`session_one_online_per_school_per_day`, by migration `0004`, which
[#27](https://github.com/mafiefa02/sugt/issues/27) wrote because Jadwalkan Sesi daring is the
screen that makes it necessary. The claim this list held against that index — *"the new partial
index actually rejecting a second online Session for one School on one day"* — was checked
rather than assumed: `apps/internal/tests/online-session-batch.test.ts` drives it at the
database, in both the ways it is partial and in both directions. All three were checked against
a real Postgres the way the rest of this document was.

The blocks are ordered for reading, by topic, **not** in dependency order — `session`
appears before the `perjadin` it references. Migrations need reordering: reference data,
then `person`, then `perjadin` and `group_member` (the deferred foreign key between them
last), then `session` and what hangs off it.

---

## The glossary is not the schema

`CONTEXT.md` defines around thirty terms. Far fewer are tables, and that is deliberate — the
list below exists so nobody later "completes" the schema by adding the rest.

| Term                                                         | Where it lives                                                                                                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Programme, Track, Kementerian Pendidikan Tinggi, DITSAMA ITB | Nowhere. There is one of each; naming them in a table says nothing.                                                                                        |
| Stream, Class kind, Session mode, Role                       | `@sugt/domain`, as `as const` arrays. Fixed sets, not rows.                                                                                                |
| Class                                                        | Not a table. A Class is `(school_id, class_kind)` — three per School, by construction.                                                                     |
| GTK Class, MS Class, Student Class                           | The three values of `class_kind`.                                                                                                                          |
| Perjadin Report                                              | Not a table. It is the acquittal state on `perjadin` — see [Money](#money).                                                                                |
| Participant                                                  | Not a table. Nobody enrols Participants; one exists in the records only as a name they typed on their own feedback.                                        |
| Project Team, Final Project                                  | Not stored at all. [ADR-0009](./adr/0009-the-tool-tracks-delivery-not-outcomes.md) is explicit; they reach the public as curated pieces, never as records. |
| Treasurer                                                    | Not a role. A Treasurer is Staff; what is stored is that an Advance was returned, not to whom.                                                             |
| Advance                                                      | A column on `perjadin`, not a row. It is fixed at planning and never exists independently.                                                                 |
| Report deadline                                              | Not a column. Two days after the Group returns, derived from `perjadin.ends_on` and a constant.                                                            |
| Aspect                                                       | Not a table and not a value. Every Aspect on all four evaluations is a **column**; `@sugt/domain` names each rubric.                                       |
| Rating                                                       | Not a table. A Rating is one Aspect column on one row of an evaluation.                                                                                    |
| Transaction category                                         | Not a table. A `text` column on `transaction`, CHECKed against a closed set — see [Money](#money).                                                         |
| Story kind                                                   | Not a table. A `text` column on `story`; field narrative or a Final Project piece, and nothing else differs between them.                                  |

Every CHECK constraint value list in this document is **character-for-character** an
`as const` array in `packages/domain/src/index.ts` — `STREAMS`, `CLASS_KINDS`,
`SESSION_MODES`, `SESSION_STATUSES` and `ROLES` — and the Rating bounds come from
`RATING_MIN`/`RATING_MAX` there too. That is the point: no mapping layer, and drift between
the two is visible by reading them side by side. A new fixed set belongs in both places or
neither.

The four Aspect lists are the exception — `CLASS_RECORD_ASPECTS`, `SESSION_RECORD_ASPECTS`,
`PARTICIPANT_FEEDBACK_ASPECTS` and `PERJADIN_ASPECTS` name **columns** rather than stored
values, so each form and the concerns query are built from the same list the table is. Adding an
Aspect is a migration, which is the correct cost for a set that decides how teaching is judged.

---

## Two Postgres schemas

Better Auth's core tables are `user`, `session`, `account`, `verification`. **`session` is the
single most load-bearing word in this glossary** — a teaching occasion at one School — so the
library does not get to own it in `public`.

- `better_auth` — `user`, `session`, `account`, `verification`, declared **by hand** in
  `packages/db/src/schema/` like every other table, inside the `pgSchema("better_auth")` object
  and handed to `drizzleAdapter` through its `schema` option. Supabase's own `auth` schema is
  taken by GoTrue and owned by `supabase_auth_admin`, so this is a new schema rather than a
  shared one.
- `public` — the domain, including `public.session`, which means a Session.

**They are hand-written because the CLI cannot produce them.** This document previously said
"generated by the Better Auth CLI, never hand-edited", and that is not achievable: the
generator only ever emits `pgTable` — `pgSchema` appears nowhere in its bundle, and there is no
flag or config key that schema-qualifies a table — while `auth migrate` refuses the Drizzle
adapter outright (`if (db.id !== "kysely")`), telling you to run `auth generate` and apply with
drizzle-kit. Better Auth does understand a Postgres `search_path`, but only on the Kysely path,
which exits before doing anything here.

What makes the hand-written version work is that **the adapter never builds a table-name
string**: it looks each model up as a key in the schema object you pass, so a table built with
`pgSchema("better_auth").table("user", …)` emits `better_auth."user"` by itself. This is the
path Better Auth's own Drizzle documentation sanctions — _"modifying the Drizzle schema
directly"_. `auth generate` is run once for the column list and thereafter is a reference to
diff against on upgrade, not a step in any workflow. Its output is kept verbatim at
`packages/db/reference/better-auth-1.6.27.generated.ts` so there is something to diff against.
**The Drizzle property keys in the hand-written tables are the library's field names**, because
the adapter resolves a field by key lookup — renaming one breaks it at runtime and not at
typecheck.

Verified against `better-auth@1.6.27`; see
[`docs/research/better-auth-capabilities.md`](./research/better-auth-capabilities.md), which is
a version-pinned snapshot rather than durable documentation.

---

## Identity

Better Auth's `user` is a sign-in credential. **`person` is the human**, and every domain
foreign key in this document points at `person.id` and never at `user.id`.

The reason is concrete rather than architectural: a Group is assembled when a Perjadin is
planned, and a professor may be named to it months before they first sign in. A domain that
FKs into `user` cannot express that. It also means a Better Auth major version cannot ripple
into Perjadins, and the invite list is a list rather than a state ("user rows that have never
signed in").

```sql
create table person (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  email       text not null,
  role        text not null check (role in ('Staff', 'Teaching Team')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),

  unique (id, role)                    -- not redundant; see below
);

create unique index person_email_key on person (lower(email)) where active;
```

**The email index is partial**, applied by migration `0002`. At most one _active_ Person per
email, any number of revoked ones — the same trick as
`session_one_per_school_per_perjadin`. It has to be partial because a wrong `role` is corrected
by revoking the row and creating a new Person
([ADR-0013](./adr/0013-people-are-added-in-the-tool-and-their-role-is-write-once.md)),
which means the same email legitimately appears twice. It also makes the lookup all three
enforcement points share — `where lower(email) = $1 and active` — unambiguous by construction
rather than by convention.

**`active = false` does not by itself stop anyone signing in.** The hook below fires when a
`user` row is _created_, so it gates signup only; a returning sign-in creates a session and
never reaches it. Revocation is therefore **one write to `person.active`, read on every
request** — no second column, no ban, and nothing in `better_auth` to keep in step. Three points
enforce it and every one of them reads `person.active` and nothing else:
`databaseHooks.user.create.before` refuses a first account to somebody with no active Person;
`databaseHooks.session.create.before` refuses a new session to a revoked Person who already has
a `user` row; and `requirePerson()` refuses each request, including one made mid-session on a
cookie already issued. The third is what makes revocation immediate, and `@sugt/db`'s choke
point is where it binds for **writes**, because a layout does not run before a Server Action.
This document previously routed revocation through Better Auth's admin plugin and described
`banned` as `person.active`'s effect; both are gone. See the amendment to
[ADR-0013](./adr/0013-people-are-added-in-the-tool-and-their-role-is-write-once.md).

**`role` is write-once, and the database already enforces it.** Six composite foreign
keys point at `person (id, role)` — from `group_member`, `session_teacher`,
`class_record`, `session_record`, `perjadin.pic_person_id` and
`session.online_pic_person_id` — and none declares
`on update`, so all default to `NO ACTION`. The moment a Person has been on a trip,
taught a Stream or filed a record, Postgres refuses to change their role. This is not a
policy anyone added; it falls out of the composite keys, and it is written here because
an unwritten enforced constraint reads as a bug the first time it fires.

`unique (id, role)` looks pointless next to a primary key on `id`. It is the target of
composite foreign keys elsewhere in this schema, and it is what lets "the PIC is Staff" and
"only Teaching Team members teach" be declarative constraints instead of triggers. Do not
drop it.

`person` **is** the invite list from
[ADR-0003](./adr/0003-google-sign-in-with-an-invite-list.md). There is no separate invite
table: a row here is an invitation, and `active = false` is a revocation that preserves every
historical reference to that person.

### Linking a sign-in to a Person

`better_auth.user` carries one extra column:

```sql
alter table better_auth."user"
  add column person_id uuid unique references public.person (id);
```

**The column and the foreign key come from two different places, and that is not an
accident.** The column is declared on the Drizzle table beside the other four in
`packages/db/src/schema/auth.ts` — as a real `uuid`, because `user.additionalFields` has no
`uuid` in its vocabulary and would emit `text`, which cannot foreign-key to `person.id`. The
**foreign key** is the one piece still hand-written (`0003`), because drizzle-kit will not
write a cross-schema reference. `additionalFields` still carries a `personId` entry, doing a
third job: registering the field with the library, which builds its inserts from its own field
registry and silently drops anything not in it.

The single edge that crosses the library boundary sits on the library's side of it, so
`person` references nothing it does not own and a Better Auth major version cannot ripple into
the Perjadin foreign key graph.

A `databaseHooks.user.create.before` hook looks up `person` by lowercased email. No match
means it throws, so **an uninvited Google account cannot create a user row at all** — the
invite list gates signup, not merely authorisation.

**`person_id` records which Person the identity was created for; it is not what a request
resolves through.** The column is written once, when the `user` row is created. After a
revoke-and-re-add the correcting Person is a _new_ row with a new `id`, so `person_id` names
the dead one — which is why all three enforcement points join on `lower(email)` and `active`
instead. What the column carries is the invariant that a signed-in user maps to at most one
Person, and only ever to one that exists.

---

## Reference data

Seeded by migration. No admin screens — [`product.md`](./product.md) is explicit that Schools,
Clusters and Topics are fixed facts, not records with an editing lifecycle.

**`person` is not reference data and this rule does not reach it.** The roster grows and
revocations happen, so People are added through a Staff-only screen; only the founding
Staff rows are seeded, and only because the sign-in hook makes them a prerequisite for
anyone reaching that screen. Keep that seed separate from this file, which is re-run
freely.

```sql
create table province (
  code  text primary key,          -- 'JB', 'JI', 'SS', …
  name  text not null
);

create table cluster (
  id       uuid primary key default gen_random_uuid(),
  slug     text not null unique,
  name     text not null,
  topic    text not null,
  problem  text not null
);

create table school (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  cluster_id      uuid not null references cluster (id),
  province_code   text not null references province (code),
  kabupaten_kota  text not null
);
```

There are four Clusters and forty-two Schools. Cluster sizes are lopsided — six, seventeen,
eleven, eight — which is worth knowing before anyone builds a screen assuming they are
comparable.

**Topic and Problem are columns, not tables.** Each Cluster carries exactly one of each and
each Cluster's is different, so there is nothing to share and nothing to join.

**`cluster_id` is NOT NULL.** Clusters and their Topics are already allocated, so "a School
with no Cluster" is not a state the coverage view — which groups Schools by Cluster — ever
has to render, and no Cluster join is ever an outer join.

**Province is a table rather than a text column** for one reason: _provinces covered_ is a
headline figure on the portfolio site, and a typo in a free-text column silently inflates the
number nobody would think to check. Thirty-eight rows to make that impossible is a fair trade.

**`kabupaten_kota` is plain text**, unlike Province — nothing counts it, so a typo costs a
misspelt line on a School page rather than a wrong headline figure. It is kept because six
Schools are in Jakarta and three in Banda Aceh, so the Province alone does not tell you where
one is.

The island grouping the source spreadsheet shows — Sumatera, Jawa, Kalimantan,
Sulawesi/Maluku/Papua — is **not** stored. It does not agree with the Clusters (Jawa splits
across two, Kalimantan merges with Sulawesi into one), nothing is organised by it, and it is
recoverable from Province if a screen ever wants it.

`slug` exists so the authored seed file is readable and re-runnable (`on conflict (slug) do
update`), and so public URLs are stable. Primary keys stay uuid throughout rather than mixing
key types.

---

## Delivery

```sql
create table session (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references school (id),
  perjadin_id       uuid references perjadin (id),
  mode              text not null check (mode in ('offline', 'online')),
  held_on           date not null,
  status            text not null default 'arranged'
                      check (status in ('arranged', 'delivered', 'cancelled')),
  cancelled_reason  text,

  online_pic_person_id  uuid,
  online_pic_role       text check (online_pic_role = 'Staff'),

  created_at        timestamptz not null default now(),

  check ((mode = 'offline') = (perjadin_id is not null)),
  check ((mode = 'online') = (online_pic_person_id is not null)),
  check ((online_pic_person_id is null) = (online_pic_role is null)),
  check ((status = 'cancelled') = (cancelled_reason is not null)),

  foreign key (online_pic_person_id, online_pic_role) references person (id, role)
);

create unique index session_one_per_school_per_perjadin
  on session (perjadin_id, school_id)
  where status <> 'cancelled';

create unique index session_one_online_per_school_per_day
  on session (school_id, held_on)
  where perjadin_id is null and status <> 'cancelled';
```

That index is `product.md`'s "creating a Perjadin is what brings its Sessions into existence
— **one per School on the trip**". It is partial for the same reason the Session cap is not
enforced at all: cancelled Sessions persist and accumulate, so a School whose visit was
called off and re-arranged on the same trip must not collide with its own cancelled row.
Online Sessions are untouched, since `perjadin_id` is NULL and Postgres treats NULLs in a
unique index as distinct.

**The second index closes exactly that gap.** Online Sessions are arranged from the coverage
view in a batch — one date and one PIC applied across a multi-selection — so "the same School
twice on the same day" moved from theoretical to one mis-click away. The first index cannot
catch it, because it keys on `perjadin_id` and every online Session has none. Partial in the
same two ways and for the same reasons: cancelled rows accumulate and must not collide, and
offline Sessions are untouched because their `perjadin_id` is not null.

The first CHECK is the sharpest rule in the delivery half of the domain, and it is an
equivalence rather than an implication in both directions: **an offline Session has a
Perjadin and an online Session has none.** Six of every ten Sessions are invisible to
anything trip-shaped, which is why counting Perjadins never tells you how much teaching has
happened.

**Every Session has a PIC, but they come from different places.** An offline Session's is its
Perjadin's; an online Session has no Perjadin, so it carries its own — which is what the next
two CHECKs enforce, in exact mirror of the first. The column is named `online_pic_person_id`
rather than `pic_person_id` precisely so nobody reads it as "the PIC of this Session" and
finds it null for every offline row — the PIC of a Session is
`coalesce(session.online_pic_person_id, perjadin.pic_person_id)`, a query rather than a
column.

This matters because the PIC is the one person whose Session Record is required rather than
optional. Without it, six of every ten Sessions would have nobody who owed anything.

The composite foreign key uses the default `MATCH SIMPLE`, under which a row with NULLs in
the referencing columns satisfies the constraint — so offline Sessions, which have neither
column set, pass without a special case.

`held_on` is the date the Session is arranged for, and the date it happened once delivered.
It is a `date`, not a `timestamptz` — Indonesia spans three time zones and a Session is a
calendar day, not an instant.

**An arranged offline Session's `held_on` lies inside its Perjadin's `starts_on`–`ends_on`.**
Nothing holds that — not this schema, and until now not any document either. It is scoped to
_arranged_ deliberately: a trip's dates are correctable and its arranged Sessions move with them,
while delivered and cancelled ones stay where they are, so a delivered Session may legitimately
sit outside the window its Perjadin now claims. A CHECK cannot carry it, because a CHECK sees
only the row it is written on and the date range sits on `perjadin`; the choice is a constraint
trigger or the application, and it belongs wherever the date is written — both at arrangement and
when a trip's dates move. Online Sessions have no Perjadin and are untouched. Listed with the
rest in [what the database does not hold](#what-the-database-does-not-hold).

A Session exists only once arranged
([ADR-0006](./adr/0006-sessions-are-created-when-arranged.md)), so there are no planned rows,
no target dates and nothing is ever overdue. Progress is `count(*) where status = 'delivered'`
against `TOTAL_SESSIONS_PER_SCHOOL`, a constant that already lives in `@sugt/domain`.

### Who taught

```sql
create table session_teacher (
  session_id   uuid not null references session (id) on delete cascade,
  stream       text not null check (stream in ('STEM', 'Research')),
  person_id    uuid not null,
  person_role  text not null default 'Teaching Team' check (person_role = 'Teaching Team'),

  primary key (session_id, stream),
  foreign key (person_id, person_role) references person (id, role)
);
```

The primary key gives at most one teacher per Stream per Session. The composite foreign key
into `person (id, role)` — using the pinned `person_role` column — makes it impossible to
record a Staff member as having taught a Stream, without a trigger.

This table records who was in the room, whether or not there was a Group. It no longer decides
who owes what — Session Records are owed by the PIC, not by the teacher of a Stream — but it
is what tells you whose account is missing when a Session has only one.

---

## The four evaluations

A Session is judged from three vantage points, and a Perjadin from a fourth. Each has its own
rubric, because each asks a question only that person can answer.

| Table                  | Filed by      | One per               | Aspects                                                                          |
| ---------------------- | ------------- | --------------------- | -------------------------------------------------------------------------------- |
| `class_record`         | Teaching Team | Class, per professor  | Comprehension, Participation, Readiness, Materials, Delivery, Facilities, Timing |
| `session_record`       | PIC / Staff   | Session               | Facilities, Turnout, School support, Timing, Coordination                        |
| `participant_feedback` | Participants  | Class, per respondent | Materials, Instructor, Relevance                                                 |
| `perjadin_evaluation`  | Group         | Perjadin, per member  | Lodging, Transport, Meals, Punctuality                                           |

They share a scale (1–10), a threshold (`CONCERN_AT_OR_BELOW`, 7), and one rule — **a Rating at
or below the threshold cannot be filed without saying what went wrong** — so all four feed one
concerns list. Everything else about them differs, and deliberately: the PIC did not teach and
cannot judge comprehension; a Participant cannot rate their own readiness without it becoming
self-assessment; nobody but the Group slept in the hotel.

---

## Class Records

What a Teaching Team member says about **one Class** they taught at one Session.

**Six per Session is the full set.** Two professors — one per Stream — each teach all three
Classes, so each files three. That is the same six-part shape the design started with, arrived
at from the other direction: the unit is now (Class, filer) rather than (Class, Stream).

**Stream needs no column.** It is derivable from the filer's Stream assignment on the Group.
Two Records for the same Class from different professors is not duplication — it is STEM and
Research disagreeing about the same cohort, which is real information.

```sql
create table class_record (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references session (id) on delete cascade,
  class_kind          text not null check (class_kind in ('GTK', 'MS', 'Student')),
  filed_by_person_id  uuid not null,
  filed_by_role       text not null default 'Teaching Team'
                        check (filed_by_role = 'Teaching Team'),

  comprehension  smallint not null check (comprehension between 1 and 10),
  participation  smallint not null check (participation between 1 and 10),
  readiness      smallint not null check (readiness     between 1 and 10),
  materials      smallint not null check (materials     between 1 and 10),
  delivery       smallint not null check (delivery      between 1 and 10),
  facilities     smallint not null check (facilities    between 1 and 10),
  timing         smallint not null check (timing        between 1 and 10),

  covered      text,
  problems     text,
  suggestions  text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (session_id, class_kind, filed_by_person_id),
  foreign key (filed_by_person_id, filed_by_role) references person (id, role),

  check (
    least(comprehension, participation, readiness,
          materials, delivery, facilities, timing) > 7
    or btrim(coalesce(problems, '')) <> ''
  )
);

create index class_record_concerns_idx
  on class_record (least(comprehension, participation, readiness,
                         materials, delivery, facilities, timing))
  where least(comprehension, participation, readiness,
              materials, delivery, facilities, timing) <= 7;
```

The composite foreign key into `person (id, role)`, with `filed_by_role` pinned, makes **only a
Teaching Team member can file a Class Record** a fact rather than a convention — the same trick
that holds "the PIC is Staff" and "only Teaching Team taught a Stream".

The first three Aspects are the ones only the person at the front can judge: whether the cohort
followed it, took part, and arrived prepared. The last four are about what was brought and the
conditions it was brought into.

**Twenty-one Ratings per professor per Session** — three Classes at seven Aspects. That is a
deliberate number, not an accident of the schema, and it is the largest ask in the system by a
wide margin. [ADR-0009](./adr/0009-the-tool-tracks-delivery-not-outcomes.md) is where to look if
Records stop arriving.

---

## Session Records

What the PIC says about the **visit as a whole**. They organised it and taught nothing, so they
are asked only about what an organiser can see.

```sql
create table session_record (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references session (id) on delete cascade,
  filed_by_person_id  uuid not null,
  filed_by_role       text not null default 'Staff' check (filed_by_role = 'Staff'),

  facilities      smallint not null check (facilities     between 1 and 10),
  turnout         smallint not null check (turnout        between 1 and 10),
  school_support  smallint not null check (school_support between 1 and 10),
  timing          smallint not null check (timing         between 1 and 10),
  coordination    smallint not null check (coordination   between 1 and 10),

  problems     text,
  suggestions  text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (session_id, filed_by_person_id),
  foreign key (filed_by_person_id, filed_by_role) references person (id, role),

  check (
    least(facilities, turnout, school_support, timing, coordination) > 7
    or btrim(coalesce(problems, '')) <> ''
  )
);

create index session_record_concerns_idx
  on session_record (least(facilities, turnout, school_support, timing, coordination))
  where least(facilities, turnout, school_support, timing, coordination) <= 7;
```

Mirror of the Class Record's composite key: **only Staff can file one**. Any Staff member who
was there may, not just the PIC — but the PIC's is the one that gets chased.

`coordination` is the PIC rating their own planning, which people do generously. It is kept
because a low one is then very informative, and because nobody else was in a position to judge
it. There is no `covered` field; nothing was taught by the person filing.

This is distinct from a Perjadin Evaluation, which is about the journey rather than the school
visit. One trip may sit behind several Session Records and yields exactly one set of travel
Ratings.

---

## Participant Feedback

Kept in its own table, deliberately. [ADR-0001](./adr/0001-public-site-reads-aggregates-only.md)
rests on an internal record being written for colleagues — _"only worth capturing if it can say
'the school had no lab equipment and the students are three weeks behind'"_. Put a student's
submission in the same table and a professor can no longer be sure who else is in it.

```sql
create table session_feedback_token (
  session_id            uuid primary key references session (id) on delete cascade,
  token                 text not null unique,
  issued_at             timestamptz not null default now(),
  expires_at            timestamptz not null default now() + interval '24 hours',
  issued_by_person_id   uuid not null references person (id),

  check (expires_at > issued_at)
);

create table participant_feedback (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references session (id) on delete cascade,
  class_kind  text not null check (class_kind in ('GTK', 'MS', 'Student')),
  name        text not null,

  materials   smallint not null check (materials  between 1 and 10),
  instructor  smallint not null check (instructor between 1 and 10),
  relevance   smallint not null check (relevance  between 1 and 10),

  comment       text,
  submitted_at  timestamptz not null default now()
);

create index participant_feedback_concerns_idx
  on participant_feedback (least(materials, instructor, relevance))
  where least(materials, instructor, relevance) <= 7;
```

**Three Aspects, and none of them ask a Participant to rate themselves.** Comprehension,
Participation and Readiness are on the Class Record precisely because they are judgements about
the room, and a room grading its own readiness is not evidence. Materials and Instructor overlap
deliberately with the Class Record's `materials` and `delivery` — that overlap is the point,
because it lets what the professor thought be set against what the room thought.

`class_kind` says which Class the respondent sat in. It is what makes their Rating comparable to
the Class Record for that same cohort.

**No elaboration rule applies to Participants.** The `CHECK` forcing prose on a low Rating is on
`class_record` and `session_record` only. A Participant owes nothing and is not signed in;
refusing their 3 because they did not justify it would simply lose the 3.

**One token per Session, shared.** The primary key is `session_id`, so issuing a new one replaces
it. `expires_at` defaults 24 hours out and is stored rather than derived: the token is issued at
the end of the Session by construction — the link is the QR code shown in the room — so "24 hours
after the Session ended" needs no Session end time to exist.

`name` is typed by the Participant and referenced by nothing. No `person_id`, no enrolment, no
attendee list — [ADR-0009](./adr/0009-the-tool-tracks-delivery-not-outcomes.md) decided against
building one, which is also why per-Participant tokens were rejected: they need exactly the list
that does not exist. Nothing prevents one person submitting twice or a forwarded link being used
by somebody who was not there. **Participant Feedback is indicative, not a census.**

---

## Who still owes what

Nothing is required in the sense of being blocked, and nothing has a deadline. What the tool does
is name who has not filed, so they can be chased in the group chat.

It can do that for internal records only, and it needs no new columns:

```text
-- The six Class Records a Session expects, and who owes the missing ones
select st.person_id, ck.class_kind
  from session_teacher st
  cross join unnest(array['GTK','MS','Student']) as ck(class_kind)
 where st.session_id = $1
   and not exists (select 1 from class_record cr
                    where cr.session_id = st.session_id
                      and cr.class_kind = ck.class_kind
                      and cr.filed_by_person_id = st.person_id);
```

`session_teacher` already names the two professors, and the three Class kinds are a constant, so
the expected set is their cross product — six rows — and what is outstanding is whatever is not
yet in `class_record`.

**Participants cannot be listed.** There is no attendee list, so there is no denominator: "4 of ?
responded". A count with no denominator reads as a system of record and is not one, which is
[ADR-0009](./adr/0009-the-tool-tracks-delivery-not-outcomes.md)'s objection exactly. Their form is
chased in the room, not by the tool.

---

## Perjadin Evaluation

How the trip went, as distinct from how the teaching went. Internal, and **only the Group that
travelled may file one**.

```sql
create table perjadin_evaluation (
  id                  uuid primary key default gen_random_uuid(),
  perjadin_id         uuid not null references perjadin (id) on delete cascade,
  filed_by_person_id  uuid not null references person (id),

  lodging      smallint          check (lodging     between 1 and 10),   -- nullable; see below
  transport    smallint not null check (transport   between 1 and 10),
  meals        smallint not null check (meals       between 1 and 10),
  punctuality  smallint not null check (punctuality between 1 and 10),

  problems     text,
  suggestions  text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (perjadin_id, filed_by_person_id),

  check (
    least(lodging, transport, meals, punctuality) > 7
    or btrim(coalesce(problems, '')) <> ''
  )
);

create index perjadin_evaluation_concerns_idx
  on perjadin_evaluation (least(lodging, transport, meals, punctuality))
  where least(lodging, transport, meals, punctuality) <= 7;
```

Same shape as a Session Record, on purpose: one row per person, five or four Ratings beside the
prose, the same 1–10 scale, the same elaboration rule at the same threshold. Two evaluation
forms that behave differently would be two things to learn.

**`lodging` is the one nullable Rating in the system, because a day-trip has no hotel.** Not
every Perjadin involves a night away — the programme budget carries at least one group visiting
two Schools and returning the same day, with accommodation, flights and airport transfer all at
zero. A `not null` column would require those travellers to rate a hotel they never saw, and
inventing a Rating to satisfy a constraint is worse than the missing row.

**Nothing constrains when it may be null**, deliberately. A Group that did stay somewhere and
skipped the Aspect is a filer being unhelpful, not a state worth preventing, and the CHECK that
would express it needs the trip's date range on a table that does not carry it.

The elaboration rule survives a NULL without any change, and the reason is worth knowing before
anyone "fixes" it: **Postgres's `least()` ignores NULLs**, returning NULL only when every
argument is one. So `least(null, 8, 9, 9)` is `8` — the CHECK still fires on a genuine low
Rating, the partial index below still selects the right rows, and `null <= 7` is never true, so
a skipped Aspect cannot reach the concerns list. That behaviour is load-bearing and belongs on
the invariant suite beside the other 54, not in a comment.

`transport` covers the ground transport generally rather than the shuttle specifically, and
`punctuality` is whether the schedule held. They are separate Aspects because they fail
independently — a good car that turned up an hour late is a different complaint from a bad car
that was prompt, and one is the vendor's fault while the other is the plan's.

There is no `covered` field. Nothing was taught on a journey.

### Why there is no foreign key to the Group

"Only the Group may file" is exactly the shape that a composite foreign key to
`group_member (perjadin_id, person_id)` would enforce, matching the pattern used for the PIC and
for who taught. **It cannot be used here**, and the reason is a decision made earlier in this
document: a Group is [replaced wholesale](#the-group), by deleting every member row and
reinserting the new set.

Tested against Postgres, both available behaviours are wrong:

| On delete             | What happens when a Group is corrected                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Default (`no action`) | The delete fails outright. Once anyone has filed, the Group can never be edited again.                               |
| `cascade`             | The delete succeeds and destroys **every** evaluation on the trip — including those filed by members who never left. |

So `filed_by_person_id` references `person` alone, and membership is checked where the
evaluation is written. This joins the honest list in
[what the database does not hold](#what-the-database-does-not-hold) — it is the second rule that
wholesale Group replacement costs, and it is worth knowing that is what it costs.

### The concerns list in full

The one query the whole rating design exists to serve. Four sources, four unpivots — each with
its own Aspect list — unioned, with the source kept so a professor's 3 and a student's 3 stay
distinguishable:

```text
select 'Class Record' as source, sch.name || ' · ' || c.class_kind as subject,
       r.aspect, r.rating, p.full_name as who, c.problems as said, c.created_at as when_
  from class_record c
  join session sn on sn.id = c.session_id
  join school sch on sch.id = sn.school_id
  join person p on p.id = c.filed_by_person_id
  cross join lateral (values ('comprehension', c.comprehension), ('participation', c.participation),
                             ('readiness',     c.readiness),     ('materials',     c.materials),
                             ('delivery',      c.delivery),      ('facilities',    c.facilities),
                             ('timing',        c.timing)) as r(aspect, rating)
 where r.rating <= 7

union all

select 'Session Record', sch.name, r.aspect, r.rating, p.full_name, s.problems, s.created_at
  from session_record s
  join session sn on sn.id = s.session_id
  join school sch on sch.id = sn.school_id
  join person p on p.id = s.filed_by_person_id
  cross join lateral (values ('facilities',     s.facilities), ('turnout',      s.turnout),
                             ('school_support', s.school_support), ('timing',   s.timing),
                             ('coordination',   s.coordination)) as r(aspect, rating)
 where r.rating <= 7

union all

select 'Participant', sch.name || ' · ' || f.class_kind, r.aspect, r.rating,
       f.name, f.comment, f.submitted_at
  from participant_feedback f
  join session sn on sn.id = f.session_id
  join school sch on sch.id = sn.school_id
  cross join lateral (values ('materials',  f.materials), ('instructor', f.instructor),
                             ('relevance',  f.relevance)) as r(aspect, rating)
 where r.rating <= 7

union all

select 'Perjadin Evaluation', pj.destination, r.aspect, r.rating,
       p.full_name, e.problems, e.created_at
  from perjadin_evaluation e
  join perjadin pj on pj.id = e.perjadin_id
  join person p on p.id = e.filed_by_person_id
  cross join lateral (values ('lodging', e.lodging), ('transport',   e.transport),
                             ('meals',   e.meals),   ('punctuality', e.punctuality))
                     as r(aspect, rating)
 where r.rating <= 7

 order by when_ desc;
```

Run against the seeded database, that returns rows like:

```text
 source              | subject                  | aspect        | rating | who  | said
---------------------+--------------------------+---------------+--------+------+----------------------------
 Participant         | SMAN 8 Jakarta · Student | instructor    |      3 | Rina |
 Class Record        | SMAN 8 Jakarta · Student | comprehension |      4 | Budi | Belum paham dasar sensor
 Session Record      | SMAN 8 Jakarta           | turnout       |      5 | Ani  | Hanya 12 dari 30 guru hadir
 Perjadin Evaluation | Jakarta                  | lodging       |      4 | Ani  | Hotel tidak ada air panas
```

Three things to read off that. **The subject column tells you which cohort** — Student Class at
SMAN 8, from two independent sources — which is the question the design lost when Ratings were
briefly attached to the Session as a whole, and has now recovered properly. **Only the internal
rows carry an explanation**, because the elaboration rule applies to signed-in filers alone.
And the four rubrics never collide: `comprehension` can only come from a professor,
`instructor` only from the room, `turnout` only from the PIC.

The `7` in each predicate is `CONCERN_AT_OR_BELOW`. It appears here four times and in four index
predicates, which is why moving it is a migration.

### Access

A Perjadin Evaluation carries **no money**, so it follows
[ADR-0004](./adr/0004-delivery-data-is-open-internally-money-is-not.md)'s open-delivery rule and
not the Perjadin Report's Staff-only rule. Anyone signed in can read one; only that trip's Group
can write one. This is worth stating because the table hangs off a Perjadin and a reader who
knows the Report is Staff-only will assume this is too. Teaching Team members file these — they
are the ones who slept in the hotel.

---

## Travel

```sql
create table perjadin (
  id                          uuid primary key default gen_random_uuid(),
  destination                 text not null,
  starts_on                   date not null,
  ends_on                     date not null,

  advance_idr                 bigint not null check (advance_idr >= 0),

  pic_person_id               uuid not null,
  pic_role                    text not null default 'Staff' check (pic_role = 'Staff'),

  returned_to_treasurer_idr   bigint,
  returned_at                 timestamptz,
  report_filed_at             timestamptz,
  created_at                  timestamptz not null default now(),

  check (ends_on >= starts_on),
  check ((returned_at is null) = (returned_to_treasurer_idr is null)),

  foreign key (pic_person_id, pic_role) references person (id, role)
);
```

`perjadin` and `group_member` reference each other, so the second half cannot be inline — it
is added once both tables exist:

```sql
alter table perjadin
  add constraint perjadin_pic_is_a_group_member
  foreign key (id, pic_person_id) references group_member (perjadin_id, person_id)
  deferrable initially deferred;
```

`advance_idr` is NOT NULL because the Advance is fixed at planning and transferred before
departure — a Perjadin is never in an unfunded state, so there is no nullable phase to model.

**There is no `report_deadline` column.** The Report is due two days after the Group gets back,
always, so the deadline is `ends_on + REPORT_DEADLINE_DAYS_AFTER_RETURN` and nothing stores it.
Storing it would let it be entered wrong, and would leave it stale when a trip's dates are
corrected — a derived deadline recomputes itself and a typed one does not. Nothing is gated on
it either way; it is shown as days remaining.

**Money is `bigint` in whole rupiah.** `numeric(_, 2)` would imply a subunit nobody uses. The
`_idr` suffix is on every money column so no reader has to guess the unit.

Two declarative constraints replace what would otherwise be trigger code:

- `(pic_person_id, pic_role) → person (id, role)` with `pic_role` pinned to `'Staff'` makes
  **the PIC is a Staff member** unbreakable, including from the Supabase SQL editor.
- The deferred self-referential foreign key makes **the PIC is a member of their own Group**
  hold at commit. It has to be deferred because `perjadin` and its `group_member` rows are
  inserted in the same transaction and neither can go first.

`destination` is free text: it is what goes on the paperwork. The Schools actually visited are
the structural truth, reached through `session.perjadin_id`, and one Perjadin may cover
several.

### The Group

```sql
create table group_member (
  perjadin_id          uuid not null references perjadin (id) on delete cascade,
  person_id            uuid not null,
  role                 text not null check (role in ('Staff', 'Teaching Team')),
  stream               text check (stream in ('STEM', 'Research')),
  receipts_settled_at  timestamptz,

  primary key (perjadin_id, person_id),
  foreign key (person_id, role) references person (id, role),

  check ((role = 'Teaching Team') = (stream is not null))
);
```

`role` is denormalised from `person` — but it cannot drift, because the composite foreign key
into `person (id, role)` means a row can only exist if the pair is true there. Carrying it is
what makes the next constraint expressible.

That constraint says **exactly the Teaching Team members carry a Stream assignment.** A
professor is assigned to a Stream when a Group is formed, not permanently; Staff never are.
Both halves of that sentence are now enforced by the database.

**A Group is replaced wholesale, never edited.** There is no "remove one member" operation.
Substituting a professor submits an entire replacement Group, and one transaction deletes
every member row and inserts the new set. The Perjadin keeps its id, so its Sessions, Advance
and transactions are untouched — only the membership is destroyed and rebuilt.

That is what makes the last Group rule cheap. See
[what the database does not hold](#what-the-database-does-not-hold).

`receipts_settled_at` is the PIC's checklist from `product.md`. It has to be an explicit mark
rather than something derived, because a member with no transactions is genuinely ambiguous
between _spent nothing_ and _has not handed anything over yet_.

---

## Money

**There is no `perjadin_report` table.** A Perjadin yields exactly one Report, always, so the
acquittal is the state already on `perjadin`: `report_deadline`, `report_filed_at`,
`returned_to_treasurer_idr`, `returned_at`.

```sql
create table transaction (
  id                    uuid primary key default gen_random_uuid(),
  perjadin_id           uuid not null references perjadin (id) on delete cascade,
  spent_on              date not null,
  description           text not null,
  amount_idr            bigint not null check (amount_idr > 0),
  category              text not null check (category in (
                          'Tiket Pesawat/Kereta PP', 'Uang Harian',
                          'Honorarium Narasumber', 'Akomodasi',
                          'Transport Bandara/Stasiun', 'Transport Lokal Dalam Provinsi',
                          'Konsumsi', 'Modul', 'ATK',
                          'Alat dan Bahan Research Project', 'Seminar kit', 'Lainnya')),
  incurred_by_person_id uuid references person (id),
  created_by_person_id  uuid not null references person (id),
  created_at            timestamptz not null default now()
);

create table transaction_evidence (
  id                    uuid primary key default gen_random_uuid(),
  transaction_id        uuid not null references transaction (id) on delete cascade,
  storage_path          text not null unique,
  content_type          text not null,
  byte_size             bigint not null,
  uploaded_by_person_id uuid not null references person (id),
  uploaded_at           timestamptz not null default now()
);
```

**A transaction is not attributed to a person.** The Advance is one pot and the acquittal
reconciles the pot. Per-diems appear as unattributed lines like anything else. Worth knowing:
[ADR-0004](./adr/0004-delivery-data-is-open-internally-money-is-not.md) justifies hiding money
from Teaching Team by citing "per-diem amounts and personal travel claims" — the rule still
holds, its stated reason is just thinner than when it was written. Adding
`incurred_by_person_id` later is a nullable column, not a migration of meaning.

**`category` is a closed set read off DITSAMA's own approved budget**, not invented for a
template nobody has read. The eleven named values are the line items the programme RAB repeats
across all twenty-three travel groups; `Lainnya` is the escape hatch. They are in Indonesian
because that is what goes on the paperwork, and they are character-for-character
`TRANSACTION_CATEGORIES` in `packages/domain/src/index.ts` — the same rule every other fixed
set in this document follows.

This narrows [ADR-0007's amendment](./adr/0007-the-tool-generates-the-acquittal.md), which said
the export gets "no category, no cost-centre, no account code, no payee". Its objection was
that **inventing** fields for an unread template produces fields that do not fit, and that
objection is answered rather than overridden: a list taken from the approved budget is
evidence, not a guess. The rest of the amendment stands — the export still invents nothing
beyond these columns, and it is still replaced rather than corrected when a completed SPJ
arrives. `Uang Harian` stays one category; the Narasumber/Asisten split in the RAB is a rate
difference, not a different kind of spend.

**`incurred_by_person_id` is nullable, and its absence is not a gap.** This document previously
said a transaction is not attributed to a person at all, and offered the column as "a nullable
column, not a migration of meaning" if evidence ever appeared. It has: the RAB budgets
`Uang Harian` as `2 orang × N hari`, at different rates for Narasumber and Asisten. Per-diems
and honoraria carry a person; a taxi and a box of ATK do not. **The Advance is still one pot
and the acquittal still reconciles the pot**, so
[ADR-0004](./adr/0004-delivery-data-is-open-internally-money-is-not.md) is untouched.

Note what did **not** enter the table: no cost-centre, no account code, no payee, no
`Ref Standar Biaya` — the RAB carries the last of these on most lines (`PMK 32/2025 No.28.1`
and the like) and it stays out until a real form asks for it.

**The reconciliation is derived, never stored.** `advance_idr - sum(amount_idr)` is the
running remainder the acquittal screen shows, and it is a query. Only the fact that money was
returned is a stored event.

Evidence is many-per-transaction. `storage_path` is the object key in the private bucket, and
`unique` on it means an upload cannot be attached twice.

---

## Stories

The public narrative, authored in the internal app by Staff and read by `@sugt/public`
through the published-Stories routes. Decided, not yet written as Drizzle — the shape below
is the contract, and it is the largest thing on the critical path now that
[ADR-0008](./adr/0008-public-narrative-is-authored-in-the-internal-app.md)'s second
amendment puts the authoring UI in the first release.

```sql
create table story (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  school_id       uuid not null references school (id),
  stream          text check (stream in ('STEM', 'Research')),
  kind            text not null default 'field'
                    check (kind in ('field', 'final_project')),
  title           text not null,
  body            text not null,
  cover_photo_id  uuid,              -- references story_photo (id); added below
  published_at    timestamptz,

  written_by_person_id  uuid not null,
  written_by_role       text not null default 'Staff' check (written_by_role = 'Staff'),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  foreign key (written_by_person_id, written_by_role) references person (id, role)
);

create table story_photo (
  id                     uuid primary key default gen_random_uuid(),
  story_id               uuid not null references story (id) on delete cascade,
  storage_path           text not null unique,
  content_type           text not null,
  byte_size              bigint not null,
  caption                text,
  uploaded_by_person_id  uuid not null references person (id),
  uploaded_at            timestamptz not null default now()
);
```

`story` and `story_photo` reference each other, so the cover cannot be inline — it is added
once both tables exist, the way the PIC-membership constraint on [Travel](#travel) is. Only the
placement is shared; this one needs no deferral, and why is below:

```sql
alter table story
  add constraint story_cover_photo_id_fkey
  foreign key (cover_photo_id) references story_photo (id) on delete set null;
```

**`school_id` is NOT NULL, and it is the only thing a Story attaches to.** The design's cards
carry a School, a Cluster and a Stream — but the Cluster is `school.cluster_id` reached
through the join, exactly as everywhere else, so it is not a second reference. There is no
`cluster_id` and no `perjadin_id`. A public Story hanging off the trip that carries the money
is a boundary [ADR-0004](./adr/0004-delivery-data-is-open-internally-money-is-not.md) draws
deliberately, and the design never asks for one.

The cost is stated plainly: a Programme-wide piece belonging to no single School has nowhere
to live. That is a homepage-copy problem, not a feed entry.

**`stream` is nullable**, unlike everywhere else it appears. It is the badge on the card, and
a Story about a whole visit is about both.

**`kind` is how a Final Project reaches the public without becoming a record.**
[ADR-0009](./adr/0009-the-tool-tracks-delivery-not-outcomes.md) refuses to track Project Teams
and Final Projects, and it still does — nothing here enrols one, counts one or gives one a
state. A Final Project reaches a public page the only way any narrative does: somebody wrote a
piece about it. `kind` exists because the public site gives those pieces their own section
rather than a filter chip on the stories feed, so the payload has to say which is which.

It is a column rather than a table for the same reason Topic and Problem are: there is one
value per row, nothing joins to it, and the two kinds differ in where they are listed and in
nothing else. Same editor, same upload path, same payload. `STORY_KINDS` in
`packages/domain/src/index.ts` carries the pair.

**`body` is Markdown**, rendered on the public site through a strict allowlist — see
[ADR-0015](./adr/0015-story-bodies-are-markdown-and-the-editor-schema-is-the-allowlist.md),
which is also where the constraint binding the editor to that allowlist is argued. Nothing in
this table enforces the format; it is `text`, and the rule lives in the two pieces of code that
write and render it.

**`published_at` NULL is a draft.** No status enum — three states would owe three glossary
terms for a distinction the surface does not yet make. Setting it publishes; clearing it takes
the Story down, and the internal app calls a revalidation route on `@sugt/public` when either
happens. That route is the only write-shaped thing the public app will ever have, and it
writes nothing but its own cache. It exists because the public site serves its last good
payload indefinitely (see the endpoint contract in ADR-0008) — fine for a figure, not fine for
a photograph that has to come down now.

**Publishing is Staff-only, and that is a composite foreign key like every other role rule
here.** `written_by_role` is pinned to `'Staff'` and the pair references `person (id, role)`
— the seventh target of the `unique (id, role)` index, alongside the PIC, who taught, and who
filed each internal record. [ADR-0004](./adr/0004-delivery-data-is-open-internally-money-is-not.md)
says publishing is Staff-only; without this it would be the one such rule held by convention.
It also means a Story's author inherits write-once `role`, which is the correct behaviour: the
person who wrote it was Staff when they wrote it.

**`story_photo` mirrors `transaction_evidence`** column for column, deliberately: same
`storage_path unique`, same `content_type`/`byte_size`, same uploader and timestamp. One
upload pattern to build and one to learn. `uploaded_by_person_id` references `person` alone
rather than the pair, exactly as `transaction_evidence` does — uploading is not a role-gated
act, and the Story it hangs off already carries the Staff constraint. Keys are
`story/{story_id}/{uuid}` in `public-media`, mirroring the `receipts` convention. **Dropping
`position` makes that mirror tighter**, and the mirror is worth keeping true: a caption is now
the only column one table has and the other does not.

**There is no ordering.** The gallery renders by `uploaded_at`, tie-broken by `id`, and Staff
cannot rearrange it without deleting and re-uploading — a cost named and accepted rather than
overlooked. The tie-break is not decoration: a bulk upload gives several rows the same default
timestamp, and without it the order is not stable between reads.

**The cover is its own field, not "whichever photograph is first".** `story.cover_photo_id` is
nullable and `on delete set null`, so deleting the photograph that happens to be the cover clears
the field rather than blocking the delete. Two consequences come with that choice and were taken
with it: the two tables now reference each other, so **the cover is set in a second statement**
once the photographs have landed rather than in the insert; and **no deferred constraint is
needed**, because the column is nullable — unlike the PIC-membership foreign key, which had to be
deferred precisely because neither side could go first.

**This document previously said `position` orders them and makes the first the cover.** That was
false in both halves, and the wholesale-rewrite pattern it argued for went with it: there is no
`unique (story_id, position)` left for an intermediate state to collide with, so nothing here
rewrites every row. [The Group](#the-group) is now the only place in this schema that pattern
lives.

**Publishing is blocked while photographs exist and none of them is the cover.** Not a warning —
the control is unavailable. A Story with **no** photographs at all is not gated, because there is
nothing to choose a cover from and nothing missing.

**It is the only gate in the product, and that is worth stating rather than burying.** The
standing rule is the opposite: `CONTEXT.md` says nothing is required and nothing is blocked, and
[`product.md`](./product.md) says _"Nothing is gated"_ of the one screen most tempted to gate
something. The approval regime an early design drew was refused outright, and so was gating the
acquittal's submission on evidence being attached. This exception is accepted for a reason that
does not generalise: the public site is the portfolio DITSAMA is judged by, and an imageless card
beside eight illustrated ones reads as broken rather than as a choice. It gates publishing and
nothing else. It is also not a precedent — a field a form insists on before it will submit is a
different thing, and the next rule that wants to withhold an action until some **other** record
is complete has to make its own case rather than cite this one.

The two buckets stay exactly as split below. A Story's photographs are public by intent, which
is the whole difference from a receipt.

## Object storage

Two buckets, and the split is doing real work:

| Bucket         | Visibility | Holds                                                                        |
| -------------- | ---------- | ---------------------------------------------------------------------------- |
| `receipts`     | Private    | Transaction evidence. Keys: `perjadin/{perjadin_id}/{transaction_id}/{uuid}` |
| `public-media` | Public     | Published Story photographs. Keys: `story/{story_id}/{uuid}`                 |

**`public-media` is needed at provisioning time, not at some later one.** This row read
_"Published photographs (a later release)"_ until
[ADR-0008](./adr/0008-public-narrative-is-authored-in-the-internal-app.md)'s second amendment put
Story authoring in the first iteration. The public site launches with real Stories in the
database, so the bucket has to exist before the first Story can be written — it is part of the
launch gate, not a follow-up.

Participant Feedback uploads nothing, and should not start. A file upload on an
unauthenticated route is a different risk from a text field on one.

This is [ADR-0001](./adr/0001-public-site-reads-aggregates-only.md) held at the storage layer,
the same way the package split holds it in code: a bucket boundary is not a policy anyone can
get wrong.

Because sign-in is Better Auth rather than Supabase Auth, storage policies cannot see who is
asking. Receipt access is therefore a signed URL minted by the internal app **after** it has
checked the caller is Staff. That check is the only thing standing between Teaching Team and a
receipt, so it belongs at one choke point, not at each call site.

---

## Where the code lives

`packages/db` (`@sugt/db`) holds the Drizzle schema, the migrations, the connection and
the queries — the last of these at `@sugt/db/queries`, a subpath of its own, where the
`Caller` union and the Staff-only choke point live —
a Just-in-Time package like `@sugt/domain` and `@sugt/ui`, with `exports` pointing straight
at `./src` and no build step. Its own README covers running it.

**`@sugt/public` must never declare it.** That is AGENTS.md rule 1 and the mechanism behind
[ADR-0002](./adr/0002-two-apps-in-a-pnpm-workspace.md) — pnpm's strict symlinked
`node_modules` makes the leak unbuildable rather than unlikely. `@sugt/public` holds no
Supabase client and no database credentials of any kind.

Drizzle rather than Prisma, for one reason that matters here: this schema leans on CHECK
constraints, composite and deferred foreign keys, four partial indexes and two Postgres
schemas. `schema.prisma` cannot express any of those, so Prisma would mean hand-written
migration SQL anyway — at which point the generated client is the only thing left to weigh.

Drizzle expresses all of it **except one thing**: `DEFERRABLE INITIALLY DEFERRED` on the
PIC-membership foreign key, since drizzle-orm has `deferrable` on transactions but not on
foreign keys. That stays a hand-written migration, and drizzle-kit leaves it alone because it
is not in the snapshot — verified by re-generating against an unchanged schema and getting no
statements.

**`better_auth.user.person_id` used to be the second exception and no longer is.** This
document previously said drizzle-kit ignores it "because it isn't in its snapshot", which
cannot hold: the Drizzle adapter resolves each model as a key in the schema object it is
given, so every column it touches — `person_id` included — has to be **in** that object, and
therefore in the snapshot. It is declared there as `uuid()` rather than through Better Auth's
`additionalFields`, which types it `text` and could never foreign-key to `person.id uuid`.

What survives as hand-written is only the **cross-schema foreign key**, which no generator
will write. Migration `0002` keeps its guard and its `ADD CONSTRAINT`; its `ADD COLUMN` is
redundant once the column is declared, and folding it in is a prerequisite to applying
anything, not a tidy-up.

**The Drizzle schema is the source of truth, and it was checked against this document
rather than assumed to match it.** Both were applied to a real Postgres and the catalogs
compared — every column, CHECK, foreign key, unique constraint and index. 239 entries each,
identical apart from the constraint names Drizzle auto-generates. The invariant suite then
ran against the Drizzle-built database.

The unauthenticated feedback route needs its own care. It is the only path in either app that
writes without a signed-in Person, so it belongs behind a single handler that resolves the
token, checks the expiry, and can insert into `participant_feedback` and nothing else. See
[ADR-0012](./adr/0012-participants-write-through-a-short-lived-session-token.md).

Connection strings, both IPv4:

- Runtime, from Vercel functions — Supavisor **transaction** mode, port `6543`. Prepared
  statements are unavailable in this mode; the driver must be configured accordingly.
- Migrations — Supavisor **session** mode, port `5432`.

`turbo.json` runs with `envMode: strict`, so `DATABASE_URL` has to be declared in the
consuming task's `env` or it is invisible at build time. Nothing reads env today, so this is
the first entry.

**The aggregates endpoints add four more, and the same trap applies to all of them.** The
public app's build now fetches — and fails the deploy when it cannot — so a variable missing
from a task's `env` surfaces as an undefined secret at build time, one layer removed from
the cause:

| Variable            | Read by          | Declared on    |
| ------------------- | ---------------- | -------------- |
| `INTERNAL_APP_URL`  | `@sugt/public`   | `build`, `dev` |
| `AGGREGATES_SECRET` | both apps        | `build`, `dev` |
| `PUBLIC_APP_URL`    | `@sugt/internal` | `build`, `dev` |
| `REVALIDATE_SECRET` | both apps        | `build`, `dev` |

The first pair is `@sugt/public` calling in; the second is `@sugt/internal` calling back to
revalidate after a Story is published or withdrawn. Both secrets are shared between the two
apps, so each is declared in both — a value present on one side and missing on the other
fails at request time rather than build time, which is the harder failure to read.

None is `NEXT_PUBLIC_*`, and none may become one. A secret in the client bundle is a secret
anyone can read, and `AGGREGATES_SECRET` is the only thing making the endpoints
non-browser-reachable.

---

## What the database does not hold

Stated plainly, because an absent constraint reads as an oversight otherwise.

**"At least one Teaching Team member assigned to each Stream."** This is the one Group rule
that is not declarative — it is a cross-row count, and no CHECK can see sibling rows. Because
a Group is submitted whole, the check runs once against the complete payload before anything
is written, and there is no partial state for it to miss. The gap is that raw SQL can still
produce a Group with no Research professor. If that ever happens for real, the upgrade is a
`deferrable initially deferred` constraint trigger, which was rejected here only because
wholesale replacement made it unnecessary.

**"Both Streams were taught."** Same shape: `session_teacher` guarantees at most one teacher
per Stream, not that both rows exist. Required at the point a Session is marked delivered.

**That an arranged offline Session falls inside its Perjadin.** `session.held_on` and
`perjadin.starts_on`/`ends_on` are unrelated columns as far as the database is concerned. The
rule and why a CHECK cannot carry it are in [Delivery](#delivery); what belongs here is that
nothing enforces it today, so an arranged Session can be dated outside the Perjadin it is on.

**That `delivered` is terminal.** `session_status_check` permits all three values with no
regard to what a row already holds, so nothing in the database stops `delivered` being written
back to `arranged` or `cancelled`. The rule is real and the reason is sharp — a reversal leaves
filed Class Records describing a Session that claims not to have happened, with their Ratings
still on the concerns list — but it is held by the application alone: the Session screen offers
cancellation while a Session is `arranged` and never after, and offers no way back from
`delivered` at all.

**"Every transaction has at least one piece of evidence."** Also a cross-row count. Required
when the Report is filed, not when the transaction is entered — `product.md` is explicit that
a receipt can be attached later.

**The four-offline-six-online cap.** Deliberately unenforced. Ten is the denominator for
progress, not a limit on what may be recorded, and a cancelled Session counts for nothing
while staying visible — so the cap is not "four rows" but "four non-cancelled rows", and
cancelled rows accumulate without bound. Blocking a legitimate eleventh Session to defend a
number nobody is disputing is the kind of invented friction
[ADR-0007](./adr/0007-the-tool-generates-the-acquittal.md) warns has an escape route.

**Access control.** ADR-0004's rule — delivery open to everyone signed in, money Staff-only —
is application code, not RLS. Better Auth means there is no `auth.uid()` in Postgres, so
policies would need `SET LOCAL` on every transaction plus a non-superuser role with `FORCE
ROW LEVEL SECURITY`: a great deal of machinery for one two-role rule. Every money-reading
query therefore takes the authenticated Person and refuses a non-Staff caller, at a single
choke point in `@sugt/db`. See
[ADR-0011](./adr/0011-supabase-and-better-auth.md).

Note what this is _not_: the public/internal boundary is still structural, held by the
dependency graph. It is only the Staff/Teaching Team line that is a runtime check.

**Who a caller is, is a type.** This document used to leave open whether the Staff-only choke
point needed a sibling for "no Person at all, but a valid secret". It does, and the sibling is
a type rather than a second guard. Three kinds of caller now reach `@sugt/db`, and they are
three named types rather than one with optional fields:

| Caller             | Is                                                      | May read                      | May write                   |
| ------------------ | ------------------------------------------------------- | ----------------------------- | --------------------------- |
| `Person`           | somebody signed in whose `person` row is still `active` | delivery; money only if Staff | their own records           |
| `ServiceCaller`    | `@sugt/public`, holding `AGGREGATES_SECRET`             | the three aggregate payloads  | nothing                     |
| `ParticipantToken` | a live Session feedback token                           | nothing                       | `participant_feedback` only |

Every query takes one, and the money queries accept only `Person`. A single type carrying
optional fields would turn "is this a Staff caller" into a runtime shape check — which is
precisely what the composite foreign keys avoid everywhere else in this schema, and the same
argument applies one layer up.

**A person on two overlapping Perjadins.** Genuinely preventable with `btree_gist` and an
exclusion constraint, and genuinely useful — but it would mean denormalising the date range
onto `group_member`. Not worth a duplicated range today.

**That a record belongs to a Session that actually happened.** Nothing stops a Class Record,
Session Record or Participant Feedback being filed against an `arranged` or `cancelled` Session.
Left to the application, which only offers the form on a delivered one.

**That the professor who filed a Class Record actually taught that Session.** The composite
foreign key holds that they are Teaching Team, not that they were in that room —
`session_teacher` says who taught, and comparing against it is a query. Worth knowing because
"who still owes what" is computed from exactly that comparison.

**That `session_teacher` and `class_record` are kept in step.** There is no foreign key between
them: `class_record` references `session (id)` and `person (id, role)` and nothing else. So a
Record filed by a professor the Session never named is a legal row, and removing a named
professor does not delete the Records they already filed. The divergence is permitted rather
than tolerated — `session_teacher` stays editable by Staff after delivery, because until a
mis-named professor is removed they owe three Class Records they cannot honestly file, and there
is no other route to correcting it. The Session screen therefore reports filed against expected
and does not reconcile them; showing both numbers is the honest rendering of two sets that can
legitimately differ.

**That all six Class Records exist.** Nothing is required and nothing is blocked; the missing
ones are a list to chase, computed from `session_teacher` × the three Class kinds. See
[who still owes what](#who-still-owes-what).

**That only the Group filed a Perjadin Evaluation.** `filed_by_person_id` references `person`,
not `group_member`, so the database will accept an evaluation from someone who was not on the
trip. This is the second rule wholesale Group replacement costs — the composite foreign key that
would enforce it either freezes the Group forever or destroys every evaluation when one is
corrected. See [why there is no foreign key to the Group](#why-there-is-no-foreign-key-to-the-group).

**That the PIC filed theirs.** "The PIC's Record is required" is the one completeness rule in
the delivery half, and it is unenforceable in the database — the PIC is itself a `coalesce`
across two tables, and nothing can require a row to exist. It is a query the Session screen
runs, not a constraint.

**Anything about who submitted Participant Feedback.** No de-duplication, no rate limit, no
proof the submitter attended. The token's expiry is the only gate, and it is a weak one by
design — see [ADR-0012](./adr/0012-participants-write-through-a-short-lived-session-token.md).
Rate limiting belongs at the edge, not in a constraint.

**That the token was still live when feedback arrived.** `expires_at` is a column, not a
gate; nothing stops a direct insert after it has passed. The handler that resolves the token
is what enforces it.

**That a Story's cover is one of its own photographs.** `story.cover_photo_id` references
`story_photo (id)` alone, so nothing prevents one Story carrying another Story's photograph as
its cover. The device that would hold it is the one this schema reaches for everywhere else — a
`unique (id, story_id)` on `story_photo` and a composite foreign key into that pair — and it is
not added today because the editor only ever offers a Story the photographs uploaded to it. If
that proves optimistic, that is the upgrade: a `unique (id, story_id)` on `story_photo`, and
`story`'s single-column foreign key replaced by `(cover_photo_id, id)` referencing it. A null
cover still passes, under the same `MATCH SIMPLE` rule that lets offline Sessions carry no PIC
columns.

**That a Story with photographs has a cover before it is published.** This is the only gate in
the product and the database holds no part of it: `published_at` is a nullable timestamp and
nothing ties it to `cover_photo_id`. The editor withholds the control, so a direct `update`
would publish an uncovered Story without complaint. See [Stories](#stories) for why the gate
exists at all.

### What deleting a Perjadin does

`group_member` cascades. `transaction` cascades, and `transaction_evidence` cascades from
that — so deleting a Perjadin destroys its acquittal, objects in the `receipts` bucket
included, and nothing warns you.

`session.perjadin_id` deliberately does **not** cascade and has no `on delete` action at all,
so an offline Session blocks the delete. A trip that produced teaching cannot be quietly
erased; its Sessions have to be dealt with first. Verified, along with the fact that the
cascade and the deferred PIC foreign key resolve against each other rather than deadlocking.

---

## Still open

- **Whether 7 is the right line.** It is a guess, and a wide one — roughly the bottom
  two-thirds of a ten-point scale surfaces, and the same number makes prose mandatory. It sits
  in three index predicates, so moving it is a migration. Worth reading the first month of the
  concerns list before it settles.
- **Whether the four rubrics are right.** Twenty Aspects across four forms, all proposed here
  rather than drawn from anything DITSAMA already uses. If a rubric exists on paper, it should
  win. The Class Record's seven is the one to scrutinise first, since it is filed six times a
  Session.
- **Whether `coordination` survives.** It asks the PIC to rate their own planning, which people
  do generously. Kept because a low one is then very informative and nobody else can judge it,
  but it is the Aspect most likely to be noise.
- **Whether a Perjadin Evaluation is required of anyone.** Nothing currently is — unlike a
  Session Record, where the PIC's is expected. The PIC is the obvious candidate.
- **What else the Participant form asks for.** Right now: Class, three Ratings, comment, name.
  A role or year group would be a column, not a redesign.
- **The four Cluster Problems are placeholders.** Invented here to be plausible per Cluster and
  workable from both Streams; they are not DITSAMA's. Replace them by editing
  `packages/db/seed/reference-data.sql` and re-running, not by updating the rows — the seed
  overwrites that column like every other one.
- **The acquittal's real paperwork.** Still unobtainable until the first Perjadin is filed, so
  the export ships generic. **What a transaction is categorised by is no longer part of this
  question** — see [Money](#money); the categories came off the approved budget rather than off
  a form nobody has read. What remains open is the document those figures are eventually typed
  onto, and whether it wants anything `transaction` does not already hold.
- **The publishing tables are designed but not written.** [Stories](#stories) has the
  contract; it is not yet Drizzle, not yet migrated, and not yet checked against a real
  Postgres the way the rest of this document was.
- **The founding-Staff seed.** A separate artefact from `reference-data.sql`, holding the
  rows that break the sign-in bootstrap and nothing else. See
  [ADR-0013](./adr/0013-people-are-added-in-the-tool-and-their-role-is-write-once.md).
- **The aggregates endpoints.** Four routes on `@sugt/internal` across three lifetimes — scope,
  delivery, the published-Stories list and Story detail — read server-side by `@sugt/public`
  with a shared secret, cached per
  [ADR-0014](./adr/0014-the-public-site-uses-the-pre-cache-components-caching-model.md) and
  versioned per [ADR-0008](./adr/0008-public-narrative-is-authored-in-the-internal-app.md).
  Whether the choke point needed a sibling is settled — it did, and it is a type; see
  [what the database does not hold](#what-the-database-does-not-hold). What remains open is the
  exact field shape of each payload.
