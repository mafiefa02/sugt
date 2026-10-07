import { PreparationSettingsEditor } from "-/components/preparation-settings-editor";
import { perjadinName, perjadinSchoolsLine } from "-/lib/perjadin-name";
import { requirePerson } from "-/lib/person";
import {
  hasGrant,
  preparationSettings,
  preparationSettingsClusters,
  preparationSettingsPerjadins,
} from "@sugt/db/queries";
import { LinkButton } from "@sugt/ui/components/link-button";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";

import { parseLevelParams, scopeOf } from "./level-params";

export const metadata: Metadata = { title: "Pengaturan Perjadin" };

/**
 * **Pengaturan Perjadin** (#422) — Administrator only. For now it does one thing: customise the
 * Preparation Checklist at its three levels, Semua Perjadin, one Cluster or one Perjadin (ADR-0045).
 *
 * Anyone else, a Pimpinan included, gets `forbidden()` and the 403, as on `/pengaturan` and `/log`;
 * the button on `/perjadin` is shown to the same people. Every write re-checks Administrator in the
 * query layer.
 *
 * **The level is in the URL** (`?tingkat=&cluster=&perjadin=`), so it survives a reload and a
 * write's revalidation. The static `pengaturan` segment wins over its sibling `[id]` in Next's
 * routing, so this is never read as a Perjadin id.
 */
export default async function Page({ searchParams }: PageProps<"/perjadin/pengaturan">) {
  const person = await requirePerson();
  if (!hasGrant(person, "Administrator")) forbidden();

  const [clusters, trips] = await Promise.all([
    preparationSettingsClusters(person),
    preparationSettingsPerjadins(person),
  ]);
  const choice = parseLevelParams(
    await searchParams,
    clusters.map((row) => row.id),
  );
  const scope = scopeOf(choice);
  const settings = scope ? await preparationSettings(person, scope) : null;

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border px-4 py-5 sm:px-7">
        <LinkButton
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
          render={<Link href="/perjadin" />}
        >
          <ArrowLeft data-icon="inline-start" />
          Perjadin
        </LinkButton>
        <h1 className="font-heading text-lg font-medium">Pengaturan Perjadin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Daftar Persiapan untuk semua Perjadin, untuk satu Cluster, atau untuk satu Perjadin. Yang
          lebih khusus menang. Hanya Administrator yang dapat membuka halaman ini.
        </p>
      </header>

      <PreparationSettingsEditor
        choice={choice}
        clusters={clusters}
        perjadins={trips.map((trip) => ({
          value: trip.id,
          label: perjadinName(trip),
          description: perjadinSchoolsLine(trip.schoolNames) || undefined,
          keywords: trip.schoolNames.join(" "),
        }))}
        settings={settings}
      />
    </div>
  );
}
