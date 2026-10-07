"use server";

import { requirePerson } from "-/lib/person";
import { staffSurface } from "-/lib/staff-surface";
import {
  addPreparationItem,
  clearPreparationItemWording,
  movePreparationItem,
  removePreparationItemAt,
  rewordPreparationItemAt,
  showPreparationItem,
  type AddPreparationItemResult,
  type MovePreparationItemResult,
  type PreparationOverrideScope,
  type PreparationScope,
  type RemovePreparationItemAtResult,
  type RewordPreparationItemAtResult,
} from "@sugt/db/queries";
import { revalidatePath } from "next/cache";

/**
 * **Pengaturan Perjadin's writes** (#422). Each re-checks Administrator in the query layer — the
 * page's own check does not run before a Server Action — and `staffSurface` turns a refusal into the
 * 403. None is written to the Activity Log.
 *
 * A change can alter the checklist on every Perjadin page, `/perjadin`'s pills, `/pendamping` and the
 * Dashboard, so the whole signed-in tree is revalidated rather than this page alone.
 */

async function asAdministrator<T>(
  write: (person: Awaited<ReturnType<typeof requirePerson>>) => Promise<T>,
) {
  const person = await requirePerson();
  const result = await staffSurface(() => write(person));
  revalidatePath("/", "layout");
  return result;
}

/** **Tambah item → Simpan**: the item is created here, at the end of the level's list, and only here. */
export async function addPreparationItemAction(
  at: PreparationScope,
  label: string,
): Promise<AddPreparationItemResult> {
  return asAdministrator((person) => addPreparationItem(person, { scope: at, label }));
}

/** **Ubah → Simpan**: the item's own wording, or this level's override of a wider one. */
export async function rewordPreparationItemAction(
  itemId: string,
  label: string,
  at: PreparationScope,
): Promise<RewordPreparationItemAtResult> {
  return asAdministrator((person) => rewordPreparationItemAt(person, { itemId, label, at }));
}

/** **Kembalikan teks asal**: drop this level's override, so the wider wording shows again. */
export async function clearPreparationItemWordingAction(
  itemId: string,
  scope: PreparationOverrideScope,
): Promise<{ outcome: "cleared" }> {
  return asAdministrator((person) => clearPreparationItemWording(person, { itemId, scope }));
}

/** **Hapus**, after its confirmation: removed if defined at this level, hidden here if wider. */
export async function removePreparationItemAction(
  itemId: string,
  at: PreparationScope,
): Promise<RemovePreparationItemAtResult> {
  return asAdministrator((person) => removePreparationItemAt(person, { itemId, at }));
}

/** **Tampilkan lagi**: end this level's hide. */
export async function showPreparationItemAction(
  itemId: string,
  scope: PreparationOverrideScope,
): Promise<{ outcome: "shown" }> {
  return asAdministrator((person) => showPreparationItem(person, { itemId, scope }));
}

/** **Up / down** among the level's own items. Applies at once. */
export async function movePreparationItemAction(
  itemId: string,
  direction: "up" | "down",
): Promise<MovePreparationItemResult> {
  return asAdministrator((person) => movePreparationItem(person, { itemId, direction }));
}
