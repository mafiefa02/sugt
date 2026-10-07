"use client";

import {
  addPreparationItemAction,
  clearPreparationItemWordingAction,
  movePreparationItemAction,
  removePreparationItemAction,
  rewordPreparationItemAction,
  showPreparationItemAction,
} from "-/app/(app)/perjadin/pengaturan/actions";
import { levelHref, scopeOf, type LevelChoice } from "-/app/(app)/perjadin/pengaturan/level-params";
import type {
  PreparationOverrideScope,
  PreparationScope,
  PreparationSettings,
  PreparationSettingsItem,
} from "@sugt/db/queries";
import { MAX_PREPARATION_ITEM_LABEL_LENGTH, type PreparationItemLevel } from "@sugt/domain";
import { Badge } from "@sugt/ui/components/badge";
import { Button } from "@sugt/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@sugt/ui/components/dialog";
import { Input } from "@sugt/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sugt/ui/components/select";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { SingleSelectCombobox, type SingleSelectOption } from "./single-select-combobox";

/**
 * **Pengaturan Perjadin's editor** (#422): pick a level, then change its Preparation Checklist.
 *
 * The level lives in the URL (`levelHref`), so choosing one navigates and the page re-reads it. Each
 * write is a Server Action addressed to the level on screen; the query layer decides whether that
 * means changing the item itself or overriding a wider one there, and applies ADR-0045's dates.
 *
 * **Nothing is added until Simpan.** Tambah item only opens an empty row; Batal discards it. Hapus
 * always asks first, saying how many unfinished Perjadins the item leaves. Up and down apply at once.
 */
function PreparationSettingsEditor({
  choice,
  clusters,
  perjadins,
  settings,
}: {
  choice: LevelChoice;
  clusters: { id: string; name: string }[];
  perjadins: SingleSelectOption[];
  settings: PreparationSettings | null;
}) {
  const router = useRouter();
  const [navigating, startNavigating] = useTransition();
  const scope = scopeOf(choice);

  function go(next: LevelChoice) {
    startNavigating(() => {
      router.push(levelHref(next) as Route);
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5 px-4 py-6 sm:px-7">
      <div className="flex flex-col gap-3">
        <div
          role="group"
          aria-label="Tingkat"
          className="flex flex-wrap gap-1"
        >
          {LEVELS.map((level) => (
            <Button
              key={level.value}
              size="sm"
              variant={choice.level === level.value ? "default" : "outline"}
              aria-pressed={choice.level === level.value}
              disabled={navigating}
              onClick={() => {
                if (level.value === "semua") go({ level: "semua" });
                else if (level.value === "cluster") go({ level: "cluster", clusterId: null });
                else go({ level: "perjadin", perjadinId: null });
              }}
            >
              {level.label}
            </Button>
          ))}
        </div>

        {choice.level === "cluster" && clusters.length > 0 && (
          <Select
            items={Object.fromEntries(clusters.map((row) => [row.id, row.name]))}
            value={choice.clusterId}
            onValueChange={(clusterId) => {
              if (typeof clusterId === "string") go({ level: "cluster", clusterId });
            }}
          >
            <SelectTrigger
              className="w-full sm:w-80"
              aria-label="Cluster"
            >
              <SelectValue placeholder="Pilih Cluster" />
            </SelectTrigger>
            <SelectContent>
              {clusters.map((row) => (
                <SelectItem
                  key={row.id}
                  value={row.id}
                >
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {choice.level === "perjadin" && (
          <div className="w-full sm:max-w-md">
            <SingleSelectCombobox
              options={perjadins}
              value={choice.perjadinId}
              onValueChange={(perjadinId) => {
                go({ level: "perjadin", perjadinId });
              }}
              placeholder="Cari Perjadin…"
              aria-label="Perjadin"
              emptyLabel="Tidak ada Perjadin yang cocok."
            />
          </div>
        )}
      </div>

      {scope === null ? (
        <p className="text-sm text-muted-foreground">
          {choice.level === "cluster"
            ? "Belum ada Cluster."
            : "Pilih Perjadin untuk melihat dan mengubah daftar Persiapannya."}
        </p>
      ) : settings === null ? (
        <p className="text-sm text-muted-foreground">
          Perjadin ini tidak ditemukan. Pilih Perjadin lain.
        </p>
      ) : (
        <LevelChecklist
          // A new level starts with nothing open: no row being edited, no draft, no refusal.
          key={levelHref(choice)}
          scope={scope}
          settings={settings}
        />
      )}
    </div>
  );
}

const LEVELS: { value: PreparationItemLevel; label: string }[] = [
  { value: "semua", label: "Semua Perjadin" },
  { value: "cluster", label: "Cluster" },
  { value: "perjadin", label: "Perjadin" },
];

/** A level as the scope its hides and wordings are written in; Semua has none. */
function overrideScopeOf(scope: PreparationScope): PreparationOverrideScope | null {
  if (scope.level === "cluster") return { clusterId: scope.clusterId };
  if (scope.level === "perjadin") return { perjadinId: scope.perjadinId };
  return null;
}

/** One level's list, its hidden items, and every change made to them. */
function LevelChecklist({
  scope,
  settings,
}: {
  scope: PreparationScope;
  settings: PreparationSettings;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState("");
  const [confirming, setConfirming] = useState<PreparationSettingsItem | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const override = overrideScopeOf(scope);
  const ownIds = settings.items.filter((item) => item.own).map((item) => item.itemId);

  function tagOf(level: PreparationItemLevel): string {
    if (level === "semua") return "Semua";
    if (level === "cluster") return settings.clusterName ?? "Cluster";
    return "Perjadin ini";
  }

  /** Run a write; on a refusal show its sentence, otherwise run `done`. */
  function write<T extends { outcome: string }>(
    call: () => Promise<T>,
    succeeded: T["outcome"][],
    done?: () => void,
  ) {
    setRefusal(null);
    startBusy(async () => {
      const result = await call();
      if (succeeded.includes(result.outcome)) {
        done?.();
        return;
      }
      setRefusal(refusalText(result.outcome));
    });
  }

  function add() {
    write(
      () => addPreparationItemAction(scope, addDraft),
      ["added"],
      () => {
        setAdding(false);
        setAddDraft("");
      },
    );
  }

  function reword(itemId: string) {
    write(
      () => rewordPreparationItemAction(itemId, editDraft, scope),
      ["reworded"],
      () => {
        setEditingId(null);
      },
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{levelSummary(scope, settings)}</p>

      {refusal !== null && <p className="text-sm text-destructive">{refusal}</p>}

      <ol className="divide-y divide-border rounded-lg border border-border">
        {settings.items.map((item) => {
          const ownIndex = ownIds.indexOf(item.itemId);
          return (
            <li
              key={item.itemId}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between"
            >
              {editingId === item.itemId ? (
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    aria-label={`Ubah teks ${item.label}`}
                    className="sm:flex-1"
                    value={editDraft}
                    maxLength={MAX_PREPARATION_ITEM_LABEL_LENGTH}
                    disabled={busy}
                    onChange={(event) => {
                      setEditDraft(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        reword(item.itemId);
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy || editDraft.trim() === ""}
                      onClick={() => {
                        reword(item.itemId);
                      }}
                    >
                      Simpan
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setEditingId(null);
                        setRefusal(null);
                      }}
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-sm break-words">{item.label}</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">{tagOf(item.level)}</Badge>
                      {item.overriddenLabel !== null && (
                        <Badge variant="outline">Diubah di sini</Badge>
                      )}
                    </div>
                    {item.overriddenLabel !== null && (
                      <p className="text-xs break-words text-muted-foreground">
                        Teks asal: {item.overriddenLabel}
                      </p>
                    )}
                    {item.system && (
                      <p className="text-xs text-muted-foreground">
                        Tidak bisa dihapus: centangnya dilepas otomatis, dan harus dicentang ulang,
                        bila daftar Narasumber berubah.
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setEditingId(item.itemId);
                        setEditDraft(item.label);
                        setAdding(false);
                        setRefusal(null);
                      }}
                    >
                      <Pencil data-icon="inline-start" />
                      Ubah
                    </Button>
                    {item.overriddenLabel !== null && override !== null && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          write(
                            () => clearPreparationItemWordingAction(item.itemId, override),
                            ["cleared"],
                          );
                        }}
                      >
                        Kembalikan teks asal
                      </Button>
                    )}
                    {!item.system && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={busy}
                        onClick={() => {
                          setConfirming(item);
                          setRefusal(null);
                        }}
                      >
                        <Trash2 data-icon="inline-start" />
                        Hapus
                      </Button>
                    )}
                    {item.own && (
                      <>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Naikkan ${item.label}`}
                          disabled={busy || ownIndex === 0}
                          onClick={() => {
                            write(
                              () => movePreparationItemAction(item.itemId, "up"),
                              ["moved", "at-end"],
                            );
                          }}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Turunkan ${item.label}`}
                          disabled={busy || ownIndex === ownIds.length - 1}
                          onClick={() => {
                            write(
                              () => movePreparationItemAction(item.itemId, "down"),
                              ["moved", "at-end"],
                            );
                          }}
                        >
                          <ArrowDown />
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
        {settings.items.length === 0 && (
          <li className="p-3 text-sm text-muted-foreground">Belum ada item.</li>
        )}
      </ol>

      {adding ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            aria-label="Teks item baru"
            placeholder="Teks item baru"
            className="sm:flex-1"
            autoFocus
            value={addDraft}
            maxLength={MAX_PREPARATION_ITEM_LABEL_LENGTH}
            disabled={busy}
            onChange={(event) => {
              setAddDraft(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (addDraft.trim() !== "") add();
              }
            }}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || addDraft.trim() === ""}
              onClick={add}
            >
              Simpan
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setAdding(false);
                setAddDraft("");
                setRefusal(null);
              }}
            >
              Batal
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setAdding(true);
              setEditingId(null);
              setRefusal(null);
            }}
          >
            <Plus data-icon="inline-start" />
            Tambah item
          </Button>
        </div>
      )}

      {settings.hidden.length > 0 && override !== null && (
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-sm font-medium">Disembunyikan di sini</h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {settings.hidden.map((item) => (
              <li
                key={item.itemId}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-sm break-words text-muted-foreground">{item.label}</span>
                  <div>
                    <Badge variant="secondary">{tagOf(item.level)}</Badge>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="self-start sm:self-auto"
                  disabled={busy}
                  onClick={() => {
                    write(() => showPreparationItemAction(item.itemId, override), ["shown"]);
                  }}
                >
                  Tampilkan lagi
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirming(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus item?</DialogTitle>
            <DialogDescription>
              {confirming !== null && removalEffect(scope, confirming)}
            </DialogDescription>
          </DialogHeader>
          {confirming !== null && <p className="text-sm break-words">“{confirming.label}”</p>}
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setConfirming(null);
              }}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (confirming === null) return;
                const itemId = confirming.itemId;
                write(
                  () => removePreparationItemAction(itemId, scope),
                  ["removed", "hidden"],
                  () => {
                    setConfirming(null);
                  },
                );
              }}
            >
              {busy ? "Menghapus…" : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** The sentence under the level picker: what this list is, and what a change here reaches. */
function levelSummary(scope: PreparationScope, settings: PreparationSettings): string {
  if (scope.level === "semua") {
    return "Berlaku untuk setiap Perjadin. Menambah atau menghapus item hanya mengenai Perjadin yang belum selesai; mengubah teks mengenai semuanya.";
  }
  if (scope.level === "cluster") {
    return `Yang didapat Perjadin ${settings.clusterName ?? ""} yang belum selesai: item Semua Perjadin, lalu item Cluster ini. Perjadin yang sudah selesai tidak berubah.`;
  }
  return settings.finished
    ? "Perjadin ini sudah selesai, jadi perubahan di Semua Perjadin atau Cluster tidak lagi mengenainya. Perubahan di sini tetap berlaku."
    : "Daftar Persiapan Perjadin ini. Perubahan di sini hanya mengenai Perjadin ini.";
}

/** What Hapus will do, said before it is done (#422). */
function removalEffect(scope: PreparationScope, item: PreparationSettingsItem): string {
  if (scope.level === "perjadin") return "Item ini akan hilang dari Perjadin ini.";
  const unchanged = "Perjadin yang sudah selesai tidak berubah.";
  const reach = item.reach ?? 0;
  const effect =
    reach === 0
      ? "Item ini tidak ada di Perjadin yang belum selesai."
      : `Item ini akan hilang dari ${reach} Perjadin yang belum selesai.`;
  const undo = item.own ? "" : " Item ini bisa ditampilkan lagi di sini.";
  return `${effect} ${unchanged}${undo}`;
}

const GONE = "Perubahan gagal. Muat ulang halaman untuk melihat keadaannya.";

const REFUSALS: Record<string, string> = {
  "label-required": "Teks item tidak boleh kosong.",
  "label-too-long": `Teks item terlalu panjang: maksimal ${MAX_PREPARATION_ITEM_LABEL_LENGTH} karakter.`,
  "duplicate-label": "Sudah ada item dengan teks yang sama di daftar ini.",
  "system-item": "Item ini tidak bisa dihapus atau disembunyikan.",
};

function refusalText(outcome: string): string {
  return REFUSALS[outcome] ?? GONE;
}

export { PreparationSettingsEditor };
