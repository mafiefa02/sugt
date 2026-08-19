import { db, schema } from "@sugt/db";
import {
  isNotStaffError,
  perjadinDetail,
  perjadinDirectory,
  replacePerjadinGroup,
  togglePreparationItem,
} from "@sugt/db/queries";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { addPerjadin, addPerson, resetDatabase } from "./support/fixtures";

/**
 * **The Preparation Checklist** ([#114](https://github.com/mafiefa02/sugt/issues/114)).
 *
 * The substance is that the *set of items* is derived and never stored: the six fixed boxes plus
 * one per Teaching Team member, assembled at read time from the fixed list and the current Group.
 * Only the ticks are stored, so the interesting behaviour is what the derivation does when the
 * Group moves under a tick — a name change, a dropped teacher, a re-added one — and none of that
 * is reachable through a test that only reads back what it wrote. Each block drives the query
 * functions against a real Postgres.
 */

async function trip() {
  const pic = await addPerson({
    fullName: "Rina Nurhayati",
    email: "rina@ditsama.itb.ac.id",
    role: "Staff",
  });
  const bagus = await addPerson({
    fullName: "Bagus Prakoso",
    email: "bagus@itb.ac.id",
    role: "Teaching Team",
  });
  const sari = await addPerson({
    fullName: "Sari Dewi",
    email: "sari@itb.ac.id",
    role: "Teaching Team",
  });
  const perjadin = await addPerjadin({
    advanceIdr: 5_000_000,
    picPersonId: pic.id,
    teachers: [
      { personId: bagus.id, stream: "STEM" },
      { personId: sari.id, stream: "Research" },
    ],
  });
  return { pic, bagus, sari, perjadinId: perjadin.id };
}

/** The stored ticks for one Perjadin, straight from the table — orphans included. */
async function ticksOf(perjadinId: string) {
  return db
    .select({
      itemKey: schema.perjadinPreparationItem.itemKey,
      checkedBy: schema.perjadinPreparationItem.checkedBy,
      checkedAt: schema.perjadinPreparationItem.checkedAt,
    })
    .from(schema.perjadinPreparationItem)
    .where(eq(schema.perjadinPreparationItem.perjadinId, perjadinId));
}

async function pillOf(caller: Parameters<typeof perjadinDirectory>[0], perjadinId: string) {
  const trips = await perjadinDirectory(caller);
  return trips.find((row) => row.id === perjadinId);
}

const FIXED_KEYS = [
  "sk_perjalanan",
  "tiket_keberangkatan",
  "tiket_kepulangan",
  "booking_penginapan",
  "transportasi_lokal",
  "staff",
];

describe("the derived checklist", () => {
  beforeEach(resetDatabase);

  it("is the six fixed items then one per Teaching Team member, none ticked at first", async () => {
    const { pic, bagus, sari, perjadinId } = await trip();

    const detail = await perjadinDetail(pic, perjadinId);
    const items = detail?.preparation ?? [];

    // The fixed six first, in order, and `staff` is a single box — not one per Staff member.
    expect(items.slice(0, 6).map((item) => item.itemKey)).toEqual(FIXED_KEYS);
    // Then one per teacher, glued to the Person and labelled with their live name.
    expect(items.slice(6).map((item) => item.itemKey)).toEqual([
      `dosen:${bagus.id}`,
      `dosen:${sari.id}`,
    ]);
    expect(items.find((item) => item.itemKey === `dosen:${bagus.id}`)?.label).toBe(
      "Konfirmasi dengan Bagus Prakoso",
    );
    // N = 6 + teacher count, and nothing is ticked until someone ticks it.
    expect(items).toHaveLength(8);
    expect(items.every((item) => !item.checked)).toBe(true);
  });

  it("grows N by one when the Group gains a teacher, and derives it rather than storing it", async () => {
    const { pic, bagus, sari, perjadinId } = await trip();
    const rian = await addPerson({
      fullName: "Rian Saputra",
      email: "rian@itb.ac.id",
      role: "Teaching Team",
    });

    expect((await perjadinDetail(pic, perjadinId))?.preparation).toHaveLength(8);
    expect((await pillOf(pic, perjadinId))?.preparationTotal).toBe(8);

    await replacePerjadinGroup(pic, perjadinId, [
      { personId: bagus.id, stream: "STEM" },
      { personId: rian.id, stream: "STEM" },
      { personId: sari.id, stream: "Research" },
    ]);

    // No prep row was written or moved — N changed purely because the Group did.
    expect(await ticksOf(perjadinId)).toEqual([]);
    expect((await perjadinDetail(pic, perjadinId))?.preparation).toHaveLength(9);
    expect((await pillOf(pic, perjadinId))?.preparationTotal).toBe(9);
  });

  it("orders the per-teacher boxes by name, matching the Group list on the same screen", async () => {
    const pic = await addPerson({
      fullName: "Rina Nurhayati",
      email: "rina@ditsama.itb.ac.id",
      role: "Staff",
    });
    // Names deliberately in the opposite order to the Streams: the STEM teacher sorts last by name,
    // the Research teacher first. Stream-primary ordering would put STEM ("Zulaikha") first; the
    // checklist must instead follow the Group list, which is name-ascending.
    const zulaikha = await addPerson({
      fullName: "Zulaikha Rahmawati",
      email: "zulaikha@itb.ac.id",
      role: "Teaching Team",
    });
    const andi = await addPerson({
      fullName: "Andi Pratama",
      email: "andi@itb.ac.id",
      role: "Teaching Team",
    });
    const perjadin = await addPerjadin({
      advanceIdr: 5_000_000,
      picPersonId: pic.id,
      teachers: [
        { personId: zulaikha.id, stream: "STEM" },
        { personId: andi.id, stream: "Research" },
      ],
    });

    const detail = await perjadinDetail(pic, perjadin.id);
    // Andi (Research) before Zulaikha (STEM): name order, not Stream order.
    expect(detail?.preparation.slice(6).map((item) => item.itemKey)).toEqual([
      `dosen:${andi.id}`,
      `dosen:${zulaikha.id}`,
    ]);
    // And it is the very order the Group list shows its Teaching Team members in.
    expect(
      detail?.group.filter((member) => member.stream !== null).map((member) => member.personId),
    ).toEqual([andi.id, zulaikha.id]);
  });

  it("keeps a per-teacher tick with its Person, and re-labels it live when the name changes", async () => {
    const { pic, bagus, perjadinId } = await trip();

    await togglePreparationItem(pic, {
      perjadinId,
      itemKey: `dosen:${bagus.id}`,
      checked: true,
    });
    await db
      .update(schema.person)
      .set({ fullName: "Bagus Prakoso Wijaya" })
      .where(eq(schema.person.id, bagus.id));

    const box = (await perjadinDetail(pic, perjadinId))?.preparation.find(
      (item) => item.itemKey === `dosen:${bagus.id}`,
    );
    // Same key, still ticked, and the label follows the current name — the name is never stored.
    expect(box?.checked).toBe(true);
    expect(box?.label).toBe("Konfirmasi dengan Bagus Prakoso Wijaya");
  });
});

describe("orphaned per-teacher ticks", () => {
  beforeEach(resetDatabase);

  it("drops a ticked teacher from x and N without deleting the row, and restores it on re-add", async () => {
    const { pic, bagus, sari, perjadinId } = await trip();
    const rian = await addPerson({
      fullName: "Rian Saputra",
      email: "rian@itb.ac.id",
      role: "Teaching Team",
    });
    await togglePreparationItem(pic, { perjadinId, itemKey: `dosen:${sari.id}`, checked: true });

    // Substitute Sari out for Rian. Her tick is now an orphan.
    await replacePerjadinGroup(pic, perjadinId, [
      { personId: bagus.id, stream: "STEM" },
      { personId: rian.id, stream: "Research" },
    ]);

    const detail = await perjadinDetail(pic, perjadinId);
    // The derivation drops the orphan: no box for Sari, N is back to 8, and x counts nothing.
    expect(detail?.preparation.some((item) => item.itemKey === `dosen:${sari.id}`)).toBe(false);
    expect(detail?.preparation).toHaveLength(8);
    expect(detail?.preparation.filter((item) => item.checked)).toHaveLength(0);
    expect((await pillOf(pic, perjadinId))?.preparationDone).toBe(0);
    expect((await pillOf(pic, perjadinId))?.preparationTotal).toBe(8);
    // But the row is left in place — `replacePerjadinGroup` never touches it.
    expect((await ticksOf(perjadinId)).map((tick) => tick.itemKey)).toEqual([`dosen:${sari.id}`]);

    // Re-adding Sari brings her old tick back, because it was never deleted.
    await replacePerjadinGroup(pic, perjadinId, [
      { personId: bagus.id, stream: "STEM" },
      { personId: sari.id, stream: "Research" },
    ]);
    const restored = (await perjadinDetail(pic, perjadinId))?.preparation.find(
      (item) => item.itemKey === `dosen:${sari.id}`,
    );
    expect(restored?.checked).toBe(true);
    expect((await pillOf(pic, perjadinId))?.preparationDone).toBe(1);
  });

  it("counts every fixed tick in the pill, since a fixed item is always live", async () => {
    const { pic, perjadinId } = await trip();

    await togglePreparationItem(pic, { perjadinId, itemKey: "staff", checked: true });
    await togglePreparationItem(pic, { perjadinId, itemKey: "sk_perjalanan", checked: true });

    const pill = await pillOf(pic, perjadinId);
    expect(pill?.preparationDone).toBe(2);
    expect(pill?.preparationTotal).toBe(8);
  });
});

describe("toggling a box", () => {
  beforeEach(resetDatabase);

  it("writes a row with checkedBy and checkedAt on tick, and deletes it on un-tick", async () => {
    const { pic, perjadinId } = await trip();

    await togglePreparationItem(pic, { perjadinId, itemKey: "staff", checked: true });
    const [row] = await ticksOf(perjadinId);
    expect(row?.itemKey).toBe("staff");
    expect(row?.checkedBy).toBe(pic.id);
    expect(row?.checkedAt).not.toBeNull();

    await togglePreparationItem(pic, { perjadinId, itemKey: "staff", checked: false });
    expect(await ticksOf(perjadinId)).toEqual([]);
  });

  it("is idempotent both ways — a second tick is one row, a second un-tick is a no-op", async () => {
    const { pic, perjadinId } = await trip();

    await togglePreparationItem(pic, { perjadinId, itemKey: "booking_penginapan", checked: true });
    await togglePreparationItem(pic, { perjadinId, itemKey: "booking_penginapan", checked: true });
    // The composite primary key upserts, so ticking twice is one row rather than a key violation.
    expect(await ticksOf(perjadinId)).toHaveLength(1);

    await togglePreparationItem(pic, { perjadinId, itemKey: "booking_penginapan", checked: false });
    await togglePreparationItem(pic, { perjadinId, itemKey: "booking_penginapan", checked: false });
    expect(await ticksOf(perjadinId)).toEqual([]);
  });

  it("records the Staff member who most recently ticked it", async () => {
    const { pic, perjadinId } = await trip();
    const other = await addPerson({
      fullName: "Dewi Lestari",
      email: "dewi@ditsama.itb.ac.id",
      role: "Staff",
    });

    await togglePreparationItem(pic, { perjadinId, itemKey: "staff", checked: true });
    await togglePreparationItem(other, { perjadinId, itemKey: "staff", checked: true });

    const [row] = await ticksOf(perjadinId);
    expect(row?.checkedBy).toBe(other.id);
  });

  it("refuses a Teaching Team caller", async () => {
    const { bagus, perjadinId } = await trip();

    await expect(
      togglePreparationItem(bagus, { perjadinId, itemKey: "staff", checked: true }),
    ).rejects.toSatisfy(isNotStaffError);
    // And nothing was written, so the refusal is before the row, not after.
    expect(await ticksOf(perjadinId)).toEqual([]);
  });
});
