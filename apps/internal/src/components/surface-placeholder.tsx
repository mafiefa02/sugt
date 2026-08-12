/**
 * A destination that the sidebar names and another ticket builds.
 *
 * `typedRoutes` is on, so a `Link` only typechecks when its route exists. The shell is
 * the deliverable of issue #14 and the surfaces are not, so each destination gets one
 * of these until its own ticket replaces it. The heading is the surface's name from the
 * enumerated list in issue #9; `issue` says who owns it.
 */
function SurfacePlaceholder({ title, issue }: { title: string; issue: number }) {
  return (
    <div className="p-8">
      <h1 className="text-lg font-medium">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Belum dibangun — lihat issue #{issue}.</p>
    </div>
  );
}

export { SurfacePlaceholder };
