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

**Province**:
The Indonesian province a School sits in. Nothing is organised by Province — it is not a Cluster and does not group anything — but the number of them the Programme reaches is one of the figures the public site leads with, and it is what says which Time Zone a School keeps.
_Avoid_: region, area, location

**Time Zone**:
Which of Indonesia's three — **WIB**, **WITA** or **WIT** — a School keeps. A Province sits wholly in one, so a School's is its Province's and is never stated separately. It is what makes a Session's start time mean something: 09:00 at a Papua School is not 09:00 to the professor reading the screen in Bandung.
_Avoid_: timezone (one word), offset, UTC offset, region

**Kabupaten/Kota**:
The regency or city a School sits in, one level below the Province. Kept in Indonesian because the level covers both a _kabupaten_ and a _kota_ and no single English word means the same thing.
_Avoid_: city (a Kabupaten is not one), regency (a Kota is not one), district, municipality

**Cluster**:
A group of Schools sharing one Topic. Broadly regional, but not tightly so — one Cluster reaches from Kalimantan to Papua Barat Daya, so a Cluster is never a plausible single journey. There are four, and they are allocated and fixed.
_Avoid_: region (the Cluster is the unit; the island groups a spreadsheet may show are not a level the Programme is organised by)

**Sub-Cluster**:
A set of Schools inside one Cluster close enough to each other to be reached on **one journey**. It is the unit an offline Session's travel is planned around: a Cluster is never a plausible single journey and a Sub-Cluster is exactly one. Unlike the Cluster, it is not allocated to DITSAMA by anyone — it is DITSAMA's own judgement about what is near what, and so it is the one piece of reference data the tool lets Staff correct. The team says _Kelompok Sekolah_; "Sub-Cluster" says the same thing and says its relationship to the Cluster as it does so.
_Avoid_: Group (reserved for the travelling party — a Sub-Cluster is Schools, a Group is people), cluster (unqualified — it names the level above), region, area, zone (reserved against time)

**Topic**:
The subject matter assigned to a Cluster. Each Cluster carries a different one. Allocated, and fixed.

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
A single teaching occasion at one School — one date, one start time, one mode, offline or online — at which all three of its Classes are taught. Its start time is local to the School, in the School's Time Zone, whichever mode it is and wherever the people teaching it are. Comes into existence when it is arranged, not before. The team says _Sesi_; it translates cleanly.
_Avoid_: visit, teaching, meeting, class (a Session is an occurrence; a Class is people)

### People and travel

**Person**:
A named human the Programme's records refer to — Staff or Teaching Team, never both. A Person is named before they ever sign in, because a Group can be formed around someone who has not.
_Avoid_: user (a sign-in identity, which a Person may or may not yet have), member, participant, resource

**Staff**:
A DITSAMA ITB employee working on the Programme, the Programme's leadership included.
_Avoid_: leadership, admin, organiser (senior Staff are Staff; there is no separate role)

**Teaching Team**:
The professors and instructors who deliver Sessions — a maintained roster of named People, not simply whoever happened to teach. A member is assigned to a Stream when a Group is formed, not permanently; someone able to teach both is available for both.
_Avoid_: lecturers, trainers, facilitators

**Perjadin**:
An authorised duty travel — one Group, one date range, one Sub-Cluster — that must be accounted for administratively afterwards. The Sub-Cluster is what the Group goes to; the Schools it teaches at are that Sub-Cluster's, each on its own date and at its own time inside the range.
_Avoid_: trip, visit, travel, duty travel (a Perjadin is the authorisation and its accounting, not the journey; the English translations name something vaguer)

**Group**:
The people who travel on one Perjadin — around four, drawn from Staff and Teaching Team for that Perjadin alone. Groups are not standing teams and are not tied to a Cluster.
_Avoid_: team, squad, class

**PIC**:
The Staff member accountable for one piece of work being filed. A Perjadin has one, answerable for its administrative reporting; an online Session has one of its own, since it has no Group. The PIC files the Session Record — the account of the visit — and no Class Records, because they organised the Session rather than taught it.
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
What the PIC says about one Session as a whole — the visit rather than the teaching. Rates five Aspects: **Facilities**, **Turnout**, **School support**, **Timing** and **Coordination**. Filed by Staff, who organised the Session and taught none of it, so it asks nothing about how a cohort got on.
_Avoid_: report (unqualified), notes, minutes, evaluation (unqualified — it names none of the four)

**Class Record**:
What a Teaching Team member says about one **Class** they taught at one Session. Rates seven Aspects: **Comprehension**, **Participation**, **Readiness**, **Materials**, **Delivery**, **Facilities** and **Timing**, plus what was covered, what went wrong and what to do differently. Six per Session make the full set — two professors, one per Stream, each filing for all three Classes.
_Avoid_: Session Record (that is the PIC's, and covers the visit), part (the old six-part structure is gone), class evaluation

**Aspect**:
One of the named things an evaluation scores. Each of the four evaluations has its own list, because each asks a question only that filer can answer — the PIC never saw comprehension, a Participant cannot grade their own readiness, and nobody but the Group slept in the hotel.
_Avoid_: category, criterion, dimension, metric, section

**Rating**:
The score one person gives one Aspect, from 1 to 10. Ratings are the only thing in the system anything counts. An Aspect reaches the concerns list when any single Rating of it is 7 or below — one low score is enough and is never averaged away — and on a Class Record or a Session Record, a Rating that low cannot be filed without saying why.
_Avoid_: grade, mark, health, RAG, status

**Perjadin Evaluation**:
How the trip went, as against how the teaching went: a Rating for each of **Lodging**, **Transport**, **Meals** and **Punctuality**, plus what went wrong and what to do differently. Only the Group that travelled may file one, and each of them files at most one. Open to anyone signed in — it carries no money.
_Avoid_: travel evaluation ("travel" is reserved against **Perjadin**), trip report, Perjadin Report (that is the acquittal, and is Staff-only)

**Participant**:
Someone taught at a Session — a member of a GTK, MS or Student Class. The Programme's records never name Participants, except where one names themselves in Participant Feedback.
_Avoid_: attendee, student (only one of the three Classes is students), user, respondent

**Participant Feedback**:
What one Participant says about the Class they sat in: a Rating of **Materials**, **Instructor** and **Relevance**, a comment, and a name they type themselves. Left without signing in, through a link live only briefly. Nothing asks them to rate themselves — Comprehension, Participation and Readiness are on the Class Record precisely because they are judgements about the room. Deliberately not part of any internal record; the two are filed by different people who expect different readers.
_Avoid_: review, survey, evaluation (unqualified), Class Record, Session Record

**Final Project**:
The artefact one Project Team produces against its Cluster's Problem, worked on across the closing stretch of the Programme.
_Avoid_: output, deliverable, capstone

### Publishing

**Story**:
A piece of narrative written by Staff for publication on the public site — prose and photographs about one **School**, written by someone who knows it is public as they write it. A Story is authored, never derived: no **Session Record**, **Class Record**, **Participant Feedback** or **Perjadin Report** is ever a source for one. The team says _Cerita_; it translates cleanly.
_Avoid_: post (imports blog assumptions — a feed, comments, an author byline — none of which apply), article, publication (that is the act), content, Session Record

**Field Story** / **Final Project Story**:
The two kinds a **Story** may be. A Field Story is an account of teaching at a **School**; a Final Project Story is a curated piece about what a **Project Team** produced. They differ in where the public site lists them and in nothing else — same author, same photographs, same rule that neither is derived from a record. A Final Project Story is how a **Final Project** reaches the public without becoming a tracked record.
_Avoid_: showcase (that is the section, not the piece), case study, portfolio item

## Relationships

- The **Programme** is divided into **Tracks**; DITSAMA ITB holds the STEM & Research **Track**
- The **Track** has exactly two **Streams**: STEM and Research
- The **Track** covers four **Clusters**
- A **Cluster** contains many **Schools** — between six and seventeen; a **School** belongs to exactly one **Cluster**
- A **Cluster** divides into **Sub-Clusters**; a **Sub-Cluster** sits in exactly one **Cluster** and a **School** belongs to exactly one **Sub-Cluster**, so the **Sub-Clusters** of a **Cluster** partition its **Schools** with none left over
- A **Sub-Cluster** of one **School** is legal — a School far from every other must still be reachable, and pairing it with a distant one to avoid a **Sub-Cluster** of one would be a lie about the journey
- A **School** sits in exactly one **Kabupaten/Kota**, which sits in exactly one **Province**
- A **Cluster** spans several **Provinces**, and a **Province** never spans **Clusters**
- A **Province** keeps exactly one **Time Zone**, and a **School**'s is its **Province**'s
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
- A **Session** records which **Teaching Team** member taught each **Stream**, whether or not it had a **Group** — which is how an online **Session** still knows who was in the room and therefore who might file a **Session Record**
- Offline **Sessions** happen during a **Perjadin**; online **Sessions** have no **Perjadin** at all
- A **Perjadin** goes to exactly one **Sub-Cluster**, and every **School** it teaches at belongs to that **Sub-Cluster**
- A **Perjadin** need not reach every **School** in its **Sub-Cluster** — the **Sub-Cluster** says which **Schools** are eligible, the plan says which are visited this time
- Each of those **Schools** gets its own **Session**, on its own date and at its own start time inside the **Perjadin**'s range — the **Group** travels once and teaches on several days
- No two **Sessions** on one **Perjadin** share a date _and_ a start time; the **Group** cannot be at two **Schools** at once
- Online **Sessions** are arranged one **School** at a time, because each is held at a moment of its own — there is nothing a batch of them would share
- A **Perjadin** is funded by an **Advance**, fixed when the trip is planned and transferred to the **PIC** before departure
- A **Perjadin** yields exactly one **Perjadin Report** covering the whole **Group**, filed by its **PIC**, itemising every transaction with evidence and reconciling them against the **Advance**
- Whatever is left of an **Advance** is returned to the **Treasurer**
- An offline **Session**'s **PIC** is its **Perjadin**'s; an online **Session** has a **PIC** of its own, drawn from **Staff**
- A **Session** is judged from three vantage points, each with its own **Aspects**: the **PIC** files one **Session Record**, each **Teaching Team** member files a **Class Record** per **Class**, and **Participants** leave **Participant Feedback** on the **Class** they sat in
- Six **Class Records** are the full set for a **Session** — two professors, one per **Stream**, each filing for all three **Classes**
- **Stream** needs no field on a **Class Record**: it follows from who filed it. Two **Class Records** on one **Class** are STEM and Research disagreeing, which is worth having
- A **Rating** of 7 or below cannot be filed on a **Class Record** or a **Session Record** without saying what went wrong. A **Participant** owes nothing and is held to no such rule
- Nothing is required and nothing is blocked. The tool names who has not filed so they can be chased; **Participants** cannot be named, because nobody knows who was in the room
- **Participant Feedback** is never part of a **Session Record**, and neither is derived from the other
- Every member of a **Group** may file one **Perjadin Evaluation** on their **Perjadin**, and nobody else may
- One **Perjadin** may cover several **Schools**, so it sits behind many **Session Records**
- A **Story** is written by **Staff** about exactly one **School**, and is the only Programme narrative a public page ever carries — nothing filed after a **Session** or a trip is ever a source for one
- A **Story** may name a **Stream**, since a piece is usually about one; its **Cluster** is the **School**'s and is never stated separately
- A **Story** is never about a **Perjadin**. Public narrative and the trip that carries the money stay apart

## Example dialogue

> **Dev:** "School 17 had a **Session** last week — can I tick it off?"
> **Domain expert:** "Tick off the **Session**, yes — all three **Classes** get taught every time. But read the **Class Records**: the **Student Class** scored 4 on **Comprehension** from both professors."
> **Dev:** "Both? So there are two records for one **Class**."
> **Domain expert:** "Six for the **Session**. Two professors, three **Classes** each. If STEM says 8 and Research says 4 on the same cohort, that is the most useful thing on the screen."
> **Dev:** "And the **PIC** files one of those six?"
> **Domain expert:** "None of them. The **PIC** did not teach — they file a **Session Record**, about the visit: was the room usable, did people turn up, did the School help. Different questions, because they were standing at the back."
> **Dev:** "So which **Class** is in trouble at School 17?"
> **Domain expert:** "Now you can ask that. It is on the concerns list by **Class** and by **Aspect** — and a 4 always comes with an explanation, because nobody can file one without."
> **Dev:** "And the **Participant Feedback** goes in the same place?"
> **Domain expert:** "No. Never put those together. A **Class Record** gets written frankly because only colleagues read it."
> **Dev:** "So to know how much teaching has happened overall, I count **Perjadins**?"
> **Domain expert:** "No — count **Sessions**. Six of a School's ten are online and never had a **Perjadin** at all."

## Flagged ambiguities

- "domain" was used both for the STEM & Research **Track** and for the web address the site is served from (the public site versus the internal tool on its own subdomain) — resolved: **Track** for the former, "domain" only ever means the web address.
- "event" was used for the whole of SUGT — resolved: the whole is the **Programme**; "event" is free for individual occurrences.
- "the STEM and Research domain" (one thing) and "2 domains (STEM and Riset)" (two things) were both used — resolved: one **Track** containing two **Streams**.
- The team says "Riset", "Perjadin" and "Sesi"; the codebase is English — resolved: **Research** and **Session** translate cleanly and are used; **Perjadin**, **PIC**, **GTK** and **MS** do not and are kept.
- **Classes** were first described as two, split by **Stream** ("2 classes since we're handling 2 domains"), and later as three, split by audience (GTK, MS, students) — resolved: the division is by audience. **Stream** is subject matter that every **Class** receives, never a way of dividing cohorts.
- **Teaching Team** was open between "a fixed named body" and "whoever teaches" — resolved: a maintained roster. A **Group** names its **Teaching Team** members when the **Perjadin** is planned, before anyone has taught anything, so they have to be nameable in advance.
- "user" and **Person** were used interchangeably — resolved: a **Person** is a human the records name; a user is a sign-in identity that a **Person** may not have yet. A **Group** can contain a **Person** who has never signed in.
- A **Session Record** was once six parts split by **Class** and **Stream**, each owed by whoever taught that **Stream** — resolved: the unit is the person filing, not the teaching thread, and **Stream** does not divide it at all.
- What a **Rating** is attached to moved twice: first to each **Class**, then to each **Aspect** — resolved: **Aspects**. A score against a cohort said only _that_ a **Session** went badly; a score against an **Aspect** says _what_ did. Nothing counts **Classes** any more.
- "evaluation" was used for three different things — the internal **Session** form, the **Participant** one, and the travel one — resolved: they produce a **Session Record**, **Participant Feedback** and a **Perjadin Evaluation** respectively. Unqualified "evaluation" names none of them.
- The team says "evaluation form" for both the internal one and the **Participant** one — resolved: the internal form produces a **Session Record**; the **Participant** one produces **Participant Feedback**. "Evaluation" unqualified names neither, because the whole point is that they are different documents.
- The public narrative had three names and no term — "stories and photographs" in product.md, "published items" in ADR-0008, _Cerita_ in the design — while every internal record had a precise one. Resolved: one authored piece is a **Story**. "Publishing" remains the act, and names no document.
- The unit an offline **Session**'s travel is planned around was the **School** — a **Perjadin** was planned by picking Schools one by one and its destination was free text — while the thing actually being travelled to was a handful of Schools near each other. Resolved: the **Sub-Cluster** is that thing and is now named. A **Perjadin** goes to one, and the Schools follow from it rather than being assembled by hand each time.
- **Sub-Cluster** was very nearly called a "school group", which is unusable: **Group** is the travelling party, so "the group goes to the school group" names two different kinds of thing with one word in one sentence. _Kelompok Sekolah_ — what the team says — was the other candidate and was rejected on the rule stated at the top of this file: Indonesian is kept only where no English term means the same thing, and unlike **Perjadin** or **GTK**, this concept translates. "Sub-Cluster" also carries its relationship to the **Cluster**, which "Kelompok Sekolah" does not.
- A **Session** was a calendar day and nothing finer, on the ground that Indonesia spans three time zones and a date needs no zone to be unambiguous. Resolved: a **Session** now carries a start time as well, and the reasoning is preserved rather than overturned — the time is local to the **School**, and the **Time Zone** that makes it meaningful comes from the **Province**, which is a fact the Programme already held. What was rejected is storing a Session as an _instant_, which would have made every reader convert before they could read it.
- The source spreadsheet groups **Schools** by island (Sumatera, Jawa, Kalimantan, Sulawesi/Maluku/Papua) and separately by numbered **Cluster**, and the two do not agree — Jawa splits across two **Clusters** and Kalimantan merges with Sulawesi into one — resolved: only the **Cluster** is a level the Programme is organised by. The island grouping is a way of reading a spreadsheet and has no term here.

## Open questions

- When is a **Final Project** due? Still unset.
- Each **Cluster**'s **Problem** — the specific challenge drawn from its **Topic**. The four **Topics** are set (Mitigasi Bencana, Smart City, Ketahanan Pangan, Waste Management). The **Problems** currently in the seed are **invented placeholders**, plausible for each **Cluster**'s geography but not DITSAMA's. They exist so screens have something real-shaped to render; treat any of them appearing in a design or a document as unconfirmed.
- No stages are defined between a **School**'s first and last **Session**, and **Final Projects** are not tracked at all. Progress is therefore delivered **Sessions** out of ten, and nothing else — this is the deliberate position, not an oversight.
- The ITB documents a **Perjadin Report** produces have no terms here yet. Their real names — Surat Tugas, SPPD, SPJ or otherwise — need confirming against actual paperwork before they enter the glossary or the code. **No completed example exists to confirm them against**: nobody has filed one for this Programme, and no prior trip's set is available to borrow. The first real Perjadin is what produces one, so these terms stay out of the glossary until then — see the amendment to [ADR-0007](./docs/adr/0007-the-tool-generates-the-acquittal.md).

  **What a transaction is spent on is no longer open.** The Programme's approved budget names eleven recurring line items across all twenty-three travel groups, and those are what a transaction is categorised by. They are Indonesian because they are what goes on the paperwork, and they live in `packages/domain` rather than here: a category is a value a column may hold, not a term this glossary defines. The document those categories will eventually be typed onto is still the open question above.
