/**
 * The Preparation Checklist's shape, **derived and never stored**
 * ([#114](https://github.com/mafiefa02/sugt/issues/114)).
 *
 * `perjadin_preparation_item` holds only the ticks; the *set of items that exists* is this
 * fixed list plus one per Teaching Team member of the Group, assembled here. Shared beneath
 * the three modules that need it — the detail read, the directory count and the toggle write —
 * the way `./group-rules.ts` is shared, and not on the package's public surface for the same
 * reason: no screen renders these constants, only the payloads built from them.
 */

/**
 * One member of the Group whose per-teacher box is derived. Ordered **by name**, matching the
 * Group the detail screen renders directly above the checklist — `perjadinDetail` orders that list
 * `asc(role), asc(fullName)`, so among the Teaching Team members the order is name-ascending, and
 * this reproduces it so the two lists on one page agree.
 */
export type PreparationTeacher = {
  personId: string;
  fullName: string;
};

/** One derived checklist item, in render order: the six fixed items, then one per teacher. */
export type PreparationItem = {
  itemKey: string;
  /** The Indonesian label. Fixed for the six; `Konfirmasi dengan {live name}` for a teacher. */
  label: string;
  checked: boolean;
  /** Who last ticked it, and when — recorded for later use; nothing renders these yet. */
  checkedBy: string | null;
  checkedAt: Date | null;
};

/**
 * The six fixed items, in order, with their stable keys. **Written out here, character for
 * character**, the same way the CHECK lists are: these keys are stored in `item_key` and a
 * composed list would drift from the strings the rows already hold. `staff` is a **single** box
 * — "confirmed with the Staff", not one per Staff member — so it is here and never per-person.
 */
export const PREPARATION_FIXED_ITEMS = [
  { itemKey: "sk_perjalanan", label: "SK Perjalanan" },
  { itemKey: "tiket_keberangkatan", label: "Tiket keberangkatan" },
  { itemKey: "tiket_kepulangan", label: "Tiket kepulangan" },
  { itemKey: "booking_penginapan", label: "Booking penginapan" },
  { itemKey: "transportasi_lokal", label: "Konfirmasi dengan pihak transportasi lokal" },
  { itemKey: "staff", label: "Konfirmasi dengan para staff" },
] as const;

/** The fixed keys alone, for the directory query's "these are always live" test. */
export const PREPARATION_FIXED_KEYS = PREPARATION_FIXED_ITEMS.map((item) => item.itemKey);

/**
 * A per-teacher item's key — glued to the Person by their id, never their name. `dosen:{personId}`
 * so a rename never disturbs the box and a dropped teacher's tick is an orphan the derivation
 * skips rather than a stale label.
 */
export function teacherItemKey(personId: string): string {
  return `dosen:${personId}`;
}

/** Where the ticked rows land, so `checked`/`checkedBy`/`checkedAt` fill in per item. */
export type PreparationTick = {
  itemKey: string;
  checkedBy: string;
  checkedAt: Date;
};

/**
 * The derived checklist for one Perjadin: the six fixed items, then one per Teaching Team member
 * of the Group, each carrying its current tick state. Teachers are ordered by name, matching the
 * Group the detail screen renders above it (see `PreparationTeacher`).
 *
 * `N` is `fixed + teachers.length`; `x` is the number of these that are ticked. A `dosen:` tick
 * for somebody no longer on the Group has no item here, so it never counts — orphans are left in
 * the table and ignored (ADR-0018).
 */
export function derivePreparationChecklist(
  teachers: PreparationTeacher[],
  ticks: PreparationTick[],
): PreparationItem[] {
  const byKey = new Map(ticks.map((tick) => [tick.itemKey, tick]));
  const at = (itemKey: string, label: string): PreparationItem => {
    const tick = byKey.get(itemKey);
    return {
      itemKey,
      label,
      checked: tick !== undefined,
      checkedBy: tick?.checkedBy ?? null,
      checkedAt: tick?.checkedAt ?? null,
    };
  };

  const ordered = [...teachers].sort((a, b) => a.fullName.localeCompare(b.fullName));

  return [
    ...PREPARATION_FIXED_ITEMS.map((item) => at(item.itemKey, item.label)),
    ...ordered.map((teacher) =>
      at(teacherItemKey(teacher.personId), `Konfirmasi dengan ${teacher.fullName}`),
    ),
  ];
}
