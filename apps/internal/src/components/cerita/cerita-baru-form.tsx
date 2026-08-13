"use client";

import { createStoryAction } from "-/app/(app)/cerita/actions";
import { Button } from "@sugt/ui/components/button";
import { Input } from "@sugt/ui/components/input";
import { Label } from "@sugt/ui/components/label";
import { LinkButton } from "@sugt/ui/components/link-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sugt/ui/components/select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

/**
 * **Start a Story** — choose the one School it is about, and give it a title.
 *
 * These two are collected here, before creation, for one reason each. The School is the only thing
 * a Story attaches to and it is fixed once set, so it is chosen deliberately rather than defaulted.
 * The title generates the slug **once, at creation, and the slug never moves** — so a blank title
 * would give every Story the permanent public path `cerita`, `cerita-2`, `cerita-3`. Collecting it
 * now avoids that.
 *
 * Everything else — the body, Jenis, Stream, photographs — is edited on the next screen. The Story
 * is created as a draft (`published_at` null) and this redirects straight into its editor.
 */
export function CeritaBaruForm({
  schools,
}: {
  schools: { id: string; name: string; kabupatenKota: string }[];
}) {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState("");
  const [title, setTitle] = useState("");
  const [creating, startCreating] = useTransition();

  const schoolFieldId = useId();
  const titleFieldId = useId();
  const ready = schoolId !== "" && title.trim() !== "";

  function create() {
    startCreating(async () => {
      const { id } = await createStoryAction({
        schoolId,
        title: title.trim(),
        body: "",
        kind: "field",
        stream: null,
      });
      router.push(`/cerita/${id}`);
    });
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 p-7">
      <div className="grid gap-1.5">
        <Label htmlFor={schoolFieldId}>Sekolah</Label>
        <Select
          items={Object.fromEntries(
            schools.map((school) => [school.id, `${school.name} · ${school.kabupatenKota}`]),
          )}
          value={schoolId === "" ? null : schoolId}
          onValueChange={(selected) => setSchoolId((selected as string | null) ?? "")}
        >
          <SelectTrigger
            id={schoolFieldId}
            className="w-full"
          >
            <SelectValue placeholder="Pilih Sekolah" />
          </SelectTrigger>
          <SelectContent>
            {schools.map((school) => (
              <SelectItem
                key={school.id}
                value={school.id}
              >
                {school.name} · {school.kabupatenKota}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Satu Cerita tentang satu Sekolah, dan ini tidak bisa diubah setelah dibuat.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={titleFieldId}>Judul</Label>
        <Input
          id={titleFieldId}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Judul Cerita"
        />
        <p className="text-xs text-muted-foreground">
          Judul menentukan slug publik satu kali di sini, dan slug itu tidak berpindah walau judul
          diubah nanti.
        </p>
      </div>

      <div className="flex gap-2.5">
        <Button
          disabled={!ready || creating}
          onClick={create}
        >
          {creating ? "Membuat…" : "Buat draf"}
        </Button>
        <LinkButton
          variant="ghost"
          render={<Link href="/cerita" />}
        >
          Batal
        </LinkButton>
      </div>
    </div>
  );
}
