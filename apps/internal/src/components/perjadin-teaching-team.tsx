"use client";

import {
  addPerjadinTeacherAction,
  removePerjadinTeacherAction,
  renamePerjadinTeacherAction,
} from "-/app/(app)/perjadin/[id]/actions";
import { MAX_TEACHING_TEAM_PER_PERJADIN } from "@sugt/domain";
import { Button } from "@sugt/ui/components/button";
import { Input } from "@sugt/ui/components/input";
import { XIcon } from "lucide-react";
import { useId, useState, useTransition } from "react";

/**
 * A Perjadin's Teaching Team as trip-scoped names (ADR-0020), edited one at a time — added, renamed
 * and removed. Each write clears the "Pengajar sudah lengkap" Preparation tick, so the team's
 * completeness must be re-confirmed by hand after any change (the amendment to ADR-0018).
 *
 * Read-only for a professor; the controls appear only for Staff, whom the write re-checks.
 */
function PerjadinTeachingTeam({
  perjadinId,
  teachers,
  canEdit,
}: {
  perjadinId: string;
  teachers: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const addFieldId = useId();

  const atCap = teachers.length >= MAX_TEACHING_TEAM_PER_PERJADIN;

  function add() {
    const name = draft.trim();
    if (name === "" || atCap) return;
    startBusy(async () => {
      const result = await addPerjadinTeacherAction(perjadinId, name);
      if (result.outcome === "added") {
        setDraft("");
        setRefusal(null);
        return;
      }
      setRefusal(ADD_REFUSALS[result.outcome]);
    });
  }

  function rename(teacherId: string) {
    const name = editDraft.trim();
    if (name === "") return;
    startBusy(async () => {
      const result = await renamePerjadinTeacherAction(perjadinId, teacherId, name);
      if (result.outcome === "renamed") {
        setEditingId(null);
        setRefusal(null);
        return;
      }
      setRefusal(GONE);
    });
  }

  function remove(teacherId: string) {
    startBusy(async () => {
      const result = await removePerjadinTeacherAction(perjadinId, teacherId);
      if (result.outcome !== "removed") setRefusal(GONE);
    });
  }

  return (
    <div className="border-b border-border px-7 py-5">
      <h2 className="font-heading text-sm font-medium">Teaching Team</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Nama pengajar untuk Perjadin ini. Mengubah daftar ini menghapus centang “Pengajar sudah
        lengkap”.
      </p>

      {refusal !== null && <p className="mt-2 text-sm text-destructive">{refusal}</p>}

      {teachers.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {teachers.map((teacher) => (
            <li
              key={teacher.id}
              className="flex flex-wrap items-center gap-2"
            >
              {editingId === teacher.id ? (
                <>
                  <Input
                    aria-label={`Ubah nama ${teacher.name}`}
                    className="w-56"
                    value={editDraft}
                    disabled={busy}
                    onChange={(event) => {
                      setEditDraft(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        rename(teacher.id);
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={busy || editDraft.trim() === ""}
                    onClick={() => {
                      rename(teacher.id);
                    }}
                  >
                    Simpan
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(null);
                    }}
                  >
                    Batal
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-foreground">{teacher.name}</span>
                  {canEdit && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(teacher.id);
                          setEditDraft(teacher.name);
                          setRefusal(null);
                        }}
                      >
                        Ubah
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Hapus ${teacher.name}`}
                        disabled={busy}
                        onClick={() => {
                          remove(teacher.id);
                        }}
                      >
                        <XIcon className="size-4" />
                      </Button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="mt-3 flex max-w-md gap-2">
          <Input
            id={addFieldId}
            aria-label="Nama pengajar"
            placeholder="Nama pengajar"
            value={draft}
            disabled={busy || atCap}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy || atCap || draft.trim() === ""}
            onClick={add}
          >
            Tambah pengajar
          </Button>
        </div>
      )}
    </div>
  );
}

const GONE = "Perubahan gagal. Muat ulang halaman untuk melihat keadaannya.";

const ADD_REFUSALS = {
  "name-required": "Nama pengajar tidak boleh kosong.",
  "too-many-teachers": `Nama pengajar terlalu banyak: maksimal ${MAX_TEACHING_TEAM_PER_PERJADIN}.`,
  "no-such-perjadin": GONE,
} as const;

export { PerjadinTeachingTeam };
