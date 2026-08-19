/**
 * **One figure and its caption**, the unit the scope and delivery bands are built from.
 *
 * The figure is large and tabular; the caption sits under it. A stat carries no logic — every number
 * it shows is derived by its caller (`docs/product.md`: a count never travels beside the list it
 * summarises), so this is presentation only.
 */
function Stat({ figure, caption }: { figure: React.ReactNode; caption: string }) {
  return (
    <div>
      <div className="text-3xl font-bold tracking-tight tabular-nums">{figure}</div>
      <div className="mt-1 text-sm text-muted-foreground">{caption}</div>
    </div>
  );
}

export { Stat };
