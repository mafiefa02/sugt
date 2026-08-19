import { Band } from "-/components/band";
import { SchoolList } from "-/components/school-list";
import { Stat } from "-/components/stat";
import { getDelivery, getScope } from "-/lib/aggregates";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@sugt/ui/components/breadcrumb";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * **One Cluster** — its Topic and Problem, its Schools, and its delivered count.
 *
 * Built from the scope and delivery payloads, filtered to this slug; an unknown slug is a 404 (a
 * stale link, which is reachable). `generateStaticParams` prebuilds the four from the scope payload,
 * so a dead origin fails the build rather than 500-ing a crawler later (ADR-0014). The delivered
 * figure is this Cluster's own; there is still no per-School figure anywhere (ADR-0001).
 */
export const revalidate = 3600;

export async function generateStaticParams() {
  const scope = await getScope();
  return scope.clusters.map((cluster) => ({ slug: cluster.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/cluster/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const scope = await getScope();
  return { title: scope.clusters.find((cluster) => cluster.slug === slug)?.name ?? "Cluster" };
}

export default async function Page({ params }: PageProps<"/cluster/[slug]">) {
  const { slug } = await params;
  const [scope, delivery] = await Promise.all([getScope(), getDelivery()]);

  const cluster = scope.clusters.find((entry) => entry.slug === slug);
  if (!cluster) notFound();

  const schools = scope.schools.filter((school) => school.clusterSlug === slug);
  const delivered = delivery.perCluster.find((entry) => entry.clusterSlug === slug)?.delivered ?? 0;

  return (
    <>
      <Band className="py-16">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/cluster">Cluster</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{cluster.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <p className="mt-4 text-sm font-medium text-muted-foreground">{cluster.topic}</p>
        <h1 className="mt-1 font-heading text-4xl font-bold tracking-tight">{cluster.name}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{cluster.problem}</p>
        <div className="mt-8 flex flex-wrap gap-x-12 gap-y-6">
          <Stat
            figure={schools.length.toLocaleString("id-ID")}
            caption="Sekolah"
          />
          <Stat
            figure={delivered.toLocaleString("id-ID")}
            caption="Sesi terlaksana"
          />
        </div>
      </Band>

      <Band>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">Sekolah</h2>
        <div className="mt-4">
          <SchoolList schools={schools} />
        </div>
      </Band>
    </>
  );
}
