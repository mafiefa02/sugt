"use server";

import { requirePerson } from "-/lib/person";
import { staffSurface } from "-/lib/staff-surface";
import {
  createSubCluster,
  deleteSubCluster,
  moveSchool,
  renameSubCluster,
  type CreateSubClusterResult,
  type DeleteSubClusterResult,
  type MoveSchoolResult,
  type NewSubCluster,
  type RenameSubClusterResult,
} from "@sugt/db/queries";
import { revalidatePath } from "next/cache";

/**
 * **Kelompok Sekolah's four writes** — create, rename and delete a Sub-Cluster, and move a
 * School between them. All Staff-only, all the same shape: resolve the Person, hand it to
 * `@sugt/db` through `staffSurface`, return what came back.
 *
 * `staffSurface` turns a Teaching Team caller's `NotStaffError` into a 403 rather than a crash —
 * the enforcement is `requireStaff` inside each write, because a Next.js layout does not run
 * before a Server Action, so hiding the nav entry is not access control. Every other refusal is
 * a discriminated value the screen places beside the control that raised it.
 *
 * `revalidatePath` clears the router cache for the screen the user is looking at, only on the
 * outcome that changed it.
 */

export async function createSubClusterAction(
  input: NewSubCluster,
): Promise<CreateSubClusterResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => createSubCluster(person, input));
  if (result.outcome === "created") revalidatePath("/kelompok-sekolah");
  return result;
}

export async function renameSubClusterAction(
  subClusterId: string,
  name: string,
): Promise<RenameSubClusterResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => renameSubCluster(person, subClusterId, name));
  if (result.outcome === "renamed") revalidatePath("/kelompok-sekolah");
  return result;
}

export async function deleteSubClusterAction(
  subClusterId: string,
): Promise<DeleteSubClusterResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => deleteSubCluster(person, subClusterId));
  if (result.outcome === "deleted") revalidatePath("/kelompok-sekolah");
  return result;
}

export async function moveSchoolAction(
  schoolId: string,
  toSubClusterId: string,
): Promise<MoveSchoolResult> {
  const person = await requirePerson();

  const result = await staffSurface(() => moveSchool(person, schoolId, toSubClusterId));
  if (result.outcome === "moved") revalidatePath("/kelompok-sekolah");
  return result;
}
