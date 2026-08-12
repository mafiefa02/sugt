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
closing _Flows & states_ band (lines 861–1200), plus **three phone frames** whose labels sit
outside both runs. Every screen below is named by its own label, verbatim, with the HTML line
number so a claim can be checked in the file.

**The four buckets are not mutually exclusive, and entries are tagged multiply.** The Final
Project showcase is UNSOURCED _and_ renders the wrong unit; **Advance** (line 789) is STALE
_and_ UNSOURCED. Forcing one label per screen would lose half the finding.

- **STALE** — the design shows something the documents have since changed or now deny.
- **MISSING** — the documents require a surface the design has no screen for.
- **UNSOURCED** — no data stands behind the screen. Two distinct flavours, kept apart below.
- **VOCABULARY DRIFT** — Indonesian copy naming a concept `CONTEXT.md` calls something else.
- **CLEAN** — consistent with the documents as they now stand.

### The handoff README is not a reliable index of its own HTML

`README.md` § _Screens / Views_ enumerates the screens under two headings and closes the internal
list with a single line: _"Flows & states — record-a-Session loop, resolve-a-concern,
publish-a-story, advance approval, offline/loading/error/empty/notification states."_ That line
omits five substantial blocks that exist in the HTML: **Persetujuan** (an approver queue),
**Cluster setup** (an admin screen), **Roles & permissions** (a three-role matrix),
**Internal search**, and **Perjadin lifecycle** (a four-state machine). The largest
document-conflicts in the bundle are in exactly the part the README summarises in half a
sentence. Anyone reconciling from the README alone will not see them.

The README is also the source of two claims the HTML does not support — it states
_"Scope figures: 42 Schools · 15 provinces"_ while two prototype screens render nine, and it
describes the acquittal export as _"evidence-gated"_, which `product.md` § _The acquittal_ does
not.

### Two flavours of UNSOURCED

The task named the Final Project showcase as the known case. The prototype has more than one, and
they are not the same problem:

1. **No data exists anywhere.** Final Project (screens at lines 243 and 1144).
   `docs/data-model.md` § _The glossary is not the schema_ lists "Project Team, Final Project —
   **Not stored at all**". ADR-0009 is the decision.
2. **Data exists; no documented route delivers it.** Pencarian (line 261) and Internal search
   (line 1129). `docs/data-model.md` § _Where the code lives_ is categorical that
   _"`@sugt/public` holds no Supabase client and no database credentials of any kind"_, and
   `docs/data-model.md` § _Still open_ names exactly three routes — _"scope, delivery,
   published Stories"_ — matching ADR-0008 § _The endpoint contract_'s _"Three routes, by
   lifetime."_ None is a search route. This is weaker than case 1 and is flagged as such
   throughout.

---

# Part A — Public site (`@sugt/public`)

## 1. **Beranda** — _"Homepage — leads with scope, not delivery"_ (line 84)

**Mostly CLEAN.** The scope band renders _"42 Sekolah peserta / tersebar di 15 provinsi"_,
_"2 Stream"_, _"3 Kelas / sekolah"_, _"10 Sesi / sekolah — 4 luring · 6 daring"_ — which is
precisely `docs/product.md` § _The public site_: _"Four stats lead the page, and only the first
is fetched: 42 Schools across 15 provinces."_ The Cerita band's caption _"Ditulis dan dipilih
oleh tim, bukan dipanen dari catatan"_ is a faithful rendering of the same section's _"Narrative
is authored for publication, never harvested."_

**MISSING — the absent delivery band.** The screen shows the delivery band populated
(_"128 Sesi terlaksana / 19 Sekolah terjangkau"_) and no other variant exists in the file.
`docs/product.md` § _The public site_ requires the other one: _"The delivery band is absent
until there is delivery to report. It renders only once at least one Session has been delivered,
so launch day is scope → Streams → Clusters with no gap."_ Launch day is the state with no
design.

**MISSING — last-good-payload behaviour.** Same section: _"A failed fetch never degrades to
zeros… at runtime the last good payload is served indefinitely."_ No public screen expresses a
stale-payload or failed-fetch condition; the only error state in the bundle
(_"Gagal memuat data"_, line 1101 band) is an internal-tool frame.

## 2. **Program** — _"How the Track is delivered — Streams, Classes, the 10-Session rhythm"_ (line 113)

**Mostly CLEAN.** The three Classes, the 4-offline/6-online rhythm and _"tiap profesor menulis
Class Record per Kelas, dan PIC melengkapinya dengan satu Session Record kunjungan"_ all match
`docs/product.md` § _Class Record_ and § _Session Record_.

**UNSOURCED (flavour 1) — the closing step strip.** _"Dari Sesi ke Final Project — 01 Sesi ·
02 Problem Cluster · **03 Final Project — Karya penutup hasil kedua Stream**"_. See §"Final
Project" below; the same wrong unit and the same absent data.

## 3. **Cerita** — _"Stories list — authored, filterable"_ (line 147) and 4. **Cerita — detail** — _"Single story, authored for publication"_ (line 162)

**CLEAN.** A Story list with a Semua/STEM/Research filter and a detail page carrying title, body,
Stream badge, School, Cluster and photographs is exactly the `story` / `story_photo` contract in
`docs/data-model.md` § _Stories_. The list's standfirst — _"Catatan dan foto yang ditulis serta
dipilih oleh tim pengajar dan Staff — **bukan dipanen dari Session Record**"_ — states ADR-0001's
wall in the UI copy.

**STALE — the byline names a Teaching Team author.** The detail page reads _"Ditulis oleh **Tim
Pengajar STEM**"_, and the list standfirst credits _"ditulis serta dipilih oleh **tim pengajar
dan Staff**"_. `docs/data-model.md` § _Stories_ pins `written_by_role` to `'Staff'` and makes the
pair a composite foreign key into `person (id, role)` — _"**Publishing is Staff-only, and that is
a composite foreign key like every other role rule here.** … without this it would be the one
such rule held by convention"_ — so a Teaching Team byline is a row the database refuses.
ADR-0004 § _Publishing_: _"Teaching Team members write internal records and nothing public."_
(The Publish a story composer at line 1039 gets this right, naming a Staff author.)

## 5. **Cluster** — _"Listing — scope reference data"_ (line 178)

**STALE — the unallocated-Cluster state cannot exist.** Two of the four cards read
_"**Belum dialokasikan** — Topik dan Problem ditetapkan setelah alokasi Cluster selesai."_
`CONTEXT.md` § _Delivery_ (Cluster): _"There are four, and they are **allocated and fixed**."_
`docs/data-model.md` § _Reference data_ makes `cluster.topic` and `cluster.problem` `not null`,
and `school.cluster_id` `not null` with the note _"'a School with no Cluster' is not a state the
coverage view … ever has to render."_

**STALE — Cluster identities and sizes.** The prototype's Clusters are _"Priangan Timur"_,
_"Pantura"_, _"Priangan Barat"_, _"Ciayumajakuning"_, with Topics _"Ketahanan Pangan"_ and
_"Energi Terbarukan"_, sized _"4 Sekolah"_ and _"3 Sekolah"_. The seeded reality in
`packages/db/seed/reference-data.sql` is **Klaster 1–4** on slugs `mitigasi-bencana`,
`smart-city`, `ketahanan-pangan`, `waste-management` — the four Topics `CONTEXT.md` § _Open
questions_ confirms as _"set (Mitigasi Bencana, Smart City, Ketahanan Pangan, Waste
Management)"_. **"Energi Terbarukan" is not one of them.** Sizes are lopsided —
`docs/data-model.md` § _Reference data_: _"Cluster sizes are lopsided — six, seventeen, eleven,
eight — which is worth knowing before anyone builds a screen assuming they are comparable"_ —
against the prototype's 4 and 3. Every School named across the whole prototype is West Javanese
(Bandung, Garut, Tasikmalaya, Ciamis, Cirebon, Indramayu, Subang); the seed spans Banda Aceh to
Jakarta and beyond. The one real School name in the file is _"SMAN 8 Jakarta"_ on the Teaching
Team dashboard.

## 6. **Cluster — detail** — _"Topik, Problem, Sekolah & delivery as it accrues"_ (line 196)

**CLEAN in shape**, carrying the same STALE Cluster identity as above. The School table's
_"Sesi terlaksana — 6 / 10 · 3 / 10 · 1 / 10 · **Belum**"_ is `count(delivered)` against
`TOTAL_SESSIONS_PER_SCHOOL`, and rendering nothing-yet as _"Belum"_ rather than a zero is
consistent with ADR-0001's objection to publishing zeros.

## 7. **Tentang** — _"About — Programme & organisers"_ (line 215)

**STALE — the province figure.** The prose reads _"membawa pengajaran langsung ke 42 sekolah
unggul di **sembilan provinsi**"_ while the stat band directly beneath it reads _"15 Provinsi"_.
The documents say fifteen (`docs/product.md` § _The public site_), and `docs/data-model.md`
§ _Reference data_ explains why the number is defended by a table: _"provinces covered is a
headline figure on the portfolio site, and a typo in a free-text column silently inflates the
number nobody would think to check."_ The prototype contains that inflation in the other
direction, twice — here and on the phone frame.

## 8. **Final Project** — _"Public showcase — what each Cluster produced"_ (line 243)

**UNSOURCED (flavour 1) — the known case, confirmed.** `docs/product.md` § _What it deliberately
does not do_: _"**No Project Teams and no Final Projects.** Several hundred exist across the
Programme; none are tracked. They reach the public as curated showcase pieces, never as
records."_ `docs/data-model.md` § _The glossary is not the schema_: _"Project Team, Final
Project — Not stored at all."_ ADR-0009 is the decision and names them _"the sharpest case."_

**STALE — the unit is wrong, independently of the data.** The screen models a Final Project as
**one per Cluster**: _"Karya penutup tiap Cluster — hasil kerja kedua Stream atas satu Problem
bersama"_, one card per Cluster, and placeholder cards reading _"Cluster Priangan Barat — Final
Project ditampilkan setelah Program berjalan"_. `CONTEXT.md` § _Relationships_: _"The **Student
Class** divides into ten to thirty **Project Teams**; each produces exactly one **Final
Project**"_ and _"A **School** therefore ends the Programme with many **Final Projects**, not
one."_ A Final Project belongs to a Project Team inside one School — not to a Cluster.

## 9. **Pencarian** — _"Search — across Sekolah, Cluster & Cerita"_ (line 261)

**UNSOURCED (flavour 2) — no route delivers it.** Name-matching over Schools, Clusters and
Stories could in principle run against payloads the public app already caches, so the _data_ is
not absent the way a Final Project's is. What is absent is a route: `docs/data-model.md`
§ _Still open_ documents _"Three routes on `@sugt/internal` — scope, delivery, published
Stories"_, and ADR-0008 § _The endpoint contract_ fixes that at _"Three routes, by lifetime."_

One result row goes further than any cached payload can serve:
_"Merancang sensor kualitas air dari barang bekas — **Cerita · menyebut Garut**"_ is a full-text
match inside a Story body. Nothing documented provides body-level search, and
`docs/data-model.md` § _Where the code lives_ forecloses the public app querying for it:
_"`@sugt/public` holds no Supabase client and no database credentials of any kind."_

## 10. **404** — _"Not found"_ (line 283)

**CLEAN.**

## 11–13. Mobile frames: **Beranda — mobile** (line 290), **Cerita — mobile** (line 1176), **Cluster — mobile** (line 1190)

All three the README promises do exist, though two are buried in the closing band rather than
beside their desktop screens.

- **Beranda — mobile: STALE.** The scope grid reads _"42 Sekolah / **9 Provinsi** / 2 Stream /
  10 Sesi per sekolah"_ — the second wrong province figure (see Tentang).
- **Cerita — mobile: CLEAN.** Semua/STEM/Research filter, two Story cards.
- **Cluster — mobile: STALE**, carrying the invented Cluster names and the non-existent Topic
  _"Energi Terbarukan"_.

## 14. **School — public page** — _"Cluster → School → its stories"_ (line 1161)

**CLEAN.** Breadcrumb Cluster → School, the School's Kabupaten/Kota and Topic, three figures
(_"6 Sesi terlaksana dari 10 direncanakan"_, _"3 Kelas"_, _"2 Cerita terbit"_) and the School's
published Stories. `docs/data-model.md` § _Stories_ makes `story.school_id` `not null` and the
only thing a Story attaches to, which is exactly what this page reads.

_Minor drift:_ _"dari 10 **direncanakan**"_ ("of 10 planned"). ADR-0006 is that no Session is
planned in advance; ten is a fixed denominator, not a schedule.

## 15. **Final Project — detail** — _"One Cluster's closing work, both Streams"_ (line 1144)

**UNSOURCED (flavour 1)** and carrying the same wrong unit as the showcase, more explicitly:
_"Karya penutup empat Sekolah dalam Cluster"_, with _"Kontribusi STEM"_ / _"Kontribusi
Research"_ panels and a _"Sekolah yang terlibat"_ badge row. `CONTEXT.md` § _Relationships_
attaches a Final Project to a Project Team within one Student Class, and both Streams work the
Cluster's **Problem**, not a shared artefact.

---

# Part B — Internal tool (`@sugt/internal`)

## 16. **Masuk** — _"Sign-in — Google, restricted to DITSAMA staff"_ (line 309)

**STALE — an email-domain allowlist stands where the invite list belongs.** The screen reads
_"Hanya untuk domain **@ditsama.itb.ac.id**. Akun di luar itu akan ditolak."_ That is not the
mechanism, and it excludes the people the mechanism was chosen for. ADR-0003 § _Why_: _"Google
sign-in wins on two counts: **the Teaching Team is not guaranteed to be entirely ITB account
holders**, and an SSO integration would land on a university IT department's schedule rather
than ours."_ A `@ditsama.itb.ac.id` gate rejects exactly the external professors that reasoning
protects.

What the documents specify instead: `docs/data-model.md` § _Identity_ — _"`person` **is** the
invite list from ADR-0003. There is no separate invite table"_, enforced by a
_"`databaseHooks.user.create.before` hook [that] looks up `person` by lowercased email. No match
means it throws, so **an uninvited Google account cannot create a user row at all**."_
`docs/product.md` § _People — the invite list_: _"nobody whose email has no row can sign in at
all."_

**VOCABULARY DRIFT.** _"domain"_ is a term `CONTEXT.md` § _Flagged ambiguities_ resolves:
_"'domain' only ever means the web address."_

## 17. **Dashboard — Teaching Team** — _"A professor's landing: Class Records owed, upcoming Sessions, no money"_ (line 338)

**CLEAN.** Three count tiles (_"4 Class Record belum diisi"_, _"2 Sesi Anda mendatang"_,
_"1 Perjadin Group aktif"_), a _"Perlu Anda isi"_ list captioned _"Tanpa tenggat — daftar untuk
dikejar"_ — which is `docs/product.md` § _Who still owes what_: _"Nothing is required and nothing
is blocked… What the tool does is name who has not filed, so they can be chased in the group
chat."_ The note _"Stream mengikuti pengisi — tidak ada kolomnya"_ states `docs/data-model.md`
§ _Class Records_' _"**Stream needs no column.**"_ The sidebar (Beranda / Coverage / Perjadin /
Concerns) correctly omits Perjadin Report per ADR-0004.

_See the cross-cutting money-visibility finding below:_ this sidebar carries **Perjadin**, and
the Perjadin screens it leads to render money.

## 18. **Dashboard — Staff** — _"Programme overview + this person's PIC work (money is Staff-only)"_ (line 370)

**CLEAN, and one of the better-sourced screens.** Six count tiles, per-Cluster coverage bars
captioned _"4 Cluster · ukuran berbeda"_ (the lopsided sizes `docs/data-model.md` § _Reference
data_ warns about), an Advance strip marked _"Hanya Staff"_, and a PIC work card with
_"Jatuh tempo — 2 hari lagi"_, _"8 Transaksi tercatat"_, _"2 / 4 Bukti anggota masuk"_,
_"Rp 1,9jt Sisa untuk dikembalikan"_. Each maps to a documented derivation: the deadline to
`ends_on + REPORT_DEADLINE_DAYS_AFTER_RETURN` (`docs/data-model.md` § _Travel_: _"There is no
`report_deadline` column"_), the checklist to `group_member.receipts_settled_at`, the remainder
to _"`advance_idr - sum(amount_idr)` … derived, never stored"_ (§ _Money_).

The card's footnote is a verbatim rendering of the rule the rest of the bundle breaks:
_"**Tidak ada gerbang** — DITSAMA yang menetapkan tenggat, bukan alat ini."_ (`docs/product.md`
§ _The acquittal_: _"**Nothing is gated.**"_) See §"Persetujuan" below — the same acquittal
appears elsewhere in this file behind a four-state approval queue.

## 19. **Coverage** — _"Landing — every School by Sessions delivered, per Cluster"_ (line 409)

**CLEAN in behaviour, STALE in content.** Counts only, no colour, no flag — exactly
`docs/product.md` § _Coverage view_: _"It shows counts, and nothing else. No health indicator, no
flagging, no colour"_, and ADR-0006's _"no flagging, no colour, no health indicator."_ The
`0 / 10` row renders as a plain count. The Cluster names and School set are the invented West
Java ones (see §"Cluster").

## 20. **Rencanakan Perjadin** — _"Live — pilih beberapa Sekolah, aksi muncul, buka formulir"_ (line 446)

**CLEAN as a flow** — multi-select on Coverage, an action bar reading _"{n} Sekolah terpilih
untuk Perjadin"_, then a create form. `docs/product.md` § _Perjadin_: _"**It is launched from the
coverage view**, by selecting Schools there, rather than from a nav menu."_

**MISSING — two fields the form must carry.** Its fields are _"Nama Perjadin"_, _"Sekolah"_,
_"Mulai"_, _"Selesai"_, _"PIC"_, _"Anggota Group"_. Absent:

- **The Advance.** `docs/data-model.md` § _Travel_: _"`advance_idr` is NOT NULL because the
  Advance is fixed at planning and transferred before departure — a Perjadin is never in an
  unfunded state, so there is no nullable phase to model."_ `docs/product.md` § _Perjadin_ says
  the same. There is nowhere on this form to set it.
- **Per-member Stream assignment.** `docs/product.md` § _Perjadin_: _"the Group rule is enforced
  at creation: **one PIC, and at least one Teaching Team member assigned to each Stream**."_
  `docs/data-model.md` § _The Group_ holds `check ((role = 'Teaching Team') = (stream is not
null))`. The _"Anggota Group"_ control offers no Stream per member, so the one form that has
  to enforce the Group rule cannot express it.

**VOCABULARY DRIFT.** _"Nama Perjadin"_ against the column `destination`, which
`docs/data-model.md` § _Travel_ describes as _"free text: it is what goes on the paperwork."_

## 21. **School detail** — _"10 Sessions — 4 offline · 6 online, each with its record"_ (line 497)

**STALE — the ten Sessions are laid out in advance.** The screen renders all ten as rows,
including _"Sesi Daring 4 — **Belum dijadwalkan** · Catat"_, _"Sesi Daring 5 — Belum
dijadwalkan"_, _"Sesi Daring 6 — Belum dijadwalkan"_ and _"Sesi Luring 4 — Belum tercatat"_.
`docs/product.md` § _Sessions_: _"A Session comes into existence **when it is arranged** … never
before. **The full ten are not laid out in advance with target dates** … Progress reads '3 of 10
delivered' without any planned rows existing."_ ADR-0006 is the whole decision, and
`docs/data-model.md` § _Delivery_ restates it: _"there are no planned rows, no target dates and
nothing is ever overdue."_ _"Belum dijadwalkan"_ ("not yet scheduled") is the language of the
schedule ADR-0006 rejects.

**MISSING — the cancelled Session.** No row in the file shows a cancelled Session or its reason.
`docs/product.md` § _Sessions_: _"An arranged Session is then delivered or **cancelled**. A
cancelled Session persists, flagged with a reason. It counts for nothing, but a School that was
planned for and missed looks different from one nobody has reached yet — which is the actionable
difference."_ `session.status` carries `'cancelled'` with a `cancelled_reason` CHECK, and
`SESSION_STATUSES` in `packages/domain/src/index.ts` names it.

**STALE — the record count per Session.** Delivered rows read _"3 Kelas dicatat"_ with three
pills, GTK / MS / Student. A Session expects **six** Class Records — `docs/product.md` § _Class
Record_: _"Both Stream professors teach all three Classes, so a Session expects **six**: 2 × 3"_
— and `class_record`'s `unique (session_id, class_kind, filed_by_person_id)` makes the unit
(Class, filer), not Class. Three pills renders one record per Class. (The same undercount
appears in the _Record a Session_ flow, below.)

**CLEAN otherwise:** flagged Sessions show a compact Rating chip of the lowest Aspect
(_"Fasilitas 4"_, _"Fasilitas 2"_) and clean ones read _"Tanpa concern"_.

## 22. **School directory** — _"All 42 Schools — searchable, filterable by Cluster"_ (line 540)

**CLEAN in shape** — School / Cluster / Kabupaten / Sesi columns, _"Menampilkan 7 dari 42
Sekolah"_ — carrying the STALE Cluster and School content. Note this screen is not in the
README's screen list.

## 23. **Class Record** — _"Filed by a Teaching Team member — one per Class, seven 1–10 Ratings"_ (line 569)

**CLEAN, and the most faithful screen in the bundle.** Seven Aspects on a 1–10 row, plus
_"Materi yang dibahas · Covered"_, _"Kendala · Problems"_, _"Saran · Suggestions"_ — matching
`CLASS_RECORD_ASPECTS` in `packages/domain/src/index.ts` and the `class_record` table
column-for-column. The elaboration rule is rendered as the database holds it: _"Nilai 7 ke bawah
menjadi Concern dan **wajib disertai penjelasan**"_, and inline _"Rating {n} — wajib dijelaskan
pada Kendala."_ — `docs/data-model.md` § _Class Records_, `check (least(…) > 7 or
btrim(coalesce(problems,'')) <> '')`. The banner _"Rekan Research mengisi Class Record-nya
sendiri untuk Kelas yang sama; dua catatan yang berbeda bukan duplikasi"_ is `docs/product.md`
§ _Class Record_'s _"Two Class Records on the same Class from different professors is not
duplication."_

_Minor internal inconsistency:_ the header reads _"Menyimpan otomatis · terakhir 10:42"_
(autosave) while the _Unsaved changes_ block (line 1019) warns _"Catatan Sesi ini punya
perubahan yang belum disimpan"_. The two behaviours are mutually exclusive; no document takes a
position on either.

## 24. **Session Record — PIC** — _"The PIC's account of the visit — five Aspects, no teaching. Saved view."_ (line 609)

**CLEAN.** Five read-only Rating meters, _"Kendala"_ prose, _"Diisi PIC tentang kunjungannya —
bukan pengajaran. **Tanpa kolom Materi.**"_ — `docs/product.md` § _Session Record_: _"No Covered
field — they taught nothing."_ The _"Catatan yang belum masuk"_ panel states the arithmetic
exactly: _"Enam Class Record diharapkan (2 profesor × 3 Kelas) ditambah Session Record PIC.
Tanpa tenggat — hanya daftar untuk dikejar di grup"_ — `docs/data-model.md` § _Who still owes
what_.

## 25. **Participant feedback** — _"Public — no sign-in, opened from a 24h QR link · 3 Aspects"_ (line 632)

**CLEAN.** Class picker (GTK / MS / Siswa), three Aspects, optional comment, self-typed name, and
the QR panel captioned _"Satu tautan per Sesi, dibagikan bersama. **Bersifat indikatif, bukan
sensus.** Kedaluwarsa 24 jam"_ — `docs/data-model.md` § _Participant Feedback_: _"One token per
Session, shared"_, _"Participant Feedback is indicative, not a census"_, and ADR-0012. No
elaboration rule is imposed, correctly.

_Minor drift:_ the Class picker labels the third option _"Siswa"_ where the Program page and the
internal screens use _"Student Class"_; `CLASS_KINDS` is `["GTK", "MS", "Student"]`.

## 26. **Perjadin Evaluation** — _"How the trip went — filed by the Group. Not Staff-only · 4 Aspects"_ (line 659)

**CLEAN.** Four Aspects, Kendala / Saran, and the access rule spelled out in the UI:
_"Hanya Group yang berangkat dapat mengisi; tanpa kolom Materi. Membawa data non-keuangan, jadi
terbuka bagi siapa pun yang masuk."_ — `docs/data-model.md` § _Perjadin Evaluation → Access_
and `docs/product.md` § _Perjadin evaluation_: _"**It is not Staff-only.**"_

## 27. **Concerns** — _"Every Aspect Rated 7 or below, from all four sources, newest first"_ (line 681) and 28. **Concerns — kosong** — _"Empty state — nothing flagged"_ (line 711)

**CLEAN.** Source filter tabs, per-row source badge, subject, Aspect + compact Rating chip,
filer, prose, and the Participant caveat _"Tanpa penjelasan — Participant tidak diwajibkan"_.
Standfirst: _"Aspek yang dinilai 7 ke bawah — dari Class Record, Session Record, Participant, dan
Perjadin Evaluation. Sumbernya ditampilkan; **rubriknya tidak pernah bertabrakan**"_ — which is
`docs/data-model.md` § _The concerns list in full_: _"the four rubrics never collide."_ The empty
state is correct too. (But see §"Resolve a Concern" — the same list acquires a resolution
lifecycle 300 lines later.)

## 29. **Perjadin** — _"Trips — a Group visiting Schools over some days"_ (line 731)

**STALE — status badges that no column holds.** Rows carry _"Selesai"_, _"Acquittal tertunda"_
and _"Direncanakan"_. `docs/data-model.md` § _Travel_ gives `perjadin` **no status column** at
all; the only stored lifecycle facts are `report_filed_at`, `returned_at` and
`returned_to_treasurer_idr`, and § _Money_ is explicit that _"**There is no `perjadin_report`
table.** A Perjadin yields exactly one Report, always, so the acquittal is the state already on
`perjadin`."_

**STALE — _"Estimasi Rp 5.100.000"_** on the _"Direncanakan"_ row. An estimate is a
pre-Advance figure; `advance_idr` is `not null` and fixed at planning.

**VOCABULARY DRIFT.** _"Acquittal"_ appears as a bare UI noun here and on screens 25 and 27
(_"Lihat acquittal"_, _"Acquittal tertunda"_, _"Ajukan acquittal"_) alongside the sidebar's
_"Perjadin Report"_. `CONTEXT.md` § _Reporting_ names one term — **Perjadin Report** — and
defines it as _"The acquittal of one Perjadin"_; "acquittal" is the gloss, not the name.

## 30. **Perjadin — detail** — _"Itinerary, Group, PIC, days"_ (line 755)

**CLEAN in structure** — itinerary by day, Group with the PIC marked, summary tiles (Sekolah 3,
Sesi 3, Advance Rp 5.000.000). Carries the _"Selesai"_ status badge (STALE, as above) and money
with no role variant (see the cross-cutting finding).

## 31. **Advance** — _"Uang muka — requested before travel, reconciled by the acquittal"_ (line 789)

**STALE and UNSOURCED together — the Advance is not requested, and has no categories.**

The screen is titled _"Ajukan Advance"_ ("submit/request an Advance"), instructs
_"Perkirakan biaya per kategori"_, itemises four categories — _"Transportasi / Penginapan /
Konsumsi / Bahan"_ — totals them as _"Total Advance **diminta**"_, and offers _"Simpan draf"_ and
_"Ajukan Advance"_.

- `docs/product.md` § _Perjadin_: _"The **Advance** is fixed during trip planning and transferred
  to the PIC before departure, so a Perjadin is never in an unfunded state."_ There is no request,
  no approval and no draft phase.
- `CONTEXT.md` § _Reporting_ (Advance): _"its amount fixed during trip planning and transferred
  to the PIC before departure."_
- `docs/data-model.md` § _Travel_: `advance_idr bigint not null` — **one figure, no breakdown**,
  with _"no nullable phase to model."_ No table anywhere holds a category or an estimate.

## 32. **Perjadin Report** — _"Acquittal — reconcile spend against evidence"_ (line 819)

**CLEAN in its core**: _"Total dialokasikan / Total dibelanjakan / Selisih"_ is the derived
reconciliation `docs/data-model.md` § _Money_ describes (_"`advance_idr - sum(amount_idr)` … is a
query"_), evidence attaches per line, and the _"Tambah bukti"_ upload panel (_"JPG atau PDF, maks
5 MB"_) matches `transaction_evidence`.

**STALE — the table leads with a _Kategori_ column.** Its rows are
_"Transportasi / Penginapan / Konsumsi / Bahan"_. This is the single most direct contradiction of
ADR-0007's amendment, which exists to forbid exactly this: _"**The constraint on that export is
that it invents nothing.** It renders only what `transaction` and `transaction_evidence` already
hold, plus the derived remainder. **No category, no cost-centre, no account code, no payee** —
nothing added to make the output look more like official paperwork."_ `docs/data-model.md`
§ _Money_ repeats it: _"**There is no category column yet, and the export does not get to add
one.**"_ `docs/product.md` § _The acquittal_: _"It **invents no fields**."_ The columns the
export may render are `spent_on`, `description`, `amount_idr`, the evidence, and the remainder —
and `spent_on` is the one this table omits.

**STALE — the submission gate.** _"Satu baris belum memiliki bukti. **Acquittal dapat diajukan
setelah semua bukti dilengkapi.**"_, with _"Ajukan acquittal"_ as the primary action.
`docs/product.md` § _The acquittal_: _"**Nothing is gated.** DITSAMA sets that deadline itself,
and the tool is never stricter than the process it serves — invented friction has the same escape
route as duplicated work."_ There is also nobody to submit _to_: filing is `report_filed_at`, a
timestamp, not a submission into a queue.

**MISSING — the returned-to-Treasurer mark.** `perjadin.returned_to_treasurer_idr` /
`returned_at` are paired by a CHECK, and `docs/product.md` § _The acquittal_ says _"Whatever is
left is returned to the Treasurer."_ The screen shows _"Selisih Rp 60.000"_ but has no control
recording that it was returned. ADR-0007's amendment lists _"the returned-to-Treasurer mark"_
among the things the screen ships with.

**MISSING — the export itself.** No screen in the bundle shows or offers the generic export,
which is the one thing ADR-0007 says the acquittal exists to produce: _"a plain itemisation a PIC
can attach."_ Verified by grep across the whole file — `Ekspor`, `Unduh`, `Cetak`, `download`
and `Export` all return **0**, as does `data-lucide="file-down"`. (The handoff README
§ _Iconography_ offers `file-down → FileDown` as a mapping to make, but the icon appears nowhere
in the prototype — a further instance of the README describing more than its HTML contains.)

---

# Part C — Flows & states (lines 861–1200)

## 33. **Persetujuan** — _"Approver queue — Advance & Acquittal awaiting a decision"_ (line 873)

## 34. **Advance — persetujuan** — _"Approve · return for revision · reject, with a note"_ (line 891)

## 35. **Acquittal — review** — _"Submitted → under review → returned with comments → approved"_ (line 913)

**STALE, as one finding — an approval regime the documents deny at three levels.**

The three screens implement a queue (_"Permintaan yang menunggu keputusan Anda · Menunggu 2"_,
statuses _"Menunggu / Disetujui / Dikembalikan"_), a decision panel (_"Tolak · Kembalikan ·
Setujui"_ with _"Catatan untuk PIC"_), and a review thread with a status rail
(_"Diajukan → Sedang ditinjau → Dikembalikan sekali → Disetujui"_, _"Kembalikan lagi · Setujui
acquittal"_, annotated by _"Budi W. · **Approver**"_).

- **No such role.** `docs/product.md` § _The internal tool_: _"Two roles, and no third: **Staff**
  … and **Teaching Team**."_ ADR-0004: _"There are two roles, Staff and Teaching Team. The
  Programme's leadership are senior Staff, not a separate role."_ `ROLES` in
  `packages/domain/src/index.ts` is `["Staff", "Teaching Team"]`, and `person.role` carries
  `check (role in ('Staff','Teaching Team'))`.
- **No gate.** `docs/product.md` § _The acquittal_: _"**Nothing is gated.**"_
- **No state to store.** No approval status, no reviewer, no review-note table exists anywhere in
  `docs/data-model.md` — so this is UNSOURCED as well as STALE.

**The prototype contradicts itself here.** The Staff dashboard (line 370) renders the correct
rule in copy — _"Tidak ada gerbang — DITSAMA yang menetapkan tenggat, bukan alat ini"_ — about
the very same acquittal that these three screens put behind a four-state approval workflow.

## 36. **Perjadin lifecycle** — _"The states a Perjadin moves through"_ (line 950)

**STALE and UNSOURCED.** Four states: _"Draf → Direncanakan → Berlangsung → Selesai"_, described
as _"Draf — Sekolah dipilih dari Coverage; **belum ada Advance**"_, _"Direncanakan — Tanggal,
Group, dan Advance ditetapkan **& disetujui**"_, _"Berlangsung — Group di lapangan"_,
_"Selesai — Semua Sesi tercatat; **Acquittal diajukan**"_.

`perjadin` has no status column. The _Draf_ state is specifically excluded by
`docs/data-model.md` § _Travel_: _"`advance_idr` is NOT NULL because the Advance is fixed at
planning … **a Perjadin is never in an unfunded state, so there is no nullable phase to
model**."_ _Direncanakan_ re-imports the approval step, and _Selesai_ the submission step.

## 37–38. **Ubah Group** — _"Reassign / PIC"_ (lines 970 and 972)

**STALE — per-member editing is the one operation the schema refuses.** The panel lists Group
members each with a remove control (three `x` icons), plus _"Tambah anggota"_ (`plus`), _"Batal"_
and _"Simpan"_. `docs/data-model.md` § _The Group_: _"**A Group is replaced wholesale, never
edited. There is no 'remove one member' operation.** Substituting a professor submits an entire
replacement Group, and one transaction deletes every member row and inserts the new set."_ That
rule is load-bearing elsewhere — § _Why there is no foreign key to the Group_ shows wholesale
replacement is what forces `perjadin_evaluation.filed_by_person_id` to reference `person` alone.

**MISSING — Stream per member**, as on the create form: `check ((role = 'Teaching Team') =
(stream is not null))` and _"at least one Teaching Team member assigned to each Stream"_
(`docs/product.md` § _Perjadin_). The panel shows names and a PIC marker only.

## 39. **Record a Session** — _"End-to-end — from Coverage back to updated Coverage"_ (line 988)

**Mostly CLEAN**; the five steps run Coverage → School detail → Class → fill → updated Coverage,
and step 5 states the concerns behaviour correctly (_"Rating 7 ke bawah memunculkan Aspek di
Concerns"_).

**STALE — step 3 undercounts.** _"Langkah 3 Pilih Kelas — **Satu catatan per Kelas** — GTK, MS,
Student."_ It is one per Class **per professor**: `docs/product.md` § _Class Record_ —
_"**One per Class, per professor.** … a Session expects **six**: 2 × 3"_ — and `class_record`'s
`unique (session_id, class_kind, filed_by_person_id)`. Same undercount as School detail's
_"3 Kelas dicatat"_.

## 40. **Resolve a Concern** — _"Open → add a resolution note → mark resolved"_ (line 1004)

**STALE and UNSOURCED — concerns have no lifecycle and are not rows.** The screen offers a
_"Resolusi"_ textarea, _"Simpan catatan"_ and _"Tandai selesai"_, and shows a worked example
badged _"Selesai — … Ditutup oleh Rani N. · 3 hari lalu."_

- ADR-0009, in its opening statement: _"blocking notes are **prose rather than tracked items with
  a resolved state**."_
- ADR-0006 § _Consequences_: _"The prose on a Session Record is for the next Group to read, **not
  a set of tracked items with resolved states, so it carries no status meaning anywhere**."_
- `docs/data-model.md` § _The concerns list in full_ shows the list is a **query** — four
  unpivots unioned over the four evaluation tables — not a table. There is no concern row to
  resolve, no resolution column, no closed-by, no closed-at.
- `docs/product.md` § _Concerns list_ describes it as _"A plain list of **Aspects Rated 7 or
  below** … newest first, each linking to what it came from."_

## 41. **Unsaved changes** — _"Simpan perubahan?"_ (line 1019)

**CLEAN as a state**, though see the autosave inconsistency noted under Class Record.

## 42. **Validation errors** — _"Field-level, on save"_ (line 1023)

**STALE — a fossil of two retired designs.** The frame contains two live fields:

1. `<label>Peserta hadir</label>` with `<input value="40">` and the error _"Tidak boleh melebihi
   **peserta terdaftar** (32)."_ — an attendance count validated against an enrolment roll.
   `docs/data-model.md` § _Participant Feedback_: _"**No `person_id`, no enrolment, no attendee
   list** — ADR-0009 decided against building one."_ `docs/product.md` § _Who still owes what_:
   _"**Participants cannot be listed.** Nobody knows who was in the room, so '4 of ? responded'
   is a count with no denominator."_ No form in the system asks for attendance.
2. `<label>Bagaimana berjalannya</label>` over a single-choice control erroring
   _"**Pilih salah satu penilaian** sebelum menyimpan."_ — the retired three-value pick. ADR-0006
   § _Amended_: _"The signal was originally a three-value pick — *on track*, *some concerns*,
   *struggling*"_; the handoff's own README § _Concept delta_ says _"The old `ontrack / concern /
struggling` variants are gone."_ The Rating input is a row of ten cells; "pick one of the
   assessments" describes neither.

## 43. **Publish a story** — _"Authored internally — draft, attach photos, publish to the public site"_ (line 1039)

**Partly CLEAN.** A title input, a body textarea, a _"Draf"_ badge and a _"Terbitkan"_ action
match `docs/data-model.md` § _Stories_: _"**`published_at` NULL is a draft.** No status enum …
Setting it publishes."_ The closing note _"Setelah terbit, cerita muncul di /cerita dan Beranda"_
matches the revalidation route.

**STALE — photographs sourced from a Session Record.** _"Foto — **Dari Sesi** … Foto dapat
diambil dari **Dokumentasi Session Record** atau diunggah baru."_ This is the one wall every
publishing document defends:

- `CONTEXT.md` § _Publishing_ (Story): _"A Story is authored, never derived: **no Session Record,
  Class Record, Participant Feedback or Perjadin Report is ever a source for one**."_
- `docs/product.md` § _The public site_: _"Class Records, Session Records and Perjadin Reports
  never reach a public page — not filtered, not flagged, not summarised."_
- ADR-0008 § _Second amendment_: _"the wall below stands: a Story is authored for publication, and
  **no internal record is ever a source for one**."_
- There is also nothing to source from: `session_record` holds five smallints plus `problems` and
  `suggestions`. **No documentation or photo attachment exists on any internal record** except
  `transaction_evidence`, which lives in the private `receipts` bucket
  (`docs/data-model.md` § _Object storage_).

**STALE — a Cluster field.** The composer carries an editable _"Cluster"_ input (value
_"Priangan Timur"_) beside _"Sekolah"_. `docs/data-model.md` § _Stories_: _"**`school_id` is NOT
NULL, and it is the only thing a Story attaches to.** … the Cluster is `school.cluster_id`
reached through the join … **There is no `cluster_id` and no `perjadin_id`.**"_

_(The composer's own *"Penulis — Rani N."* is correct — Staff. It is the public **Cerita —
detail** page at line 162 that bylines a Teaching Team author; that finding is recorded there.)_

**MISSING — withdrawal.** No unpublish/take-down control anywhere in the bundle.
`docs/product.md` § _Publishing_: _"**A Story is a draft until it is published, and comes down
immediately when withdrawn.** Publishing or unpublishing tells the public site to refresh."_
`docs/data-model.md` § _Stories_: _"clearing it takes the Story down … fine for a figure, not
fine for a photograph that has to come down now."_ The prototype has `Terbitkan` twice and no
`Tarik`, `Turunkan` or equivalent.

**MISSING — photo ordering and captions.** `story_photo` carries `position` (the first is the
cover) and `caption`, with `unique (story_id, position)` immediate, which
`docs/data-model.md` § _Stories_ says forces the editor to _"submit the whole ordering and
rewrite every row."_ The composer shows a flat photo strip with no cover, order or caption
affordance.

**MISSING — a Stories index.** There is a composer but no list of Stories, no draft/published
inventory, and no nav entry for publishing in any sidebar in the file.

## 44. **Cluster setup** — _"Allocate Schools, set the Topic & Problem"_ (line 1065)

**STALE — an admin screen the documents rule out by name.** Fields: _"Nama Cluster"_, _"Topik"_,
_"Problem"_, and a School multi-select (_"2 dari 4 Sekolah dipilih"_, _"Simpan Cluster"_).

`docs/product.md` § _What it deliberately does not do_: _"**No admin screens for Schools,
Clusters or Topics.** They are fixed reference data, seeded by migration."_
`docs/data-model.md` § _Reference data_: _"Seeded by migration. **No admin screens** —
`product.md` is explicit that Schools, Clusters and Topics are fixed facts, not records with an
editing lifecycle."_ ADR-0013 relies on that same rule to explain why People are the exception:
_"Schools, Clusters and Topics have no admin screens because they are fixed reference data …
**People are not reference data.**"_ The prototype builds the screen the documents exclude and
omits the one they require.

## 45. **Roles & permissions** — _"Who can do what"_ (line 1091)

**STALE — asserts the three-role model as policy.** A four-column matrix, _"Kemampuan | Teaching
| Staff | **Approver**"_:

| Kemampuan                   | Teaching | Staff | Approver |
| --------------------------- | -------- | ----- | -------- |
| Catat Sesi                  | ✓        | ✓     | —        |
| Rencanakan Perjadin         | —        | ✓     | —        |
| Terbitkan Cerita            | —        | ✓     | —        |
| Setujui Advance / Acquittal | —        | —     | ✓        |

Two problems beyond the third column existing at all. **Staff explicitly cannot approve** — the
last row gives Staff a dash — so this is not "leadership are senior Staff" rendered loosely; it
is a distinct role with an exclusive capability. ADR-0004 forecloses it: _"There are two roles,
Staff and Teaching Team. The Programme's leadership are senior Staff, not a separate role."_
ADR-0013 § _Consequences_ adds that `active = false` cannot become a third state either:
_"that would be a third role, and `product.md` says there are two."_

**MISSING — the matrix has no row for adding or revoking People**, which is the one Staff-only
write ADR-0013 adds. It corroborates the absence documented below.

## 46. **Sign-in edge cases** (line 1101)

**STALE — both cases are the wrong mechanism.**

- _"**Domain tidak diizinkan** — Akun nama@gmail.com di luar @ditsama.itb.ac.id. Gunakan akun
  DITSAMA Anda."_ As under **Masuk**: the gate is the `person` invite list, not an email domain,
  and ADR-0003 chose Google precisely because _"the Teaching Team is not guaranteed to be
  entirely ITB account holders."_ A `gmail.com` professor is a legitimate invitee, not an error
  case.
- _"**Belum punya peran** — Akun Anda dikenali, tetapi belum diberi peran. Hubungi admin Program
  untuk akses."_ Unreachable. `person.role` is `not null` and set when the Person is invited, and
  ADR-0013 makes it write-once. There is no recognised-but-unroled account: `docs/data-model.md`
  § _Identity_ — _"an uninvited Google account **cannot create a user row at all**."_

**MISSING — the revoked-Person case.** ADR-0013 § _Revocation needs a second mechanism_ is the
state that does exist and has no screen: a Person who has signed in before, then had
`active = false` written and a Better Auth `/admin/ban-user` applied, which _"blocks sign-in and
revokes existing sessions in one call."_ The bundle has no banned/revoked sign-in state.

**VOCABULARY DRIFT — "admin".** _"Hubungi **admin** Program"_. `CONTEXT.md` § _People and travel_
(Staff) lists _avoid: leadership, **admin**, organiser_.

## 47. Empty, loading & error states (line 1101 band)

**CLEAN:** _"Belum ada Sesi tercatat"_ (Coverage first run), _"Belum ada Perjadin"_,
_"Memuat…"_, _"Gagal memuat data"_.

**STALE — the offline card.** _"**Anda sedang luring** — Catatan Sesi disimpan di perangkat dan
akan **tersinkron otomatis** saat koneksi kembali. 2 menunggu sinkron."_ `docs/product.md`
§ _The acquittal_: _"**There is no offline support**; capture needs connectivity, and where it
fails the PIC enters it later, losing convenience but never data. Offline is worth adding
eventually, not worth blocking on."_ ADR-0007: _"**Offline support is deliberately deferred.**"_
A device-side queue with automatic sync is the deferred feature, shown as built.

## 48. **Notifikasi** (line 1120)

**STALE.** Three items: _"**Concern baru** di SMA Negeri 2 Tasikmalaya"_, _"**Advance
dikembalikan** untuk revisi"_, _"**Acquittal Priangan Timur disetujui**"_.
`docs/product.md` § _What it deliberately does not do_: _"**No scheduling, no overdue, no
alerts.**"_ Two of the three items are also events from the approval regime that does not exist.

## 49. **Internal search** — _"Across Schools, Perjadin & records"_ (line 1129)

**UNSOURCED (flavour 2) / undocumented.** Results across Schools and Perjadins. The data is
present internally and `@sugt/db` could serve it, so nothing contradicts a document — but no
document describes this surface, and searching _"records"_ would cross the money boundary
(a Perjadin result carries its trip) without any stated Staff-only handling. Recorded here so it
is not mistaken for a documented requirement.

---

# Cross-cutting findings

These are not attached to one screen.

## M1. There is no People screen anywhere in the bundle

**MISSING — the largest single gap.** ADR-0013 and `docs/product.md` § _People — the invite list_
require a Staff-only screen where People are added and revoked. Grepping the whole 272KB
prototype:

| Term                                | Occurrences |
| ----------------------------------- | ----------- |
| `Undang` / `undang` / `invite`      | 0           |
| `roster`                            | 0           |
| `Nonaktif` / `nonaktif` / `Cabut`   | 0           |
| `Peran` (capitalised, as a field)   | 0           |
| `People` / `Orang` / `Daftar Orang` | 0           |

And no nav entry in any sidebar. Counting nav items across all twelve internal frames gives the
complete set: **Coverage** (12), **Perjadin** (12), **Concerns** (12), **Perjadin Report** (11,
Staff frames only), **Beranda** (2, the dashboards). There is no People entry — and none for
publishing or for the approval queue either. With no such screen, four documented behaviours have
no design:

1. **Adding a Person** — `full_name`, `email`, `role`, with `role` chosen at invite time.
2. **Role is write-once, stated rather than offered.** `docs/product.md` § _People_: _"**A
   Person's role cannot be changed once they have been used.** The database refuses it, and
   correcting a wrong one means revoking that Person and adding a new one … **The screen says so
   rather than offering an edit that will be rejected.**"_ ADR-0013 § _Why role is write-once_
   traces it to six composite foreign keys defaulting to `NO ACTION`.
3. **Revocation as two writes.** `docs/product.md` § _People_: _"**Revoking is two things, not
   one.** `active = false` gates *signup* … So revoking also bans them through Better Auth, which
   blocks sign-in and ends existing sessions. `active` is the fact; the ban is how it is
   enforced."_ `docs/data-model.md` § _Identity_ and ADR-0013 § _Revocation needs a second
   mechanism_ say the same. Nothing in the design expresses either half.
4. **Re-inviting**, which ADR-0013 says _"reverses both"_ — and the revoked row that remains,
   which is why `person_email_key` becomes partial.

## M2. Money has no Teaching-Team-safe variant

**MISSING.** ADR-0004: _"Perjadin Reports and their financial detail are visible to **Staff
only**."_ But:

- The **Teaching Team dashboard** sidebar (line 338) carries **Perjadin** — correctly, since
  ADR-0004 opens delivery data and a Perjadin Evaluation is explicitly _not_ Staff-only
  (`docs/product.md` § _Perjadin evaluation_), so a professor must be able to reach their trip.
- The **Perjadin list** (line 731) renders `Rp 4.940.000`, `Rp 3.820.000`, `Rp 5.100.000`.
- The **Perjadin detail** (line 755) renders _"Advance Rp 5.000.000"_.
- Neither screen has a Staff-only marker (unlike the Staff dashboard's Advance strip, which does
  carry _"Hanya Staff"_), and no money-free variant of either exists.

`docs/data-model.md` § _What the database does not hold_ notes this is application code, not RLS
— _"Every money-reading query therefore takes the authenticated Person and refuses a non-Staff
caller, at a single choke point in `@sugt/db`"_ — which makes the screen variant the only place
the rule becomes visible. The design does not show it.

## M3. The launch gate ADR-0008 names is largely undesigned

ADR-0008 § _Second amendment_ states the first release's gate: _"Launch is now gated on Better
Auth working, the invite list existing (ADR-0013), the `public-media` bucket, publishing tables
and a Staff-only editor."_ Of those, the bundle contains one Story composer card (line 1039,
itself STALE on photo sourcing and the Cluster field) and no invite list, no Stories index, no
withdrawal path, no photo ordering. `docs/product.md` § _Publishing_ adds _"the public site
therefore launches with real Stories in the database"_ — a state the public Cerita screens
already assume, so those are fine; it is the authoring side that is thin.

## M4. Vocabulary drift, collected

| Prototype copy                                                  | Where                | `CONTEXT.md` term                                                                   |
| --------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| _"Approver"_, _"Persetujuan"_, _"Setujui"_                      | lines 873–913, 1091  | No such role or act. Two roles only (§ _People and travel_; ADR-0004)               |
| _"Acquittal"_ as a bare noun                                    | lines 731, 755, 819  | **Perjadin Report** (§ _Reporting_)                                                 |
| _"Ajukan Advance"_, _"Total Advance diminta"_, _"Estimasi"_     | lines 789, 731       | An Advance is _fixed_, not requested (§ _Reporting_)                                |
| _"Kategori"_ on transactions                                    | line 819             | No such concept; ADR-0007 amendment forbids it                                      |
| _"Domain tidak diizinkan"_                                      | lines 309, 1101      | _"'domain' only ever means the web address"_ (§ _Flagged ambiguities_)              |
| _"admin Program"_                                               | line 1101            | **Staff** — _avoid: leadership, admin, organiser_ (§ _People and travel_)           |
| _"Belum dijadwalkan"_, _"dari 10 direncanakan"_                 | lines 497, 1161      | Sessions are arranged, never scheduled ahead (ADR-0006)                             |
| _"Draf / Direncanakan / Berlangsung / Selesai"_                 | lines 950, 731       | No Perjadin lifecycle exists                                                        |
| _"Bagaimana berjalannya"_ + single pick                         | line 1023            | Retired; **Rating** 1–10 against an **Aspect** (§ _Reporting_)                      |
| _"Peserta hadir / peserta terdaftar"_                           | line 1023            | No enrolment; a **Participant** is never named except by themselves (§ _Reporting_) |
| _"Dokumentasi Session Record"_                                  | line 1039            | No such thing; a Story is never derived (§ _Publishing_)                            |
| _"Energi Terbarukan"_ as a Topic                                | lines 178, 243, 1190 | Not one of the four (§ _Open questions_)                                            |
| _"Priangan Timur / Pantura / Priangan Barat / Ciayumajakuning"_ | throughout           | Seeded Clusters are **Klaster 1–4**                                                 |
| _"Siswa"_ as a Class                                            | line 632             | **Student Class** (`CLASS_KINDS` = GTK, MS, Student)                                |
| _"Tim Pengajar STEM"_ as a Story byline                         | line 162             | Publishing is Staff-only (§ _Publishing_; ADR-0004)                                 |
| _"sembilan provinsi"_ / _"9 Provinsi"_                          | lines 215, 290       | 15 provinces (`docs/product.md` § _The public site_)                                |

---

# Inventory summary

Complete list, canvas order. A screen appears in exactly one row but may carry several tags.

| #   | Screen label (verbatim)        | Line | Verdict                                                                               |
| --- | ------------------------------ | ---- | ------------------------------------------------------------------------------------- |
| 1   | **Beranda**                    | 84   | Clean core; MISSING absent-delivery-band and failed-fetch states                      |
| 2   | **Program**                    | 113  | Clean; UNSOURCED Final Project step                                                   |
| 3   | **Cerita**                     | 147  | Clean                                                                                 |
| 4   | **Cerita — detail**            | 162  | STALE (Teaching Team byline; publishing is Staff-only)                                |
| 5   | **Cluster**                    | 178  | STALE ×2 (unallocated state; Cluster identities/sizes/Topic)                          |
| 6   | **Cluster — detail**           | 196  | Clean shape; stale content                                                            |
| 7   | **Tentang**                    | 215  | STALE (nine vs fifteen provinces)                                                     |
| 8   | **Final Project**              | 243  | UNSOURCED (no data) + STALE (wrong unit)                                              |
| 9   | **Pencarian**                  | 261  | UNSOURCED (no route; body-level search undocumented)                                  |
| 10  | **404**                        | 283  | Clean                                                                                 |
| 11  | **Beranda — mobile**           | 290  | STALE (9 Provinsi)                                                                    |
| 12  | **Masuk**                      | 309  | STALE (domain allowlist, not the invite list); DRIFT                                  |
| 13  | **Dashboard — Teaching Team**  | 338  | Clean                                                                                 |
| 14  | **Dashboard — Staff**          | 370  | Clean                                                                                 |
| 15  | **Coverage**                   | 409  | Clean behaviour; stale content                                                        |
| 16  | **Rencanakan Perjadin**        | 446  | Clean flow; MISSING Advance + Stream fields; DRIFT                                    |
| 17  | **School detail**              | 497  | STALE ×2 (ten rows pre-laid; 3 not 6 records); MISSING cancelled Session              |
| 18  | **School directory**           | 540  | Clean shape; stale content                                                            |
| 19  | **Class Record**               | 569  | Clean                                                                                 |
| 20  | **Session Record — PIC**       | 609  | Clean                                                                                 |
| 21  | **Participant feedback**       | 632  | Clean; minor drift                                                                    |
| 22  | **Perjadin Evaluation**        | 659  | Clean                                                                                 |
| 23  | **Concerns**                   | 681  | Clean                                                                                 |
| 24  | **Concerns — kosong**          | 711  | Clean                                                                                 |
| 25  | **Perjadin**                   | 731  | STALE (status badges, estimate); DRIFT                                                |
| 26  | **Perjadin — detail**          | 755  | Clean structure; stale badge; money-variant gap                                       |
| 27  | **Advance**                    | 789  | STALE + UNSOURCED (request/approval/draft; categories)                                |
| 28  | **Perjadin Report**            | 819  | Clean core; STALE ×2 (Kategori column; submission gate); MISSING return mark + export |
| 29  | **Persetujuan**                | 873  | STALE + UNSOURCED                                                                     |
| 30  | **Advance — persetujuan**      | 891  | STALE + UNSOURCED                                                                     |
| 31  | **Acquittal — review**         | 913  | STALE + UNSOURCED                                                                     |
| 32  | **Perjadin lifecycle**         | 950  | STALE + UNSOURCED                                                                     |
| 33  | **Ubah Group**                 | 970  | STALE (per-member edit); MISSING Stream                                               |
| 34  | **Record a Session**           | 988  | Clean; STALE step 3                                                                   |
| 35  | **Resolve a Concern**          | 1004 | STALE + UNSOURCED                                                                     |
| 36  | **Unsaved changes**            | 1019 | Clean                                                                                 |
| 37  | **Validation errors**          | 1023 | STALE ×2 (attendee list; three-value pick)                                            |
| 38  | **Publish a story**            | 1039 | STALE ×3; MISSING withdrawal, ordering, index                                         |
| 39  | **Cluster setup**              | 1065 | STALE (admin screen ruled out by name)                                                |
| 40  | **Roles & permissions**        | 1091 | STALE (three roles); MISSING People row                                               |
| 41  | **Sign-in edge cases**         | 1101 | STALE ×2; MISSING revoked-Person case                                                 |
| 42  | Empty / loading / error states | 1101 | Clean; STALE offline card                                                             |
| 43  | **Notifikasi**                 | 1120 | STALE                                                                                 |
| 44  | **Internal search**            | 1129 | UNSOURCED (undocumented surface)                                                      |
| 45  | **Final Project — detail**     | 1144 | UNSOURCED + STALE (wrong unit)                                                        |
| 46  | **School — public page**       | 1161 | Clean; minor drift                                                                    |
| 47  | **Cerita — mobile**            | 1176 | Clean                                                                                 |
| 48  | **Cluster — mobile**           | 1190 | STALE content                                                                         |

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
Beranda without a delivery band (`docs/product.md` § _The public site_), the cancelled Session
(`docs/product.md` § _Sessions_), the returned-to-Treasurer mark and the generic export
(ADR-0007 amendment), the revoked-Person sign-in case (ADR-0013), and money-free Perjadin views
for Teaching Team (ADR-0004).

---

## Aside: one docs-internal inconsistency noticed in passing

Not a design defect and not in any bucket. `docs/data-model.md` § _Still open_ reads _"What else
the Participant form asks for. Right now: Class, **five** Ratings, comment, name."_ The
`participant_feedback` table and `PARTICIPANT_FEEDBACK_ASPECTS` both carry **three** —
Materials, Instructor, Relevance — as does every other passage in the same document. The
prototype's Participant screen renders three, correctly.
