# SUGT — STEM & Research Track

Sekolah Unggul Garuda Transformasi, as delivered by DITSAMA ITB for the STEM & Research Track. Public-facing showcase of the Programme, plus internal tracking of delivery and travel administration.

## Language

Domain terms are English, because the codebase is English. Where a concept is specifically Indonesian and has no English equivalent that means the same thing, the Indonesian word is kept — see **Perjadin**. Website copy is Indonesian; that is a presentation concern and does not change the terms below.

### The programme

**SUGT**:
Sekolah Unggul Garuda Transformasi — the Programme commissioned by Kementerian Pendidikan Tinggi.
_Avoid_: "the event" (SUGT contains many events; it is not one)

**Programme**:
The whole of SUGT across all Tracks, Clusters and Schools, for its full duration.
_Avoid_: event, project, campaign

**Track**:
A subject-matter remit within the Programme, assigned to one organiser. DITSAMA ITB holds exactly one: STEM & Research.
_Avoid_: domain (reserved for web addresses), stream (a Track contains Streams), field, area

**Stream**:
One of the two subject-matter divisions inside the STEM & Research Track: **STEM** and **Research**.
_Avoid_: domain, track, subject, Riset (Indonesian for Research; the codebase is English)

**Kementerian Pendidikan Tinggi**:
The ministry that commissioned the Programme and appointed the organisers.

**DITSAMA ITB**:
Direktorat Persiapan Bersama ITB — the organiser appointed to deliver the STEM & Research Track.

### Delivery

**School**:
A participating school receiving teaching under the Programme. Around 42, and the set is fixed.

**Cluster**:
A group of geographically proximate Schools that share one Topic. Not yet allocated, and fixed once it is.

**Topic**:
The subject matter assigned to a Cluster. Each Cluster carries a different one. Not yet allocated, and fixed once it is.

**Problem**:
The specific challenge a Cluster is directed to solve, drawn from its Topic. Both Streams work the same Problem from their own angle.
_Avoid_: challenge, case, brief

**Class**:
A cohort at one School receiving teaching under the Programme. Each School has three, and each is taught in both Streams.
_Avoid_: group (reserved for the travelling party), cohort, batch

**GTK Class**:
The School's teachers and education personnel — Guru dan Tenaga Kependidikan.
_Avoid_: teacher class, staff class (Staff means DITSAMA ITB employees)

**MS Class**:
The School's management — Manajemen Sekolah.
_Avoid_: leadership class, principal class

**Student Class**:
The School's participating students. One per School — the cohort is never divided by Stream; like the others, it receives both.

**Project Team**:
A small set of students within the Student Class who produce one Final Project together. Divided arbitrarily; a School may have anywhere from ten to thirty.
_Avoid_: group (reserved for the travelling party), sub-group, team, squad

**Session**:
A single teaching occasion at one School — one date, one mode, offline or online — at which all three of its Classes are taught. Comes into existence when it is arranged, not before. The team says _Sesi_; it translates cleanly.
_Avoid_: visit, teaching, meeting, class (a Session is an occurrence; a Class is people)

### People and travel

**Staff**:
A DITSAMA ITB employee working on the Programme, the Programme's leadership included.
_Avoid_: leadership, admin, organiser (senior Staff are Staff; there is no separate role)

**Teaching Team**:
The professors and instructors who deliver Sessions. A member is assigned to a Stream when a Group is formed, not permanently — someone able to teach both is available for both.
_Avoid_: lecturers, trainers, facilitators

**Perjadin**:
An authorised duty travel — one Group, one date range, one destination — that must be accounted for administratively afterwards.
_Avoid_: trip, visit, travel, duty travel (a Perjadin is the authorisation and its accounting, not the journey; the English translations name something vaguer)

**Group**:
The people who travel on one Perjadin — around four, drawn from Staff and Teaching Team for that Perjadin alone. Groups are not standing teams and are not tied to a Cluster.
_Avoid_: team, squad, class

**PIC**:
The Staff member on a Group accountable for that Perjadin's administrative reporting.
_Avoid_: lead, owner, manager

### Reporting

**Advance**:
Money for a Perjadin, its amount fixed during trip planning and transferred to the PIC before departure, which the PIC must later account for in full.
_Avoid_: budget, allowance, float

**Treasurer**:
The Staff member who releases an Advance and receives whatever is left of it.
_Avoid_: finance, bendahara (the codebase is English)

**Perjadin Report**:
The acquittal of one Perjadin — every transaction that consumed the Advance, each evidenced, reconciled against what was left over — covering the whole Group and filed by its PIC against a deadline DITSAMA sets for itself.
_Avoid_: report (unqualified), expense report, reimbursement (nothing is claimed back; the money was transferred upfront)

**Session Record**:
The account of one Session, carrying a part for each Class in each Stream — six in all — covering what was taught, how it went, and what is outstanding.
_Avoid_: report (unqualified), notes, minutes

**Final Project**:
The artefact one Project Team produces against its Cluster's Problem, worked on across the closing stretch of the Programme.
_Avoid_: output, deliverable, capstone

## Relationships

- The **Programme** is divided into **Tracks**; DITSAMA ITB holds the STEM & Research **Track**
- The **Track** has exactly two **Streams**: STEM and Research
- The **Track** covers many **Clusters**
- A **Cluster** contains many **Schools**; a **School** belongs to exactly one **Cluster**
- A **Cluster** has exactly one **Topic** and exactly one **Problem**; both **Streams** work that same **Problem**
- A **School** runs three **Classes**: **GTK**, **MS** and **Student**
- Each **Class** is taught in both **Streams** — six teaching threads per **School**
- The **Student Class** divides into ten to thirty **Project Teams**; each produces exactly one **Final Project**
- A **School** therefore ends the Programme with many **Final Projects**, not one
- A **Session** is held at exactly one **School** and teaches all three of its **Classes**
- A **School** receives ten **Sessions**: four offline and six online, the same for every **School**
- A **Session** exists only once arranged, and is then either delivered or cancelled
- A **School**'s progress is delivered **Sessions** against that fixed number; a cancelled **Session** counts for nothing but stays visible as an attempt that failed
- A **Perjadin** carries exactly one **Group** and has exactly one **PIC**
- A **Group** exists for one **Perjadin** only — no **Cluster** has a standing team
- A **Group** must contain one **PIC** and at least one **Teaching Team** member assigned to each **Stream**
- A person is **Staff** or **Teaching Team**, never both, so a valid **Group** is always at least three people
- A **Session** records which **Teaching Team** member taught each **Stream** — which is how online **Sessions**, having no **Group**, still attribute their **Session Record** parts
- Offline **Sessions** happen during a **Perjadin**; online **Sessions** have no **Perjadin** at all
- A **Perjadin** is funded by an **Advance**, fixed when the trip is planned and transferred to the **PIC** before departure
- A **Perjadin** yields exactly one **Perjadin Report** covering the whole **Group**, filed by its **PIC**, itemising every transaction with evidence and reconciling them against the **Advance**
- Whatever is left of an **Advance** is returned to the **Treasurer**
- A **Session** yields exactly one **Session Record**, whether or not it had a **Perjadin**
- A **Session Record** has six parts — one per **Class** per **Stream**
- Each part is owed by the **Teaching Team** member who taught that **Stream**, so each of them owes three parts per **Session**; the **PIC** may write on their behalf, and the part records who actually wrote it
- One **Perjadin** may cover several **Schools**, so it sits behind many **Session Records**

## Example dialogue

> **Dev:** "School 17 had a **Session** last week — can I tick it off?"
> **Domain expert:** "Tick off the **Session**, yes — all three **Classes** get taught every time. But read the **Session Record**: six parts, one for each **Class** in each **Stream**. The **GTK Class** may be thriving while the **Student Class** is stuck on Research."
> **Dev:** "So to know how much teaching has happened overall, I count **Perjadins**?"
> **Domain expert:** "No — count **Sessions**. Six of a School's ten are online and never had a **Perjadin** at all."

## Flagged ambiguities

- "domain" was used both for the STEM & Research **Track** and for the web address the site is served from (the public site versus the internal tool on its own subdomain) — resolved: **Track** for the former, "domain" only ever means the web address.
- "event" was used for the whole of SUGT — resolved: the whole is the **Programme**; "event" is free for individual occurrences.
- "the STEM and Research domain" (one thing) and "2 domains (STEM and Riset)" (two things) were both used — resolved: one **Track** containing two **Streams**.
- The team says "Riset", "Perjadin" and "Sesi"; the codebase is English — resolved: **Research** and **Session** translate cleanly and are used; **Perjadin**, **PIC**, **GTK** and **MS** do not and are kept.
- **Classes** were first described as two, split by **Stream** ("2 classes since we're handling 2 domains"), and later as three, split by audience (GTK, MS, students) — resolved: the division is by audience. **Stream** is subject matter that every **Class** receives, never a way of dividing cohorts.

## Open questions

- When is a **Final Project** due? Still unset.
- No stages are defined between a **School**'s first and last **Session**, and **Final Projects** are not tracked at all. Progress is therefore delivered **Sessions** out of ten, and nothing else — this is the deliberate position, not an oversight.
- Is **Teaching Team** a fixed named body, or just "whoever teaches"?
- The ITB documents a **Perjadin Report** produces have no terms here yet. Their real names — Surat Tugas, SPPD, SPJ or otherwise — need confirming against actual paperwork before they enter the glossary or the code.
