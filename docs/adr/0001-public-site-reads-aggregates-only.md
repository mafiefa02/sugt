# The public site reads aggregates only, never narrative

> **Terminology note.** When this ADR was written, "Session Record" meant every internal account of a Session. It has since narrowed: the PIC's account of the visit is a **Session Record**, and the teaching account — one per Class per professor — is a **Class Record**. **Read every "Session Record" below as covering both.** The Class Record is if anything the sharper case, since it is the one that says a cohort is three weeks behind. Neither ever reaches a public page, and nor does **Participant Feedback**, which is not published either despite being written by people who were not promised confidentiality.

The public site doubles as DITSAMA ITB's portfolio, so live coverage figures — Schools reached, Sessions delivered, provinces, Clusters and their Topics — are derived from real Programme data. Narrative content is authored separately for publication. Session Records and Perjadin Reports are not a source for public pages.

## Why

A Session Record is only worth capturing if it can say "the school had no lab equipment and the students are three weeks behind." That sentence gets written only when its author is certain it will never be public. Make internal records publishable — even behind a flag someone must remember to set — and they degrade to "session went well, students engaged." The tracking half of the system then costs the same to operate and tells us nothing.

Aggregate counts carry no such risk. Nobody softens a session count.

## Considered options

- **Public School pages fed by Session Records with a publish flag.** The richest portfolio and the most persuasive to a ministry audience. Rejected: it makes every Session Record a potential public document.
- **Fully editorial public site, no shared data.** The strongest wall and the simplest to build. Rejected: the headline figures then drift out of date by hand, which is precisely the credibility the portfolio depends on.

## Consequences

- Photos, School stories and any prose on the public site need their own authoring path — they cannot be harvested from what staff file after a trip.
- Aggregates are of two kinds. **Scope** figures — Schools committed, Clusters, Topics, provinces — are true from day one and carry the site at launch. **Delivery** figures accrue and appear as they become real. Conflating them means either publishing "0 of 42 schools reached" at launch or abandoning live figures altogether.
- If someone later proposes surfacing per-School progress publicly, that reopens this decision rather than extending it.
