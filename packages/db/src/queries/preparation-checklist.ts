/**
 * The Preparation Checklist's shape, **derived and never stored**
 * ([#114](https://github.com/mafiefa02/sugt/issues/114)).
 *
 * `perjadin_preparation_item` holds only the ticks; the *set of items that exists* is this
 * **flat, fixed seven**, assembled here. Since the amendment to ADR-0018 there is no per-member
 * derivation — the Teaching Team stopped being People (ADR-0020), so the old one-box-per-professor
 * became a single `pengajar_lengkap` box. `N = 7` for every Perjadin, and this no longer reads the
 * Group at all. Shared beneath the three modules that need it — the detail read, the directory
 * count and the toggle write — the way `./group-rules.ts` is, and not on the package's public
 * surface for the same reason: no screen renders these constants, only the payloads built from them.
 */

/** One derived checklist item, in render order. */
export type PreparationItem = {
  itemKey: string;
  /** The Indonesian label, fixed for all seven. */
  label: string;
  checked: boolean;
  /** Who last ticked it, and when — recorded for later use; nothing renders these yet. */
  checkedBy: string | null;
  checkedAt: Date | null;
};

/**
 * The seven fixed items, in order, with their stable keys. **Written out here, character for
 * character**, the same way the CHECK lists are: these keys are stored in `item_key` and a composed
 * list would drift from the strings the rows already hold. `staff` is a **single** box — "confirmed
 * with the Staff", not one per Staff member. `pengajar_lengkap` is the seventh, replacing the old
 * per-teacher boxes (the amendment to ADR-0018): it is ticked by hand like the rest, but is the one
 * box the tool clears by itself — the teacher-mutation queries delete its tick whenever the Teaching
 * Team changes, so each change forces a fresh manual confirmation that the team is complete.
 */
export const PREPARATION_FIXED_ITEMS = [
  { itemKey: "sk_perjalanan", label: "SK Perjalanan" },
  { itemKey: "tiket_keberangkatan", label: "Tiket keberangkatan" },
  { itemKey: "tiket_kepulangan", label: "Tiket kepulangan" },
  { itemKey: "booking_penginapan", label: "Booking penginapan" },
  { itemKey: "transportasi_lokal", label: "Konfirmasi dengan pihak transportasi lokal" },
  { itemKey: "staff", label: "Konfirmasi dengan para staff" },
  { itemKey: "pengajar_lengkap", label: "Pengajar sudah lengkap" },
] as const;

/** The fixed keys alone, for the directory query's "these are always live" test. */
export const PREPARATION_FIXED_KEYS = PREPARATION_FIXED_ITEMS.map((item) => item.itemKey);

/** The item key the teacher-mutation queries clear on any Teaching-Team change (amendment to ADR-0018). */
export const PENGAJAR_LENGKAP_KEY = "pengajar_lengkap";

/** Where the ticked rows land, so `checked`/`checkedBy`/`checkedAt` fill in per item. */
export type PreparationTick = {
  itemKey: string;
  checkedBy: string;
  checkedAt: Date;
};

/**
 * The derived checklist for one Perjadin: the seven fixed items, each carrying its current tick
 * state. No longer reads the Group — `N` is always seven, and `x` is how many of the seven are
 * ticked. Any `dosen:` ticks the old model left in the table have no item here, so they never
 * count — orphans are ignored, no cleanup needed (ADR-0018).
 */
export function derivePreparationChecklist(ticks: PreparationTick[]): PreparationItem[] {
  const byKey = new Map(ticks.map((tick) => [tick.itemKey, tick]));
  return PREPARATION_FIXED_ITEMS.map((item) => {
    const tick = byKey.get(item.itemKey);
    return {
      itemKey: item.itemKey,
      label: item.label,
      checked: tick !== undefined,
      checkedBy: tick?.checkedBy ?? null,
      checkedAt: tick?.checkedAt ?? null,
    };
  });
}
