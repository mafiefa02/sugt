import { SiteContainer } from "-/components/site-container";

/**
 * A destination that the header or the footer names and another ticket builds.
 *
 * `typedRoutes` is on, so a `Link` only typechecks when its route exists. The shell is
 * the deliverable of issue #14 and the twelve public surfaces are issue #38, so each
 * destination gets one of these until that ticket replaces it.
 */
function SurfacePlaceholder({ title, issue }: { title: string; issue: number }) {
  return (
    <SiteContainer className="py-16">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Belum dibangun — lihat issue #{issue}.</p>
    </SiteContainer>
  );
}

export { SurfacePlaceholder };
