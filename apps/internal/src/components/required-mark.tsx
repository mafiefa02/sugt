/**
 * **The asterisk after a required field's label** (#354), and the legend that explains it. New to this
 * app, so a form that marks its required fields shows the legend too.
 *
 * Both are `aria-hidden`: the glyph is for sighted readers only. A screen reader learns the same thing
 * from `aria-required="true"` on the control, which the form sets beside the mark — so it hears
 * "required", never "star", and the legend explaining a star it never heard would be noise.
 *
 * Here rather than in `@sugt/ui`: only the internal app uses it, and an app owns what only it uses.
 */
function RequiredMark() {
  return (
    <span
      aria-hidden="true"
      className="text-destructive"
    >
      *
    </span>
  );
}

function RequiredLegend() {
  return (
    <p
      aria-hidden="true"
      className="text-xs text-muted-foreground"
    >
      <RequiredMark /> wajib diisi
    </p>
  );
}

export { RequiredLegend, RequiredMark };
