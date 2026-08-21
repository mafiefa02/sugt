"use client";

import {
  createSubClusterAction,
  deleteSubClusterAction,
  moveSchoolAction,
  renameSubClusterAction,
} from "-/app/(app)/kelompok-sekolah/actions";
import { shortenKabupaten } from "-/lib/format-destination";
import type {
  BlockingPerjadin,
  ClusterWithSubClusters,
  SubClusterWithSchools,
} from "@sugt/db/queries";
import { Button } from "@sugt/ui/components/button";
import { Input } from "@sugt/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sugt/ui/components/select";
import { useState, useTransition } from "react";

/**
 * **Kelompok Sekolah** — the Sub-Cluster editing screen.
 *
 * A `"use client"` tree that imports the four Server Actions directly. Every refusal comes back
 * as a discriminated value and is placed beside the control that raised it, never thrown to a
 * boundary — the same house style as Orang. The controls render only when `canWrite`; the
 * enforcement is `requireStaff` inside each write, so hiding them is a courtesy.
 */
function KelompokSekolahEditor({
  clusters,
  canWrite,
}: {
  clusters: ClusterWithSubClusters[];
  canWrite: boolean;
}) {
  return (
    <div className="flex min-h-full flex-col gap-8 p-7">
      {clusters.map((cluster) => (
        <ClusterSection
          key={cluster.id}
          cluster={cluster}
          canWrite={canWrite}
        />
      ))}
    </div>
  );
}

function ClusterSection({
  cluster,
  canWrite,
}: {
  cluster: ClusterWithSubClusters;
  canWrite: boolean;
}) {
  return (
    <section>
      <h2 className="font-heading text-base font-medium">{cluster.name}</h2>

      <div className="mt-3 flex flex-col gap-3">
        {cluster.subClusters.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Belum ada Kelompok Sekolah di Cluster ini.
          </p>
        )}
        {cluster.subClusters.map((subCluster) => (
          <SubClusterCard
            key={subCluster.id}
            subCluster={subCluster}
            siblings={cluster.subClusters.filter((other) => other.id !== subCluster.id)}
            canWrite={canWrite}
          />
        ))}
      </div>

      {canWrite && <CreateSubClusterForm clusterId={cluster.id} />}
    </section>
  );
}

function CreateSubClusterForm({ clusterId }: { clusterId: string }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const canSubmit = name.trim() !== "";

  function submit() {
    if (!canSubmit) return;
    startSaving(async () => {
      const result = await createSubClusterAction({ clusterId, name });
      if (result.outcome === "created") {
        setName("");
        setError(null);
        return;
      }
      setError(CREATE_MESSAGES[result.outcome]);
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2.5">
      <Input
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setError(null);
        }}
        placeholder="Nama Kelompok Sekolah baru"
        aria-label={`Nama Kelompok Sekolah baru di ${clusterId}`}
        className="h-8 w-full max-w-64"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={saving || !canSubmit}
        onClick={submit}
      >
        {saving ? "Menambah…" : "Tambah Kelompok"}
      </Button>
      {error !== null && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function SubClusterCard({
  subCluster,
  siblings,
  canWrite,
}: {
  subCluster: SubClusterWithSchools;
  siblings: SubClusterWithSchools[];
  canWrite: boolean;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <SubClusterName
          subCluster={subCluster}
          canWrite={canWrite}
        />
        {canWrite && <DeleteSubClusterButton subCluster={subCluster} />}
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {subCluster.schools.length === 0 && (
          <li className="text-sm text-muted-foreground">Belum ada Sekolah.</li>
        )}
        {subCluster.schools.map((school) => (
          <SchoolRow
            key={school.id}
            school={school}
            siblings={siblings}
            canWrite={canWrite}
          />
        ))}
      </ul>
    </div>
  );
}

function SubClusterName({
  subCluster,
  canWrite,
}: {
  subCluster: SubClusterWithSchools;
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(subCluster.name);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  if (!canWrite || !editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-medium">{subCluster.name}</span>
        {canWrite && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            onClick={() => {
              setName(subCluster.name);
              setError(null);
              setEditing(true);
            }}
          >
            Ganti nama
          </button>
        )}
      </div>
    );
  }

  function save() {
    if (name.trim() === "") {
      setError(RENAME_MESSAGES.incomplete);
      return;
    }
    startSaving(async () => {
      const result = await renameSubClusterAction(subCluster.id, name);
      if (result.outcome === "renamed") {
        setEditing(false);
        setError(null);
        return;
      }
      setError(RENAME_MESSAGES[result.outcome]);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setError(null);
        }}
        aria-label={`Nama baru untuk ${subCluster.name}`}
        className="h-8 w-full max-w-56"
      />
      <Button
        size="sm"
        disabled={saving}
        onClick={save}
      >
        {saving ? "Menyimpan…" : "Simpan"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={saving}
        onClick={() => {
          setEditing(false);
          setError(null);
        }}
      >
        Batal
      </Button>
      {error !== null && <p className="w-full text-sm text-destructive">{error}</p>}
    </div>
  );
}

function DeleteSubClusterButton({ subCluster }: { subCluster: SubClusterWithSchools }) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function remove() {
    startSaving(async () => {
      const result = await deleteSubClusterAction(subCluster.id);
      // "deleted" needs no message — the row leaves on revalidate.
      if (result.outcome !== "deleted") setMessage(DELETE_MESSAGES[result.outcome]);
    });
  }

  if (!confirming) {
    return (
      <div className="flex flex-col items-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setMessage(null);
            setConfirming(true);
          }}
        >
          Hapus
        </Button>
        {message !== null && <p className="mt-1 text-xs text-destructive">{message}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Yakin?</span>
      <Button
        variant="destructive"
        size="sm"
        disabled={saving}
        onClick={remove}
      >
        {saving ? "Menghapus…" : "Hapus"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={saving}
        onClick={() => {
          setConfirming(false);
        }}
      >
        Batal
      </Button>
    </div>
  );
}

function SchoolRow({
  school,
  siblings,
  canWrite,
}: {
  school: { id: string; name: string };
  siblings: SubClusterWithSchools[];
  canWrite: boolean;
}) {
  const [blocking, setBlocking] = useState<BlockingPerjadin[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function move(toSubClusterId: string) {
    startSaving(async () => {
      setBlocking(null);
      setMessage(null);
      const result = await moveSchoolAction(school.id, toSubClusterId);
      if (result.outcome === "moved") return;
      if (result.outcome === "still-visited") {
        setBlocking(result.perjadins);
        return;
      }
      setMessage(MOVE_MESSAGES[result.outcome]);
    });
  }

  return (
    <li className="flex flex-col gap-1 border-t border-border/60 py-1.5 first:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">{school.name}</span>
        {canWrite && siblings.length > 0 && (
          <Select
            items={Object.fromEntries(siblings.map((sibling) => [sibling.id, sibling.name]))}
            value={null}
            onValueChange={(selected) => {
              if (selected !== null && !saving) move(selected as string);
            }}
          >
            <SelectTrigger
              size="sm"
              aria-label={`Pindahkan ${school.name}`}
            >
              <SelectValue placeholder={saving ? "Memindahkan…" : "Pindahkan ke…"} />
            </SelectTrigger>
            <SelectContent>
              {siblings.map((sibling) => (
                <SelectItem
                  key={sibling.id}
                  value={sibling.id}
                >
                  {sibling.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {message !== null && <p className="text-xs text-destructive">{message}</p>}
      {blocking !== null && (
        <div className="text-xs text-destructive">
          <p>
            Belum bisa dipindahkan — masih ada Perjadin yang akan mengunjungi Sekolah ini.
            Rencanakan ulang atau batalkan dulu:
          </p>
          <ul className="mt-1 list-disc pl-4">
            {blocking.map((perjadin) => (
              <li key={perjadin.id}>
                {shortenKabupaten(perjadin.destination)} ({perjadin.startsOn} – {perjadin.endsOn})
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

const CREATE_MESSAGES = {
  incomplete: "Nama wajib diisi.",
  "no-such-cluster": "Cluster itu tidak ditemukan. Muat ulang halaman.",
} as const;

const RENAME_MESSAGES = {
  incomplete: "Nama wajib diisi.",
  "no-such-sub-cluster": "Kelompok itu sudah tidak ada. Muat ulang halaman.",
} as const;

const DELETE_MESSAGES = {
  "has-schools": "Masih ada Sekolah di dalamnya — pindahkan dulu semuanya, baru bisa dihapus.",
  "planned-against":
    "Ada Perjadin yang pernah direncanakan ke Kelompok ini. Kelompok yang sudah dikunjungi tidak bisa dihapus.",
  "no-such-sub-cluster": "Kelompok itu sudah tidak ada. Muat ulang halaman.",
} as const;

const MOVE_MESSAGES = {
  "no-such-school": "Sekolah itu sudah tidak ada. Muat ulang halaman.",
  "no-such-target": "Kelompok tujuan sudah tidak ada. Muat ulang halaman.",
  "different-cluster": "Sekolah hanya bisa dipindahkan ke Kelompok dalam Cluster yang sama.",
} as const;

export { KelompokSekolahEditor };
