# A Perjadin is named by its Kelompok and dates; the destination snapshot is dropped

A Perjadin's name is **`{Sub-Cluster name} · {dates}`** — `Kelompok 10 · 12–13 Okt 2026` — on every
internal screen. The date part is `formatTripDates`'s: `12 Okt 2026` for a one-day trip,
`30 Sep – 2 Okt 2026` across two months, `30 Des 2026 – 2 Jan 2027` across two years. The name is
**read live** from `sub_cluster.name` and the trip's dates and **never stored**. One formatter
(`apps/internal/src/lib/perjadin-name.ts`) builds it for the screens, both Drive folders and the CSV
export.

**`perjadin.destination` is dropped.** This reverses the design from
[#105](https://github.com/mafiefa02/sugt/issues/105), which derived a Surat Tugas line —
`Kelompok 18: Samarinda, Bontang dan Balikpapan` — at insert and froze it.

Settled with the product owner on 2026-10-06
([#406](https://github.com/sugt-itb/sugt-itb-26/issues/406)).

## Why

- **No Surat Tugas generator exists.** The snapshot was kept so an issued Surat Tugas could not be
  rewritten by a later Sub-Cluster edit. The app never generates one, and
  [ADR-0007](./0007-the-tool-generates-the-acquittal.md) says the paperwork's real names are still
  unconfirmed.
- **A whole-Sub-Cluster line misnames a subset trip.** The line named every Kabupaten/Kota in the
  Sub-Cluster. Once one Sub-Cluster may be covered by several Perjadins
  ([ADR-0043](./0043-a-sub-cluster-may-be-covered-by-several-perjadins.md)), a trip to two of its
  three Schools was labelled as going to all three, and two trips of one Kelompok looked the same.

## The trip's Schools, as a second line

**The trip's Schools** are the Schools with at least one **non-cancelled** Session on the Perjadin,
alphabetically, full name as stored, joined with `, `. One query-side definition in `@sugt/db`
(`tripSchoolNames`) serves every read. They show as a muted second line under the name on the
`/perjadin` rows, the `/pendamping` trip cards, the `/log` entries and the `/ep/[token]` header;
everywhere else the name stands alone.

The line exists because the name alone cannot tell apart **two same-day trips of one Kelompok** — a
case ADR-0043 now allows.

## Drive folder and CSV names

Both of a trip's Drive folders — Bukti Transaksi ([ADR-0040](./0040-transaction-evidence-is-stored-in-the-company-google-drive.md))
and Dokumen ([ADR-0042](./0042-perjadin-documents-are-stored-in-the-company-google-drive.md)) — are
named

```
{name} · {the trip's Schools} · P-{first 8 hex characters of perjadin.id}
Kelompok 10 · 12–13 Okt 2026 · SMAN 1 Bontang, SMAN 2 Samarinda · P-1a2b3c4d
Kelompok 10 · 12–13 Okt 2026 · P-1a2b3c4d                      ← no live Session
```

The `P-` id matches the `T-` and `D-` convention and appears in Drive names only, never on screen.
The CSV export is named by the same rule without the id, slugified:
`laporan-perjadin-kelompok-10-12-13-okt-2026-sman-1-bontang-sman-2-samarinda.csv`.

The reconcile already re-asserts the folder name, since names are app-owned, so an existing folder
takes the new rule the next time anything on its trip reconciles. Renaming when the trip's Schools
or end date change is [#407](https://github.com/sugt-itb/sugt-itb-26/issues/407)'s.

## Considered options

- **Keep `destination` and add a name beside it.** Rejected: two labels for one trip, one of them
  frozen and wrong for a subset trip.
- **Store the name.** Rejected: a stored name is a second copy of the Sub-Cluster's name and the
  dates, and drifts from both the moment either is edited.
- **Name the trip by its Schools alone.** Rejected: the Kelompok is how the team talks about a trip,
  and a trip with no live Session would have no name.

## Consequences

- **A renamed Sub-Cluster relabels its trips, past ones included.** Accepted: there is no issued
  paperwork for the old label to contradict.
- **`shortenKabupaten` goes.** It abbreviated "Kabupaten" in the destination line, which no longer
  exists. `/log` search loses its `Kabupaten`→`Kab.` regexp and matches the Sub-Cluster name and the
  trip's Schools instead; `/perjadin` search matches the name and the Schools.
- **`/perjadin` sorts by name** numerically — Kelompok 2 before Kelompok 10 — and two trips of one
  Kelompok by their dates.
- **The migration drops the column outright.** Nothing is backfilled: the name is derived.
