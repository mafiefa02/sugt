A 1–10 Aspect score. Ratings are the only thing in the system anything counts, so this is the component the concerns list, both internal record forms and the Participant form are all built from.

```jsx
<Rating value={9} label="Penyampaian" />
<Rating value={7} label="Fasilitas" />
<Rating value={4} label="Pemahaman" />
<Rating value={1} label="Kehadiran" />
<Rating value={3} variant="compact" />
```

Props: `value` (1–10), `label` (the Aspect, in Indonesian), `variant` (`default` | `compact`).

**The digit always shows.** Magnitude lives in the number and in the meter's length, not in colour — which is both the accessible answer and the only one available, since the palette has no green and no amber.

**Colour marks one boundary and no others.** At or below **7** an Aspect reaches the concerns list and reads red; 8 and above are quiet grey. That threshold is the domain's (`CONCERN_AT_OR_BELOW`), not a visual invention. Do not add "mild / bad / severe" bands — that would invent two more thresholds on top of the one ADR-0006 already apologises for.

Within 1–7 the fill deepens **continuously**, so a 1 reads solid and a 7 faint without either being a separate category.

**Good is quiet, never green.** A high Rating gets no reward colour; it simply stops being red. That is the "counts, not claims" tone — the system reports, a human judges.

Use `compact` in dense rows: a Class Record carries seven Aspects, and seven meters on one line is unreadable. Keep `default` wherever the Aspect deserves its own line — forms, record detail, the concerns list.
