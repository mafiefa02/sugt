# What we're building

Two applications for the STEM & Research Track of SUGT: a public site that shows the
Programme to the world, and an internal tool that tracks its delivery and travel
administration.

This document describes their **surfaces** — what exists on screen and how it behaves.
It assumes the vocabulary in [`CONTEXT.md`](../CONTEXT.md) and does not repeat it. Why
any given decision was made is in [`docs/adr/`](./adr); this file links out rather than
re-arguing.

Where something here is proposed but not yet ratified, it says so.

---

## The public site

`@sugt/public`. Audience: the ministry, participating Schools, and anyone who goes
looking for the Programme. It doubles as DITSAMA ITB's portfolio, which is the reason
it exists at all.

**At launch it leads with scope, not delivery.** Schools committed, Clusters, Topics,
provinces covered, who is involved. Those are true on day one and impressive from the
start. Delivery figures — Sessions delivered, Schools reached — appear as they accrue.
Conflating the two means publishing "0 of 42 Schools reached" at launch, which is worse
than publishing nothing.

**Scope figures are reference data.** Schools are fixed; Clusters and Topics are fixed
once allocated. They are static facts, not queries, so the first release needs no
database and no endpoint.

**Delivery figures come from an aggregates endpoint** served by the internal app. The
public app holds no database credentials of its own — that is what makes
[ADR-0001](./adr/0001-public-site-reads-aggregates-only.md) and
[ADR-0002](./adr/0002-two-apps-in-a-pnpm-workspace.md) constraints rather than
conventions.

**Narrative is authored for publication, never harvested.** Stories and photographs are
written deliberately by Staff. Session Records and Perjadin Reports never reach a public
page — not filtered, not flagged, not summarised. A Session Record is only worth keeping
if its author is certain it will never be public.

Content is in Indonesian. Published material may name Schools and show students and
their work; the Programme's enrolment terms cover media consent, so nothing needs
building around permissions.

---

## The internal tool

`@sugt/internal`. Two roles, and no third: **Staff** (DITSAMA employees, leadership
included) and **Teaching Team** (the professors who deliver Sessions). Sign-in is Google,
restricted to an invite list.

Access splits along one line: **delivery data is open, money is not.** Anyone signed in
can read every Session, Session Record and progress view — with Groups assembled per
Perjadin and no standing team per Cluster, that openness *is* the continuity mechanism.
Perjadin Reports and their financial detail are Staff-only. Writing stays with the
record's owner throughout. Publishing to the public site is Staff-only; every Group
contains a Staff member by construction, so no trip's material is unreachable.

### Coverage view — the landing screen

Every School with its delivered count, grouped by Cluster. Answers "where are we
overall" at a glance.

It shows counts, and nothing else. No health indicator, no flagging, no colour. Nothing
is ever "overdue" either — no Session ever asserted a due date — so a School behind on
pace shows a low delivered count and noticing that is a human reading the number. See
[ADR-0006](./adr/0006-sessions-are-created-when-arranged.md).

It is also where trip planning starts: select Schools here and create a Perjadin from
them. Those counts are what decides where a Group goes next, so the decision gets made
in front of them rather than from memory.

### Concerns list

A plain list of Session Record parts marked *some concerns* or *struggling*, across all
Schools, newest first, each linking to the Record it came from.

This is the only place the "how it went" pick is aggregated, and the only reason it is
worth collecting at all — it lets someone find trouble without opening 42 Schools' worth
of Records. Deliberately a separate screen rather than a column on the coverage view:
pace and health are different questions and get different surfaces.

### Sessions

A School receives **ten**: four offline, six online. Each teaches all three of its
Classes.

A Session comes into existence **when it is arranged** — when a Perjadin is planned or an
online meeting scheduled — never before. The full ten are not laid out in advance with
target dates, because those dates would be invented and a schedule nobody maintains
displays confident wrong information. Progress reads "3 of 10 delivered" without any
planned rows existing.

An arranged Session is then delivered or **cancelled**. A cancelled Session persists,
flagged with a reason. It counts for nothing, but a School that was planned for and
missed looks different from one nobody has reached yet — which is the actionable
difference.

### Perjadin

Created inside the tool, because the Group rule is enforced at creation: **one PIC, and
at least one Teaching Team member assigned to each Stream.** Roles are exclusive, so a
valid Group is always at least three people, around four in practice. Two professors
genuinely cover all six teaching threads, because each covers their Stream across all
three Classes.

Creation is a plain validated form — pick Schools, dates and people. It is not a planning
aid: no ranking, no suggestions, no coverage data inside the form itself.

**It is launched from the coverage view**, by selecting Schools there, rather than from a
nav menu. The form stays deliberately dumb; the context comes from where you started.
Delivered counts are the figure that decides where a Group goes next, so whoever plans a
trip arrives having just read them instead of working from memory. That costs nothing to
build and is the whole of the tool's contribution to the decision.

**Creating a Perjadin is what brings its Sessions into existence** — one per School on
the trip. This form is the arranging.

The **Advance** is fixed during trip planning and transferred to the PIC before
departure, so a Perjadin is never in an unfunded state.

Offline Sessions happen during a Perjadin. **Online Sessions have no Perjadin at all** —
which is why counting trips never tells you how much teaching has happened, and why six
of every ten Sessions are invisible to anything trip-shaped.

### The acquittal — the most important screen

The PIC accounts for the whole Group. They enter each transaction that consumed the
Advance, attach its evidence, and export a filled template of the acquittal paperwork.
Whatever is left is returned to the Treasurer.

Transactions can be entered **as they happen or after returning** — whichever suits.
Both are first-class paths. There is no offline support; capture needs connectivity, and
where it fails the PIC enters it later, losing convenience but never data. Offline is
worth adding eventually, not worth blocking on.

Receipts from the other travellers reach the PIC however they reach them today. The tool
does not collect them from Group members; it tracks who is still outstanding so the PIC
has a checklist rather than a memory.

A deadline is recorded and shown with days remaining. **Nothing is gated.** DITSAMA sets
that deadline itself, and the tool is never stricter than the process it serves —
invented friction has the same escape route as duplicated work.

This screen is load-bearing in a way the others are not. Nothing structurally compels a
PIC to use this tool: the Treasurer accepts any format. So it has to be plainly better
than a spreadsheet, a calculator and a folder of WhatsApp photos — evidence attached to
the line it belongs to, arithmetic done for you, nothing retyped to produce the document.
See [ADR-0007](./adr/0007-the-tool-generates-the-acquittal.md), including what to do if
that bet does not land.

### Session Record

One per Session, with **six parts** — one for each Class in each Stream. Each part is
owed by the Teaching Team member who taught that Stream, so each of the two professors
owes three parts per Session. The PIC may write on someone's behalf; the part records who
actually wrote it, so a first-hand account stays distinguishable from a second-hand one.

Each part carries four fields:

| Field | Purpose |
|---|---|
| **Covered** | What was taught. |
| **How it went** | A pick, not prose — on track / some concerns / struggling. Prose cannot be aggregated; this is what feeds the concerns list, and is the only field in the system anything counts. |
| **Next group should know** | The handover. With no standing team per Cluster, this sentence *is* the institutional memory. |
| **Blocking** | Something actionable by someone back in Bandung. Prose only — nothing tracks it to closure, nothing owns it, and it carries no status meaning anywhere. It is there for the next Group to read. |

Six parts is a real ask of authors who have no structural reason to open the tool at all,
so what is required scales with what happened. **The pick is mandatory on all six parts.
The prose fields are optional while it reads *on track*, and required as soon as it does
not.**

A Session where everything went well costs six taps. A Session with a problem demands an
account of it — which is the only time the writing was worth having anyway. Nobody ends up
typing "went fine" six times, so a filled prose field always means something. The cost is
that a genuinely useful observation about a healthy Class can go unwritten because nothing
prompted for it.

### Publishing

Staff write public stories and upload photographs here; the public app fetches published
items through the same endpoint as the aggregates. This is deliberately *not* in the
first release — launch content is hand-seeded in the repo, and the publishing bottleneck
it exists to prevent is a month-six problem. See
[ADR-0008](./adr/0008-public-narrative-is-authored-in-the-internal-app.md).

---

## What it deliberately does not do

Absences look like oversights unless they are written down. These are decisions.

- **No stages** between a School's first and last Session. Progress is delivered
  Sessions out of ten, and nothing else.
- **No Project Teams and no Final Projects.** Several hundred exist across the Programme;
  none are tracked. They reach the public as curated showcase pieces, never as records.
- **No outcome tracking beyond the "how it went" picks.** Every further outcome field
  competes with the six that already exist, and data that will not be entered is worse
  than data that is absent — a half-filled field looks like a system of record and is not
  one.
- **No admin screens for Schools, Clusters or Topics.** They are fixed reference data,
  seeded by migration.
- **No scheduling, no overdue, no alerts.**

The consequence, stated plainly so nobody builds against the opposite: *"has this School
had all its Sessions?"* is answerable. *"Is this School finished?"* is not. See
[ADR-0009](./adr/0009-the-tool-tracks-delivery-not-outcomes.md).

---

## Still undecided

- When a Final Project is due.
