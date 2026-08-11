# The design handoff, reconciled against the current documents

> **Snapshot, not durable documentation.** A reconciliation of the handoff bundle against the
> repository as of **`c31cec7`, 12 August 2026**. Both sides move: the documents are edited and
> the design is not, so every finding below decays from the moment it is written. It records what
> was true on that day, and is superseded by
> [the first-iteration surface list](https://github.com/mafiefa02/sugt/issues/9) wherever the two
> disagree.

A screen-by-screen reconciliation of `docs/design/design_handoff_sugt_apps/` — its `README.md`
and the ~272KB `SUGT Pages.dc.html` prototype — against [`CONTEXT.md`](../../CONTEXT.md),
[`docs/product.md`](../product.md), [`docs/data-model.md`](../data-model.md) and every file in
[`docs/adr/`](../adr).

**This is findings only.** It records what the design shows and what the documents now say. It
does not recommend what to build, what to drop, or what a first iteration should contain — that
is a separate decision.

---

## Method, and how to read this

The prototype is one scrolling canvas. Every screen is a `<div class="frame">` preceded by a
label of the form `<h2>Title</h2><span>one-line purpose</span>`. Parsing those labels yields
**28 top-level screens** (canvas order, HTML lines 84–819) and **18 further blocks** in the
closing *Flows & states* band (lines 861–1200), plus **three phone frames** whose labels sit
outside both runs. Every screen below is named by its own label, verbatim, with the HTML line
number so a claim can be checked in the file.

**The four buckets are not mutually exclusive, and entries are tagged multiply.** The Final
Project showcase is UNSOURCED *and* renders the wrong unit; **Advance** (line 789) is STALE
*and* UNSOURCED. Forcing one label per screen would lose half the finding.

- **STALE** — the design shows something the documents have since changed or now deny.
- **MISSING** — the documents require a surface the design has no screen for.
- **UNSOURCED** — no data stands behind the screen. Two distinct flavours, kept apart below.
- **VOCABULARY DRIFT** — Indonesian copy naming a concept `CONTEXT.md` calls something else.
- **CLEAN** — consistent with the documents as they now stand.

### The handoff README is not a reliable index of its own HTML

`README.md` § *Screens / Views* enumerates the screens under two headings and closes the internal
list with a single line: *"Flows & states — record-a-Session loop, resolve-a-concern,
publish-a-story, advance approval, offline/loading/error/empty/notification states."* That line
omits five substantial blocks that exist in the HTML: **Persetujuan** (an approver queue),
**Cluster setup** (an admin screen), **Roles & permissions** (a three-role matrix),
**Internal search**, and **Perjadin lifecycle** (a four-state machine). The largest
document-conflicts in the bundle are in exactly the part the README summarises in half a
sentence. Anyone reconciling from the README alone will not see them.

The README is also the source of two claims the HTML does not support — it states
*"Scope figures: 42 Schools · 15 provinces"* while two prototype screens render nine, and it
describes the acquittal export as *"evidence-gated"*, which `product.md` § *The acquittal* does
not.

### Two flavours of UNSOURCED

The task named the Final Project showcase as the known case. The prototype has more than one, and
they are not the same problem:

1. **No data exists anywhere.** Final Project (screens at lines 243 and 1144).
   `docs/data-model.md` § *The glossary is not the schema* lists "Project Team, Final Project —
   **Not stored at all**". ADR-0009 is the decision.
2. **Data exists; no documented route delivers it.** Pencarian (line 261) and Internal search
   (line 1129). `docs/data-model.md` § *Where the code lives* is categorical that
   *"`@sugt/public` holds no Supabase client and no database credentials of any kind"*, and
   `docs/data-model.md` § *Still open* names exactly three routes — *"scope, delivery,
   published Stories"* — matching ADR-0008 § *The endpoint contract*'s *"Three routes, by
   lifetime."* None is a search route. This is weaker than case 1 and is flagged as such
   throughout.

---

# Part A — Public site (`@sugt/public`)

## 1. **Beranda** — *"Homepage — leads with scope, not delivery"* (line 84)

**Mostly CLEAN.** The scope band renders *"42 Sekolah peserta / tersebar di 15 provinsi"*,
*"2 Stream"*, *"3 Kelas / sekolah"*, *"10 Sesi / sekolah — 4 luring · 6 daring"* — which is
precisely `docs/product.md` § *The public site*: *"Four stats lead the page, and only the first
is fetched: 42 Schools across 15 provinces."* The Cerita band's caption *"Ditulis dan dipilih
oleh tim, bukan dipanen dari catatan"* is a faithful rendering of the same section's *"Narrative
is authored for publication, never harvested."*

**MISSING — the absent delivery band.** The screen shows the delivery band populated
(*"128 Sesi terlaksana / 19 Sekolah terjangkau"*) and no other variant exists in the file.
`docs/product.md` § *The public site* requires the other one: *"The delivery band is absent
until there is delivery to report. It renders only once at least one Session has been delivered,
so launch day is scope → Streams → Clusters with no gap."* Launch day is the state with no
design.

**MISSING — last-good-payload behaviour.** Same section: *"A failed fetch never degrades to
zeros… at runtime the last good payload is served indefinitely."* No public screen expresses a
stale-payload or failed-fetch condition; the only error state in the bundle
(*"Gagal memuat data"*, line 1101 band) is an internal-tool frame.

## 2. **Program** — *"How the Track is delivered — Streams, Classes, the 10-Session rhythm"* (line 113)

**Mostly CLEAN.** The three Classes, the 4-offline/6-online rhythm and *"tiap profesor menulis
Class Record per Kelas, dan PIC melengkapinya dengan satu Session Record kunjungan"* all match
`docs/product.md` § *Class Record* and § *Session Record*.

**UNSOURCED (flavour 1) — the closing step strip.** *"Dari Sesi ke Final Project — 01 Sesi ·
02 Problem Cluster · **03 Final Project — Karya penutup hasil kedua Stream**"*. See §"Final
Project" below; the same wrong unit and the same absent data.

## 3. **Cerita** — *"Stories list — authored, filterable"* (line 147) and 4. **Cerita — detail** — *"Single story, authored for publication"* (line 162)

**CLEAN.** A Story list with a Semua/STEM/Research filter and a detail page carrying title, body,
Stream badge, School, Cluster and photographs is exactly the `story` / `story_photo` contract in
`docs/data-model.md` § *Stories*. The list's standfirst — *"Catatan dan foto yang ditulis serta
dipilih oleh tim pengajar dan Staff — **bukan dipanen dari Session Record**"* — states ADR-0001's
wall in the UI copy.

**STALE — the byline names a Teaching Team author.** The detail page reads *"Ditulis oleh **Tim
Pengajar STEM**"*, and the list standfirst credits *"ditulis serta dipilih oleh **tim pengajar
dan Staff**"*. `docs/data-model.md` § *Stories* pins `written_by_role` to `'Staff'` and makes the
pair a composite foreign key into `person (id, role)` — *"**Publishing is Staff-only, and that is
a composite foreign key like every other role rule here.** … without this it would be the one
such rule held by convention"* — so a Teaching Team byline is a row the database refuses.
ADR-0004 § *Publishing*: *"Teaching Team members write internal records and nothing public."*
(The Publish a story composer at line 1039 gets this right, naming a Staff author.)

## 5. **Cluster** — *"Listing — scope reference data"* (line 178)

**STALE — the unallocated-Cluster state cannot exist.** Two of the four cards read
*"**Belum dialokasikan** — Topik dan Problem ditetapkan setelah alokasi Cluster selesai."*
`CONTEXT.md` § *Delivery* (Cluster): *"There are four, and they are **allocated and fixed**."*
`docs/data-model.md` § *Reference data* makes `cluster.topic` and `cluster.problem` `not null`,
and `school.cluster_id` `not null` with the note *"'a School with no Cluster' is not a state the
coverage view … ever has to render."*

**STALE — Cluster identities and sizes.** The prototype's Clusters are *"Priangan Timur"*,
*"Pantura"*, *"Priangan Barat"*, *"Ciayumajakuning"*, with Topics *"Ketahanan Pangan"* and
*"Energi Terbarukan"*, sized *"4 Sekolah"* and *"3 Sekolah"*. The seeded reality in
`packages/db/seed/reference-data.sql` is **Klaster 1–4** on slugs `mitigasi-bencana`,
`smart-city`, `ketahanan-pangan`, `waste-management` — the four Topics `CONTEXT.md` § *Open
questions* confirms as *"set (Mitigasi Bencana, Smart City, Ketahanan Pangan, Waste
Management)"*. **"Energi Terbarukan" is not one of them.** Sizes are lopsided —
`docs/data-model.md` § *Reference data*: *"Cluster sizes are lopsided — six, seventeen, eleven,
eight — which is worth knowing before anyone builds a screen assuming they are comparable"* —
against the prototype's 4 and 3. Every School named across the whole prototype is West Javanese
(Bandung, Garut, Tasikmalaya, Ciamis, Cirebon, Indramayu, Subang); the seed spans Banda Aceh to
Jakarta and beyond. The one real School name in the file is *"SMAN 8 Jakarta"* on the Teaching
Team dashboard.

## 6. **Cluster — detail** — *"Topik, Problem, Sekolah & delivery as it accrues"* (line 196)

**CLEAN in shape**, carrying the same STALE Cluster identity as above. The School table's
*"Sesi terlaksana — 6 / 10 · 3 / 10 · 1 / 10 · **Belum**"* is `count(delivered)` against
`TOTAL_SESSIONS_PER_SCHOOL`, and rendering nothing-yet as *"Belum"* rather than a zero is
consistent with ADR-0001's objection to publishing zeros.

## 7. **Tentang** — *"About — Programme & organisers"* (line 215)

**STALE — the province figure.** The prose reads *"membawa pengajaran langsung ke 42 sekolah
unggul di **sembilan provinsi**"* while the stat band directly beneath it reads *"15 Provinsi"*.
The documents say fifteen (`docs/product.md` § *The public site*), and `docs/data-model.md`
§ *Reference data* explains why the number is defended by a table: *"provinces covered is a
headline figure on the portfolio site, and a typo in a free-text column silently inflates the
number nobody would think to check."* The prototype contains that inflation in the other
direction, twice — here and on the phone frame.

## 8. **Final Project** — *"Public showcase — what each Cluster produced"* (line 243)

**UNSOURCED (flavour 1) — the known case, confirmed.** `docs/product.md` § *What it deliberately
does not do*: *"**No Project Teams and no Final Projects.** Several hundred exist across the
Programme; none are tracked. They reach the public as curated showcase pieces, never as
records."* `docs/data-model.md` § *The glossary is not the schema*: *"Project Team, Final
Project — Not stored at all."* ADR-0009 is the decision and names them *"the sharpest case."*

**STALE — the unit is wrong, independently of the data.** The screen models a Final Project as
**one per Cluster**: *"Karya penutup tiap Cluster — hasil kerja kedua Stream atas satu Problem
bersama"*, one card per Cluster, and placeholder cards reading *"Cluster Priangan Barat — Final
Project ditampilkan setelah Program berjalan"*. `CONTEXT.md` § *Relationships*: *"The **Student
Class** divides into ten to thirty **Project Teams**; each produces exactly one **Final
Project**"* and *"A **School** therefore ends the Programme with many **Final Projects**, not
one."* A Final Project belongs to a Project Team inside one School — not to a Cluster.

## 9. **Pencarian** — *"Search — across Sekolah, Cluster & Cerita"* (line 261)

**UNSOURCED (flavour 2) — no route delivers it.** Name-matching over Schools, Clusters and
Stories could in principle run against payloads the public app already caches, so the *data* is
not absent the way a Final Project's is. What is absent is a route: `docs/data-model.md`
§ *Still open* documents *"Three routes on `@sugt/internal` — scope, delivery, published
Stories"*, and ADR-0008 § *The endpoint contract* fixes that at *"Three routes, by lifetime."*

One result row goes further than any cached payload can serve:
*"Merancang sensor kualitas air dari barang bekas — **Cerita · menyebut Garut**"* is a full-text
match inside a Story body. Nothing documented provides body-level search, and
`docs/data-model.md` § *Where the code lives* forecloses the public app querying for it:
*"`@sugt/public` holds no Supabase client and no database credentials of any kind."*

## 10. **404** — *"Not found"* (line 283)

**CLEAN.**

## 11–13. Mobile frames: **Beranda — mobile** (line 290), **Cerita — mobile** (line 1176), **Cluster — mobile** (line 1190)

All three the README promises do exist, though two are buried in the closing band rather than
beside their desktop screens.

- **Beranda — mobile: STALE.** The scope grid reads *"42 Sekolah / **9 Provinsi** / 2 Stream /
  10 Sesi per sekolah"* — the second wrong province figure (see Tentang).
- **Cerita — mobile: CLEAN.** Semua/STEM/Research filter, two Story cards.
- **Cluster — mobile: STALE**, carrying the invented Cluster names and the non-existent Topic
  *"Energi Terbarukan"*.

## 14. **School — public page** — *"Cluster → School → its stories"* (line 1161)

**CLEAN.** Breadcrumb Cluster → School, the School's Kabupaten/Kota and Topic, three figures
(*"6 Sesi terlaksana dari 10 direncanakan"*, *"3 Kelas"*, *"2 Cerita terbit"*) and the School's
published Stories. `docs/data-model.md` § *Stories* makes `story.school_id` `not null` and the
only thing a Story attaches to, which is exactly what this page reads.

*Minor drift:* *"dari 10 **direncanakan**"* ("of 10 planned"). ADR-0006 is that no Session is
planned in advance; ten is a fixed denominator, not a schedule.

## 15. **Final Project — detail** — *"One Cluster's closing work, both Streams"* (line 1144)

**UNSOURCED (flavour 1)** and carrying the same wrong unit as the showcase, more explicitly:
*"Karya penutup empat Sekolah dalam Cluster"*, with *"Kontribusi STEM"* / *"Kontribusi
Research"* panels and a *"Sekolah yang terlibat"* badge row. `CONTEXT.md` § *Relationships*
attaches a Final Project to a Project Team within one Student Class, and both Streams work the
Cluster's **Problem**, not a shared artefact.

---

# Part B — Internal tool (`@sugt/internal`)

## 16. **Masuk** — *"Sign-in — Google, restricted to DITSAMA staff"* (line 309)

**STALE — an email-domain allowlist stands where the invite list belongs.** The screen reads
*"Hanya untuk domain **@ditsama.itb.ac.id**. Akun di luar itu akan ditolak."* That is not the
mechanism, and it excludes the people the mechanism was chosen for. ADR-0003 § *Why*: *"Google
sign-in wins on two counts: **the Teaching Team is not guaranteed to be entirely ITB account
holders**, and an SSO integration would land on a university IT department's schedule rather
than ours."* A `@ditsama.itb.ac.id` gate rejects exactly the external professors that reasoning
protects.

What the documents specify instead: `docs/data-model.md` § *Identity* — *"`person` **is** the
invite list from ADR-0003. There is no separate invite table"*, enforced by a
*"`databaseHooks.user.create.before` hook [that] looks up `person` by lowercased email. No match
means it throws, so **an uninvited Google account cannot create a user row at all**."*
`docs/product.md` § *People — the invite list*: *"nobody whose email has no row can sign in at
all."*

**VOCABULARY DRIFT.** *"domain"* is a term `CONTEXT.md` § *Flagged ambiguities* resolves:
*"'domain' only ever means the web address."*

## 17. **Dashboard — Teaching Team** — *"A professor's landing: Class Records owed, upcoming Sessions, no money"* (line 338)

**CLEAN.** Three count tiles (*"4 Class Record belum diisi"*, *"2 Sesi Anda mendatang"*,
*"1 Perjadin Group aktif"*), a *"Perlu Anda isi"* list captioned *"Tanpa tenggat — daftar untuk
dikejar"* — which is `docs/product.md` § *Who still owes what*: *"Nothing is required and nothing
is blocked… What the tool does is name who has not filed, so they can be chased in the group
chat."* The note *"Stream mengikuti pengisi — tidak ada kolomnya"* states `docs/data-model.md`
§ *Class Records*' *"**Stream needs no column.**"* The sidebar (Beranda / Coverage / Perjadin /
Concerns) correctly omits Perjadin Report per ADR-0004.

*See the cross-cutting money-visibility finding below:* this sidebar carries **Perjadin**, and
the Perjadin screens it leads to render money.

## 18. **Dashboard — Staff** — *"Programme overview + this person's PIC work (money is Staff-only)"* (line 370)

**CLEAN, and one of the better-sourced screens.** Six count tiles, per-Cluster coverage bars
captioned *"4 Cluster · ukuran berbeda"* (the lopsided sizes `docs/data-model.md` § *Reference
data* warns about), an Advance strip marked *"Hanya Staff"*, and a PIC work card with
*"Jatuh tempo — 2 hari lagi"*, *"8 Transaksi tercatat"*, *"2 / 4 Bukti anggota masuk"*,
*"Rp 1,9jt Sisa untuk dikembalikan"*. Each maps to a documented derivation: the deadline to
`ends_on + REPORT_DEADLINE_DAYS_AFTER_RETURN` (`docs/data-model.md` § *Travel*: *"There is no
`report_deadline` column"*), the checklist to `group_member.receipts_settled_at`, the remainder
to *"`advance_idr - sum(amount_idr)` … derived, never stored"* (§ *Money*).

The card's footnote is a verbatim rendering of the rule the rest of the bundle breaks:
*"**Tidak ada gerbang** — DITSAMA yang menetapkan tenggat, bukan alat ini."* (`docs/product.md`
§ *The acquittal*: *"**Nothing is gated.**"*) See §"Persetujuan" below — the same acquittal
appears elsewhere in this file behind a four-state approval queue.

## 19. **Coverage** — *"Landing — every School by Sessions delivered, per Cluster"* (line 409)

**CLEAN in behaviour, STALE in content.** Counts only, no colour, no flag — exactly
`docs/product.md` § *Coverage view*: *"It shows counts, and nothing else. No health indicator, no
flagging, no colour"*, and ADR-0006's *"no flagging, no colour, no health indicator."* The
`0 / 10` row renders as a plain count. The Cluster names and School set are the invented West
Java ones (see §"Cluster").

## 20. **Rencanakan Perjadin** — *"Live — pilih beberapa Sekolah, aksi muncul, buka formulir"* (line 446)

**CLEAN as a flow** — multi-select on Coverage, an action bar reading *"{n} Sekolah terpilih
untuk Perjadin"*, then a create form. `docs/product.md` § *Perjadin*: *"**It is launched from the
coverage view**, by selecting Schools there, rather than from a nav menu."*

**MISSING — two fields the form must carry.** Its fields are *"Nama Perjadin"*, *"Sekolah"*,
*"Mulai"*, *"Selesai"*, *"PIC"*, *"Anggota Group"*. Absent:

- **The Advance.** `docs/data-model.md` § *Travel*: *"`advance_idr` is NOT NULL because the
  Advance is fixed at planning and transferred before departure — a Perjadin is never in an
  unfunded state, so there is no nullable phase to model."* `docs/product.md` § *Perjadin* says
  the same. There is nowhere on this form to set it.
- **Per-member Stream assignment.** `docs/product.md` § *Perjadin*: *"the Group rule is enforced
  at creation: **one PIC, and at least one Teaching Team member assigned to each Stream**."*
  `docs/data-model.md` § *The Group* holds `check ((role = 'Teaching Team') = (stream is not
  null))`. The *"Anggota Group"* control offers no Stream per member, so the one form that has
  to enforce the Group rule cannot express it.

**VOCABULARY DRIFT.** *"Nama Perjadin"* against the column `destination`, which
`docs/data-model.md` § *Travel* describes as *"free text: it is what goes on the paperwork."*

## 21. **School detail** — *"10 Sessions — 4 offline · 6 online, each with its record"* (line 497)

**STALE — the ten Sessions are laid out in advance.** The screen renders all ten as rows,
including *"Sesi Daring 4 — **Belum dijadwalkan** · Catat"*, *"Sesi Daring 5 — Belum
dijadwalkan"*, *"Sesi Daring 6 — Belum dijadwalkan"* and *"Sesi Luring 4 — Belum tercatat"*.
`docs/product.md` § *Sessions*: *"A Session comes into existence **when it is arranged** … never
before. **The full ten are not laid out in advance with target dates** … Progress reads '3 of 10
delivered' without any planned rows existing."* ADR-0006 is the whole decision, and
`docs/data-model.md` § *Delivery* restates it: *"there are no planned rows, no target dates and
nothing is ever overdue."* *"Belum dijadwalkan"* ("not yet scheduled") is the language of the
schedule ADR-0006 rejects.

**MISSING — the cancelled Session.** No row in the file shows a cancelled Session or its reason.
`docs/product.md` § *Sessions*: *"An arranged Session is then delivered or **cancelled**. A
cancelled Session persists, flagged with a reason. It counts for nothing, but a School that was
planned for and missed looks different from one nobody has reached yet — which is the actionable
difference."* `session.status` carries `'cancelled'` with a `cancelled_reason` CHECK, and
`SESSION_STATUSES` in `packages/domain/src/index.ts` names it.

**STALE — the record count per Session.** Delivered rows read *"3 Kelas dicatat"* with three
pills, GTK / MS / Student. A Session expects **six** Class Records — `docs/product.md` § *Class
Record*: *"Both Stream professors teach all three Classes, so a Session expects **six**: 2 × 3"*
— and `class_record`'s `unique (session_id, class_kind, filed_by_person_id)` makes the unit
(Class, filer), not Class. Three pills renders one record per Class. (The same undercount
appears in the *Record a Session* flow, below.)

**CLEAN otherwise:** flagged Sessions show a compact Rating chip of the lowest Aspect
(*"Fasilitas 4"*, *"Fasilitas 2"*) and clean ones read *"Tanpa concern"*.

## 22. **School directory** — *"All 42 Schools — searchable, filterable by Cluster"* (line 540)

**CLEAN in shape** — School / Cluster / Kabupaten / Sesi columns, *"Menampilkan 7 dari 42
Sekolah"* — carrying the STALE Cluster and School content. Note this screen is not in the
README's screen list.

## 23. **Class Record** — *"Filed by a Teaching Team member — one per Class, seven 1–10 Ratings"* (line 569)

**CLEAN, and the most faithful screen in the bundle.** Seven Aspects on a 1–10 row, plus
*"Materi yang dibahas · Covered"*, *"Kendala · Problems"*, *"Saran · Suggestions"* — matching
`CLASS_RECORD_ASPECTS` in `packages/domain/src/index.ts` and the `class_record` table
column-for-column. The elaboration rule is rendered as the database holds it: *"Nilai 7 ke bawah
menjadi Concern dan **wajib disertai penjelasan**"*, and inline *"Rating {n} — wajib dijelaskan
pada Kendala."* — `docs/data-model.md` § *Class Records*, `check (least(…) > 7 or
btrim(coalesce(problems,'')) <> '')`. The banner *"Rekan Research mengisi Class Record-nya
sendiri untuk Kelas yang sama; dua catatan yang berbeda bukan duplikasi"* is `docs/product.md`
§ *Class Record*'s *"Two Class Records on the same Class from different professors is not
duplication."*

*Minor internal inconsistency:* the header reads *"Menyimpan otomatis · terakhir 10:42"*
(autosave) while the *Unsaved changes* block (line 1019) warns *"Catatan Sesi ini punya
perubahan yang belum disimpan"*. The two behaviours are mutually exclusive; no document takes a
position on either.

## 24. **Session Record — PIC** — *"The PIC's account of the visit — five Aspects, no teaching. Saved view."* (line 609)

**CLEAN.** Five read-only Rating meters, *"Kendala"* prose, *"Diisi PIC tentang kunjungannya —
bukan pengajaran. **Tanpa kolom Materi.**"* — `docs/product.md` § *Session Record*: *"No Covered
field — they taught nothing."* The *"Catatan yang belum masuk"* panel states the arithmetic
exactly: *"Enam Class Record diharapkan (2 profesor × 3 Kelas) ditambah Session Record PIC.
Tanpa tenggat — hanya daftar untuk dikejar di grup"* — `docs/data-model.md` § *Who still owes
what*.

## 25. **Participant feedback** — *"Public — no sign-in, opened from a 24h QR link · 3 Aspects"* (line 632)

**CLEAN.** Class picker (GTK / MS / Siswa), three Aspects, optional comment, self-typed name, and
the QR panel captioned *"Satu tautan per Sesi, dibagikan bersama. **Bersifat indikatif, bukan
sensus.** Kedaluwarsa 24 jam"* — `docs/data-model.md` § *Participant Feedback*: *"One token per
Session, shared"*, *"Participant Feedback is indicative, not a census"*, and ADR-0012. No
elaboration rule is imposed, correctly.

*Minor drift:* the Class picker labels the third option *"Siswa"* where the Program page and the
internal screens use *"Student Class"*; `CLASS_KINDS` is `["GTK", "MS", "Student"]`.

## 26. **Perjadin Evaluation** — *"How the trip went — filed by the Group. Not Staff-only · 4 Aspects"* (line 659)

**CLEAN.** Four Aspects, Kendala / Saran, and the access rule spelled out in the UI:
*"Hanya Group yang berangkat dapat mengisi; tanpa kolom Materi. Membawa data non-keuangan, jadi
terbuka bagi siapa pun yang masuk."* — `docs/data-model.md` § *Perjadin Evaluation → Access*
and `docs/product.md` § *Perjadin evaluation*: *"**It is not Staff-only.**"*

## 27. **Concerns** — *"Every Aspect Rated 7 or below, from all four sources, newest first"* (line 681) and 28. **Concerns — kosong** — *"Empty state — nothing flagged"* (line 711)

**CLEAN.** Source filter tabs, per-row source badge, subject, Aspect + compact Rating chip,
filer, prose, and the Participant caveat *"Tanpa penjelasan — Participant tidak diwajibkan"*.
Standfirst: *"Aspek yang dinilai 7 ke bawah — dari Class Record, Session Record, Participant, dan
Perjadin Evaluation. Sumbernya ditampilkan; **rubriknya tidak pernah bertabrakan**"* — which is
`docs/data-model.md` § *The concerns list in full*: *"the four rubrics never collide."* The empty
state is correct too. (But see §"Resolve a Concern" — the same list acquires a resolution
lifecycle 300 lines later.)

## 29. **Perjadin** — *"Trips — a Group visiting Schools over some days"* (line 731)

**STALE — status badges that no column holds.** Rows carry *"Selesai"*, *"Acquittal tertunda"*
and *"Direncanakan"*. `docs/data-model.md` § *Travel* gives `perjadin` **no status column** at
all; the only stored lifecycle facts are `report_filed_at`, `returned_at` and
`returned_to_treasurer_idr`, and § *Money* is explicit that *"**There is no `perjadin_report`
table.** A Perjadin yields exactly one Report, always, so the acquittal is the state already on
`perjadin`."*

**STALE — *"Estimasi Rp 5.100.000"*** on the *"Direncanakan"* row. An estimate is a
pre-Advance figure; `advance_idr` is `not null` and fixed at planning.

**VOCABULARY DRIFT.** *"Acquittal"* appears as a bare UI noun here and on screens 25 and 27
(*"Lihat acquittal"*, *"Acquittal tertunda"*, *"Ajukan acquittal"*) alongside the sidebar's
*"Perjadin Report"*. `CONTEXT.md` § *Reporting* names one term — **Perjadin Report** — and
defines it as *"The acquittal of one Perjadin"*; "acquittal" is the gloss, not the name.

## 30. **Perjadin — detail** — *"Itinerary, Group, PIC, days"* (line 755)

**CLEAN in structure** — itinerary by day, Group with the PIC marked, summary tiles (Sekolah 3,
Sesi 3, Advance Rp 5.000.000). Carries the *"Selesai"* status badge (STALE, as above) and money
with no role variant (see the cross-cutting finding).

## 31. **Advance** — *"Uang muka — requested before travel, reconciled by the acquittal"* (line 789)

**STALE and UNSOURCED together — the Advance is not requested, and has no categories.**

The screen is titled *"Ajukan Advance"* ("submit/request an Advance"), instructs
*"Perkirakan biaya per kategori"*, itemises four categories — *"Transportasi / Penginapan /
Konsumsi / Bahan"* — totals them as *"Total Advance **diminta**"*, and offers *"Simpan draf"* and
*"Ajukan Advance"*.

- `docs/product.md` § *Perjadin*: *"The **Advance** is fixed during trip planning and transferred
  to the PIC before departure, so a Perjadin is never in an unfunded state."* There is no request,
  no approval and no draft phase.
- `CONTEXT.md` § *Reporting* (Advance): *"its amount fixed during trip planning and transferred
  to the PIC before departure."*
- `docs/data-model.md` § *Travel*: `advance_idr bigint not null` — **one figure, no breakdown**,
  with *"no nullable phase to model."* No table anywhere holds a category or an estimate.

## 32. **Perjadin Report** — *"Acquittal — reconcile spend against evidence"* (line 819)

**CLEAN in its core**: *"Total dialokasikan / Total dibelanjakan / Selisih"* is the derived
reconciliation `docs/data-model.md` § *Money* describes (*"`advance_idr - sum(amount_idr)` … is a
query"*), evidence attaches per line, and the *"Tambah bukti"* upload panel (*"JPG atau PDF, maks
5 MB"*) matches `transaction_evidence`.

**STALE — the table leads with a *Kategori* column.** Its rows are
*"Transportasi / Penginapan / Konsumsi / Bahan"*. This is the single most direct contradiction of
ADR-0007's amendment, which exists to forbid exactly this: *"**The constraint on that export is
that it invents nothing.** It renders only what `transaction` and `transaction_evidence` already
hold, plus the derived remainder. **No category, no cost-centre, no account code, no payee** —
nothing added to make the output look more like official paperwork."* `docs/data-model.md`
§ *Money* repeats it: *"**There is no category column yet, and the export does not get to add
one.**"* `docs/product.md` § *The acquittal*: *"It **invents no fields**."* The columns the
export may render are `spent_on`, `description`, `amount_idr`, the evidence, and the remainder —
and `spent_on` is the one this table omits.

**STALE — the submission gate.** *"Satu baris belum memiliki bukti. **Acquittal dapat diajukan
setelah semua bukti dilengkapi.**"*, with *"Ajukan acquittal"* as the primary action.
`docs/product.md` § *The acquittal*: *"**Nothing is gated.** DITSAMA sets that deadline itself,
and the tool is never stricter than the process it serves — invented friction has the same escape
route as duplicated work."* There is also nobody to submit *to*: filing is `report_filed_at`, a
timestamp, not a submission into a queue.

**MISSING — the returned-to-Treasurer mark.** `perjadin.returned_to_treasurer_idr` /
`returned_at` are paired by a CHECK, and `docs/product.md` § *The acquittal* says *"Whatever is
left is returned to the Treasurer."* The screen shows *"Selisih Rp 60.000"* but has no control
recording that it was returned. ADR-0007's amendment lists *"the returned-to-Treasurer mark"*
among the things the screen ships with.

**MISSING — the export itself.** No screen in the bundle shows or offers the generic export,
which is the one thing ADR-0007 says the acquittal exists to produce: *"a plain itemisation a PIC
can attach."* Verified by grep across the whole file — `Ekspor`, `Unduh`, `Cetak`, `download`
and `Export` all return **0**, as does `data-lucide="file-down"`. (The handoff README
§ *Iconography* offers `file-down → FileDown` as a mapping to make, but the icon appears nowhere
in the prototype — a further instance of the README describing more than its HTML contains.)

---

# Part C — Flows & states (lines 861–1200)

## 33. **Persetujuan** — *"Approver queue — Advance & Acquittal awaiting a decision"* (line 873)

## 34. **Advance — persetujuan** — *"Approve · return for revision · reject, with a note"* (line 891)

## 35. **Acquittal — review** — *"Submitted → under review → returned with comments → approved"* (line 913)

**STALE, as one finding — an approval regime the documents deny at three levels.**

The three screens implement a queue (*"Permintaan yang menunggu keputusan Anda · Menunggu 2"*,
statuses *"Menunggu / Disetujui / Dikembalikan"*), a decision panel (*"Tolak · Kembalikan ·
Setujui"* with *"Catatan untuk PIC"*), and a review thread with a status rail
(*"Diajukan → Sedang ditinjau → Dikembalikan sekali → Disetujui"*, *"Kembalikan lagi · Setujui
acquittal"*, annotated by *"Budi W. · **Approver**"*).

- **No such role.** `docs/product.md` § *The internal tool*: *"Two roles, and no third: **Staff**
  … and **Teaching Team**."* ADR-0004: *"There are two roles, Staff and Teaching Team. The
  Programme's leadership are senior Staff, not a separate role."* `ROLES` in
  `packages/domain/src/index.ts` is `["Staff", "Teaching Team"]`, and `person.role` carries
  `check (role in ('Staff','Teaching Team'))`.
- **No gate.** `docs/product.md` § *The acquittal*: *"**Nothing is gated.**"*
- **No state to store.** No approval status, no reviewer, no review-note table exists anywhere in
  `docs/data-model.md` — so this is UNSOURCED as well as STALE.

**The prototype contradicts itself here.** The Staff dashboard (line 370) renders the correct
rule in copy — *"Tidak ada gerbang — DITSAMA yang menetapkan tenggat, bukan alat ini"* — about
the very same acquittal that these three screens put behind a four-state approval workflow.

## 36. **Perjadin lifecycle** — *"The states a Perjadin moves through"* (line 950)

**STALE and UNSOURCED.** Four states: *"Draf → Direncanakan → Berlangsung → Selesai"*, described
as *"Draf — Sekolah dipilih dari Coverage; **belum ada Advance**"*, *"Direncanakan — Tanggal,
Group, dan Advance ditetapkan **& disetujui**"*, *"Berlangsung — Group di lapangan"*,
*"Selesai — Semua Sesi tercatat; **Acquittal diajukan**"*.

`perjadin` has no status column. The *Draf* state is specifically excluded by
`docs/data-model.md` § *Travel*: *"`advance_idr` is NOT NULL because the Advance is fixed at
planning … **a Perjadin is never in an unfunded state, so there is no nullable phase to
model**."* *Direncanakan* re-imports the approval step, and *Selesai* the submission step.

## 37–38. **Ubah Group** — *"Reassign / PIC"* (lines 970 and 972)

**STALE — per-member editing is the one operation the schema refuses.** The panel lists Group
members each with a remove control (three `x` icons), plus *"Tambah anggota"* (`plus`), *"Batal"*
and *"Simpan"*. `docs/data-model.md` § *The Group*: *"**A Group is replaced wholesale, never
edited. There is no 'remove one member' operation.** Substituting a professor submits an entire
replacement Group, and one transaction deletes every member row and inserts the new set."* That
rule is load-bearing elsewhere — § *Why there is no foreign key to the Group* shows wholesale
replacement is what forces `perjadin_evaluation.filed_by_person_id` to reference `person` alone.

**MISSING — Stream per member**, as on the create form: `check ((role = 'Teaching Team') =
(stream is not null))` and *"at least one Teaching Team member assigned to each Stream"*
(`docs/product.md` § *Perjadin*). The panel shows names and a PIC marker only.

## 39. **Record a Session** — *"End-to-end — from Coverage back to updated Coverage"* (line 988)

**Mostly CLEAN**; the five steps run Coverage → School detail → Class → fill → updated Coverage,
and step 5 states the concerns behaviour correctly (*"Rating 7 ke bawah memunculkan Aspek di
Concerns"*).

**STALE — step 3 undercounts.** *"Langkah 3 Pilih Kelas — **Satu catatan per Kelas** — GTK, MS,
Student."* It is one per Class **per professor**: `docs/product.md` § *Class Record* —
*"**One per Class, per professor.** … a Session expects **six**: 2 × 3"* — and `class_record`'s
`unique (session_id, class_kind, filed_by_person_id)`. Same undercount as School detail's
*"3 Kelas dicatat"*.

## 40. **Resolve a Concern** — *"Open → add a resolution note → mark resolved"* (line 1004)

**STALE and UNSOURCED — concerns have no lifecycle and are not rows.** The screen offers a
*"Resolusi"* textarea, *"Simpan catatan"* and *"Tandai selesai"*, and shows a worked example
badged *"Selesai — … Ditutup oleh Rani N. · 3 hari lalu."*

- ADR-0009, in its opening statement: *"blocking notes are **prose rather than tracked items with
  a resolved state**."*
- ADR-0006 § *Consequences*: *"The prose on a Session Record is for the next Group to read, **not
  a set of tracked items with resolved states, so it carries no status meaning anywhere**."*
- `docs/data-model.md` § *The concerns list in full* shows the list is a **query** — four
  unpivots unioned over the four evaluation tables — not a table. There is no concern row to
  resolve, no resolution column, no closed-by, no closed-at.
- `docs/product.md` § *Concerns list* describes it as *"A plain list of **Aspects Rated 7 or
  below** … newest first, each linking to what it came from."*

## 41. **Unsaved changes** — *"Simpan perubahan?"* (line 1019)

**CLEAN as a state**, though see the autosave inconsistency noted under Class Record.

## 42. **Validation errors** — *"Field-level, on save"* (line 1023)

**STALE — a fossil of two retired designs.** The frame contains two live fields:

1. `<label>Peserta hadir</label>` with `<input value="40">` and the error *"Tidak boleh melebihi
   **peserta terdaftar** (32)."* — an attendance count validated against an enrolment roll.
   `docs/data-model.md` § *Participant Feedback*: *"**No `person_id`, no enrolment, no attendee
   list** — ADR-0009 decided against building one."* `docs/product.md` § *Who still owes what*:
   *"**Participants cannot be listed.** Nobody knows who was in the room, so '4 of ? responded'
   is a count with no denominator."* No form in the system asks for attendance.
2. `<label>Bagaimana berjalannya</label>` over a single-choice control erroring
   *"**Pilih salah satu penilaian** sebelum menyimpan."* — the retired three-value pick. ADR-0006
   § *Amended*: *"The signal was originally a three-value pick — _on track_, _some concerns_,
   _struggling_"*; the handoff's own README § *Concept delta* says *"The old `ontrack / concern /
   struggling` variants are gone."* The Rating input is a row of ten cells; "pick one of the
   assessments" describes neither.

## 43. **Publish a story** — *"Authored internally — draft, attach photos, publish to the public site"* (line 1039)

**Partly CLEAN.** A title input, a body textarea, a *"Draf"* badge and a *"Terbitkan"* action
match `docs/data-model.md` § *Stories*: *"**`published_at` NULL is a draft.** No status enum …
Setting it publishes."* The closing note *"Setelah terbit, cerita muncul di /cerita dan Beranda"*
matches the revalidation route.

**STALE — photographs sourced from a Session Record.** *"Foto — **Dari Sesi** … Foto dapat
diambil dari **Dokumentasi Session Record** atau diunggah baru."* This is the one wall every
publishing document defends:

- `CONTEXT.md` § *Publishing* (Story): *"A Story is authored, never derived: **no Session Record,
  Class Record, Participant Feedback or Perjadin Report is ever a source for one**."*
- `docs/product.md` § *The public site*: *"Class Records, Session Records and Perjadin Reports
  never reach a public page — not filtered, not flagged, not summarised."*
- ADR-0008 § *Second amendment*: *"the wall below stands: a Story is authored for publication, and
  **no internal record is ever a source for one**."*
- There is also nothing to source from: `session_record` holds five smallints plus `problems` and
  `suggestions`. **No documentation or photo attachment exists on any internal record** except
  `transaction_evidence`, which lives in the private `receipts` bucket
  (`docs/data-model.md` § *Object storage*).

**STALE — a Cluster field.** The composer carries an editable *"Cluster"* input (value
*"Priangan Timur"*) beside *"Sekolah"*. `docs/data-model.md` § *Stories*: *"**`school_id` is NOT
NULL, and it is the only thing a Story attaches to.** … the Cluster is `school.cluster_id`
reached through the join … **There is no `cluster_id` and no `perjadin_id`.**"*

*(The composer's own *"Penulis — Rani N."* is correct — Staff. It is the public **Cerita —
detail** page at line 162 that bylines a Teaching Team author; that finding is recorded there.)*

**MISSING — withdrawal.** No unpublish/take-down control anywhere in the bundle.
`docs/product.md` § *Publishing*: *"**A Story is a draft until it is published, and comes down
immediately when withdrawn.** Publishing or unpublishing tells the public site to refresh."*
`docs/data-model.md` § *Stories*: *"clearing it takes the Story down … fine for a figure, not
fine for a photograph that has to come down now."* The prototype has `Terbitkan` twice and no
`Tarik`, `Turunkan` or equivalent.

**MISSING — photo ordering and captions.** `story_photo` carries `position` (the first is the
cover) and `caption`, with `unique (story_id, position)` immediate, which
`docs/data-model.md` § *Stories* says forces the editor to *"submit the whole ordering and
rewrite every row."* The composer shows a flat photo strip with no cover, order or caption
affordance.

**MISSING — a Stories index.** There is a composer but no list of Stories, no draft/published
inventory, and no nav entry for publishing in any sidebar in the file.

## 44. **Cluster setup** — *"Allocate Schools, set the Topic & Problem"* (line 1065)

**STALE — an admin screen the documents rule out by name.** Fields: *"Nama Cluster"*, *"Topik"*,
*"Problem"*, and a School multi-select (*"2 dari 4 Sekolah dipilih"*, *"Simpan Cluster"*).

`docs/product.md` § *What it deliberately does not do*: *"**No admin screens for Schools,
Clusters or Topics.** They are fixed reference data, seeded by migration."*
`docs/data-model.md` § *Reference data*: *"Seeded by migration. **No admin screens** —
`product.md` is explicit that Schools, Clusters and Topics are fixed facts, not records with an
editing lifecycle."* ADR-0013 relies on that same rule to explain why People are the exception:
*"Schools, Clusters and Topics have no admin screens because they are fixed reference data …
**People are not reference data.**"* The prototype builds the screen the documents exclude and
omits the one they require.

## 45. **Roles & permissions** — *"Who can do what"* (line 1091)

**STALE — asserts the three-role model as policy.** A four-column matrix, *"Kemampuan | Teaching
| Staff | **Approver**"*:

| Kemampuan | Teaching | Staff | Approver |
| --- | --- | --- | --- |
| Catat Sesi | ✓ | ✓ | — |
| Rencanakan Perjadin | — | ✓ | — |
| Terbitkan Cerita | — | ✓ | — |
| Setujui Advance / Acquittal | — | — | ✓ |

Two problems beyond the third column existing at all. **Staff explicitly cannot approve** — the
last row gives Staff a dash — so this is not "leadership are senior Staff" rendered loosely; it
is a distinct role with an exclusive capability. ADR-0004 forecloses it: *"There are two roles,
Staff and Teaching Team. The Programme's leadership are senior Staff, not a separate role."*
ADR-0013 § *Consequences* adds that `active = false` cannot become a third state either:
*"that would be a third role, and `product.md` says there are two."*

**MISSING — the matrix has no row for adding or revoking People**, which is the one Staff-only
write ADR-0013 adds. It corroborates the absence documented below.

## 46. **Sign-in edge cases** (line 1101)

**STALE — both cases are the wrong mechanism.**

- *"**Domain tidak diizinkan** — Akun nama@gmail.com di luar @ditsama.itb.ac.id. Gunakan akun
  DITSAMA Anda."* As under **Masuk**: the gate is the `person` invite list, not an email domain,
  and ADR-0003 chose Google precisely because *"the Teaching Team is not guaranteed to be
  entirely ITB account holders."* A `gmail.com` professor is a legitimate invitee, not an error
  case.
- *"**Belum punya peran** — Akun Anda dikenali, tetapi belum diberi peran. Hubungi admin Program
  untuk akses."* Unreachable. `person.role` is `not null` and set when the Person is invited, and
  ADR-0013 makes it write-once. There is no recognised-but-unroled account: `docs/data-model.md`
  § *Identity* — *"an uninvited Google account **cannot create a user row at all**."*

**MISSING — the revoked-Person case.** ADR-0013 § *Revocation needs a second mechanism* is the
state that does exist and has no screen: a Person who has signed in before, then had
`active = false` written and a Better Auth `/admin/ban-user` applied, which *"blocks sign-in and
revokes existing sessions in one call."* The bundle has no banned/revoked sign-in state.

**VOCABULARY DRIFT — "admin".** *"Hubungi **admin** Program"*. `CONTEXT.md` § *People and travel*
(Staff) lists *avoid: leadership, **admin**, organiser*.

## 47. Empty, loading & error states (line 1101 band)

**CLEAN:** *"Belum ada Sesi tercatat"* (Coverage first run), *"Belum ada Perjadin"*,
*"Memuat…"*, *"Gagal memuat data"*.

**STALE — the offline card.** *"**Anda sedang luring** — Catatan Sesi disimpan di perangkat dan
akan **tersinkron otomatis** saat koneksi kembali. 2 menunggu sinkron."* `docs/product.md`
§ *The acquittal*: *"**There is no offline support**; capture needs connectivity, and where it
fails the PIC enters it later, losing convenience but never data. Offline is worth adding
eventually, not worth blocking on."* ADR-0007: *"**Offline support is deliberately deferred.**"*
A device-side queue with automatic sync is the deferred feature, shown as built.

## 48. **Notifikasi** (line 1120)

**STALE.** Three items: *"**Concern baru** di SMA Negeri 2 Tasikmalaya"*, *"**Advance
dikembalikan** untuk revisi"*, *"**Acquittal Priangan Timur disetujui**"*.
`docs/product.md` § *What it deliberately does not do*: *"**No scheduling, no overdue, no
alerts.**"* Two of the three items are also events from the approval regime that does not exist.

## 49. **Internal search** — *"Across Schools, Perjadin & records"* (line 1129)

**UNSOURCED (flavour 2) / undocumented.** Results across Schools and Perjadins. The data is
present internally and `@sugt/db` could serve it, so nothing contradicts a document — but no
document describes this surface, and searching *"records"* would cross the money boundary
(a Perjadin result carries its trip) without any stated Staff-only handling. Recorded here so it
is not mistaken for a documented requirement.

---

# Cross-cutting findings

These are not attached to one screen.

## M1. There is no People screen anywhere in the bundle

**MISSING — the largest single gap.** ADR-0013 and `docs/product.md` § *People — the invite list*
require a Staff-only screen where People are added and revoked. Grepping the whole 272KB
prototype:

| Term | Occurrences |
| --- | --- |
| `Undang` / `undang` / `invite` | 0 |
| `roster` | 0 |
| `Nonaktif` / `nonaktif` / `Cabut` | 0 |
| `Peran` (capitalised, as a field) | 0 |
| `People` / `Orang` / `Daftar Orang` | 0 |

And no nav entry in any sidebar. Counting nav items across all twelve internal frames gives the
complete set: **Coverage** (12), **Perjadin** (12), **Concerns** (12), **Perjadin Report** (11,
Staff frames only), **Beranda** (2, the dashboards). There is no People entry — and none for
publishing or for the approval queue either. With no such screen, four documented behaviours have
no design:

1. **Adding a Person** — `full_name`, `email`, `role`, with `role` chosen at invite time.
2. **Role is write-once, stated rather than offered.** `docs/product.md` § *People*: *"**A
   Person's role cannot be changed once they have been used.** The database refuses it, and
   correcting a wrong one means revoking that Person and adding a new one … **The screen says so
   rather than offering an edit that will be rejected.**"* ADR-0013 § *Why role is write-once*
   traces it to six composite foreign keys defaulting to `NO ACTION`.
3. **Revocation as two writes.** `docs/product.md` § *People*: *"**Revoking is two things, not
   one.** `active = false` gates _signup_ … So revoking also bans them through Better Auth, which
   blocks sign-in and ends existing sessions. `active` is the fact; the ban is how it is
   enforced."* `docs/data-model.md` § *Identity* and ADR-0013 § *Revocation needs a second
   mechanism* say the same. Nothing in the design expresses either half.
4. **Re-inviting**, which ADR-0013 says *"reverses both"* — and the revoked row that remains,
   which is why `person_email_key` becomes partial.

## M2. Money has no Teaching-Team-safe variant

**MISSING.** ADR-0004: *"Perjadin Reports and their financial detail are visible to **Staff
only**."* But:

- The **Teaching Team dashboard** sidebar (line 338) carries **Perjadin** — correctly, since
  ADR-0004 opens delivery data and a Perjadin Evaluation is explicitly *not* Staff-only
  (`docs/product.md` § *Perjadin evaluation*), so a professor must be able to reach their trip.
- The **Perjadin list** (line 731) renders `Rp 4.940.000`, `Rp 3.820.000`, `Rp 5.100.000`.
- The **Perjadin detail** (line 755) renders *"Advance Rp 5.000.000"*.
- Neither screen has a Staff-only marker (unlike the Staff dashboard's Advance strip, which does
  carry *"Hanya Staff"*), and no money-free variant of either exists.

`docs/data-model.md` § *What the database does not hold* notes this is application code, not RLS
— *"Every money-reading query therefore takes the authenticated Person and refuses a non-Staff
caller, at a single choke point in `@sugt/db`"* — which makes the screen variant the only place
the rule becomes visible. The design does not show it.

## M3. The launch gate ADR-0008 names is largely undesigned

ADR-0008 § *Second amendment* states the first release's gate: *"Launch is now gated on Better
Auth working, the invite list existing (ADR-0013), the `public-media` bucket, publishing tables
and a Staff-only editor."* Of those, the bundle contains one Story composer card (line 1039,
itself STALE on photo sourcing and the Cluster field) and no invite list, no Stories index, no
withdrawal path, no photo ordering. `docs/product.md` § *Publishing* adds *"the public site
therefore launches with real Stories in the database"* — a state the public Cerita screens
already assume, so those are fine; it is the authoring side that is thin.

## M4. Vocabulary drift, collected

| Prototype copy | Where | `CONTEXT.md` term |
| --- | --- | --- |
| *"Approver"*, *"Persetujuan"*, *"Setujui"* | lines 873–913, 1091 | No such role or act. Two roles only (§ *People and travel*; ADR-0004) |
| *"Acquittal"* as a bare noun | lines 731, 755, 819 | **Perjadin Report** (§ *Reporting*) |
| *"Ajukan Advance"*, *"Total Advance diminta"*, *"Estimasi"* | lines 789, 731 | An Advance is *fixed*, not requested (§ *Reporting*) |
| *"Kategori"* on transactions | line 819 | No such concept; ADR-0007 amendment forbids it |
| *"Domain tidak diizinkan"* | lines 309, 1101 | *"'domain' only ever means the web address"* (§ *Flagged ambiguities*) |
| *"admin Program"* | line 1101 | **Staff** — *avoid: leadership, admin, organiser* (§ *People and travel*) |
| *"Belum dijadwalkan"*, *"dari 10 direncanakan"* | lines 497, 1161 | Sessions are arranged, never scheduled ahead (ADR-0006) |
| *"Draf / Direncanakan / Berlangsung / Selesai"* | lines 950, 731 | No Perjadin lifecycle exists |
| *"Bagaimana berjalannya"* + single pick | line 1023 | Retired; **Rating** 1–10 against an **Aspect** (§ *Reporting*) |
| *"Peserta hadir / peserta terdaftar"* | line 1023 | No enrolment; a **Participant** is never named except by themselves (§ *Reporting*) |
| *"Dokumentasi Session Record"* | line 1039 | No such thing; a Story is never derived (§ *Publishing*) |
| *"Energi Terbarukan"* as a Topic | lines 178, 243, 1190 | Not one of the four (§ *Open questions*) |
| *"Priangan Timur / Pantura / Priangan Barat / Ciayumajakuning"* | throughout | Seeded Clusters are **Klaster 1–4** |
| *"Siswa"* as a Class | line 632 | **Student Class** (`CLASS_KINDS` = GTK, MS, Student) |
| *"Tim Pengajar STEM"* as a Story byline | line 162 | Publishing is Staff-only (§ *Publishing*; ADR-0004) |
| *"sembilan provinsi"* / *"9 Provinsi"* | lines 215, 290 | 15 provinces (`docs/product.md` § *The public site*) |

---

# Inventory summary

Complete list, canvas order. A screen appears in exactly one row but may carry several tags.

| # | Screen label (verbatim) | Line | Verdict |
| --- | --- | --- | --- |
| 1 | **Beranda** | 84 | Clean core; MISSING absent-delivery-band and failed-fetch states |
| 2 | **Program** | 113 | Clean; UNSOURCED Final Project step |
| 3 | **Cerita** | 147 | Clean |
| 4 | **Cerita — detail** | 162 | STALE (Teaching Team byline; publishing is Staff-only) |
| 5 | **Cluster** | 178 | STALE ×2 (unallocated state; Cluster identities/sizes/Topic) |
| 6 | **Cluster — detail** | 196 | Clean shape; stale content |
| 7 | **Tentang** | 215 | STALE (nine vs fifteen provinces) |
| 8 | **Final Project** | 243 | UNSOURCED (no data) + STALE (wrong unit) |
| 9 | **Pencarian** | 261 | UNSOURCED (no route; body-level search undocumented) |
| 10 | **404** | 283 | Clean |
| 11 | **Beranda — mobile** | 290 | STALE (9 Provinsi) |
| 12 | **Masuk** | 309 | STALE (domain allowlist, not the invite list); DRIFT |
| 13 | **Dashboard — Teaching Team** | 338 | Clean |
| 14 | **Dashboard — Staff** | 370 | Clean |
| 15 | **Coverage** | 409 | Clean behaviour; stale content |
| 16 | **Rencanakan Perjadin** | 446 | Clean flow; MISSING Advance + Stream fields; DRIFT |
| 17 | **School detail** | 497 | STALE ×2 (ten rows pre-laid; 3 not 6 records); MISSING cancelled Session |
| 18 | **School directory** | 540 | Clean shape; stale content |
| 19 | **Class Record** | 569 | Clean |
| 20 | **Session Record — PIC** | 609 | Clean |
| 21 | **Participant feedback** | 632 | Clean; minor drift |
| 22 | **Perjadin Evaluation** | 659 | Clean |
| 23 | **Concerns** | 681 | Clean |
| 24 | **Concerns — kosong** | 711 | Clean |
| 25 | **Perjadin** | 731 | STALE (status badges, estimate); DRIFT |
| 26 | **Perjadin — detail** | 755 | Clean structure; stale badge; money-variant gap |
| 27 | **Advance** | 789 | STALE + UNSOURCED (request/approval/draft; categories) |
| 28 | **Perjadin Report** | 819 | Clean core; STALE ×2 (Kategori column; submission gate); MISSING return mark + export |
| 29 | **Persetujuan** | 873 | STALE + UNSOURCED |
| 30 | **Advance — persetujuan** | 891 | STALE + UNSOURCED |
| 31 | **Acquittal — review** | 913 | STALE + UNSOURCED |
| 32 | **Perjadin lifecycle** | 950 | STALE + UNSOURCED |
| 33 | **Ubah Group** | 970 | STALE (per-member edit); MISSING Stream |
| 34 | **Record a Session** | 988 | Clean; STALE step 3 |
| 35 | **Resolve a Concern** | 1004 | STALE + UNSOURCED |
| 36 | **Unsaved changes** | 1019 | Clean |
| 37 | **Validation errors** | 1023 | STALE ×2 (attendee list; three-value pick) |
| 38 | **Publish a story** | 1039 | STALE ×3; MISSING withdrawal, ordering, index |
| 39 | **Cluster setup** | 1065 | STALE (admin screen ruled out by name) |
| 40 | **Roles & permissions** | 1091 | STALE (three roles); MISSING People row |
| 41 | **Sign-in edge cases** | 1101 | STALE ×2; MISSING revoked-Person case |
| 42 | Empty / loading / error states | 1101 | Clean; STALE offline card |
| 43 | **Notifikasi** | 1120 | STALE |
| 44 | **Internal search** | 1129 | UNSOURCED (undocumented surface) |
| 45 | **Final Project — detail** | 1144 | UNSOURCED + STALE (wrong unit) |
| 46 | **School — public page** | 1161 | Clean; minor drift |
| 47 | **Cerita — mobile** | 1176 | Clean |
| 48 | **Cluster — mobile** | 1190 | STALE content |

**Counts**, on 48 blocks:

- **11 carry no finding at all:** Cerita (147), 404 (283), both dashboards (338, 370), Class
  Record (569), Session Record (609), Perjadin Evaluation (659), Concerns (681), Concerns —
  kosong (711), Unsaved changes (1019), Cerita — mobile (1176).
- **2 more carry only minor vocabulary drift:** Participant feedback (632), School — public page
  (1161).
- **4 more are structurally sound but render the invented Clusters, Topics and Schools:** Cluster
  — detail (196), Coverage (409), School directory (540), Perjadin — detail (755). That stale
  reference content also runs through Cluster (178), Final Project (243), Rencanakan Perjadin
  (446), School detail (497), Perjadin (731) and Cluster — mobile (1190).
- **21 blocks carry a structural STALE finding** — something the documents now deny, as opposed
  to stale sample data.
- **11 blocks are UNSOURCED**, split three ways: no data exists (243, 1144, and the Final Project
  strip inside 113); no documented route delivers it (261, 1129); the displayed state is stored
  nowhere (789 categories, 873, 891, 913, 950, 1004).
- **11 distinct MISSING surfaces or states**, listed above.
- **16 vocabulary items drifted**, tabulated in M4.

**Surfaces the documents require that have no screen at all:** the People / invite list
(ADR-0013), a Stories index and withdrawal path (ADR-0008 second amendment), the launch-day
Beranda without a delivery band (`docs/product.md` § *The public site*), the cancelled Session
(`docs/product.md` § *Sessions*), the returned-to-Treasurer mark and the generic export
(ADR-0007 amendment), the revoked-Person sign-in case (ADR-0013), and money-free Perjadin views
for Teaching Team (ADR-0004).

---

## Aside: one docs-internal inconsistency noticed in passing

Not a design defect and not in any bucket. `docs/data-model.md` § *Still open* reads *"What else
the Participant form asks for. Right now: Class, **five** Ratings, comment, name."* The
`participant_feedback` table and `PARTICIPANT_FEEDBACK_ASPECTS` both carry **three** —
Materials, Instructor, Relevance — as does every other passage in the same document. The
prototype's Participant screen renders three, correctly.
