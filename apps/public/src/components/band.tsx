import { SiteContainer } from "-/components/site-container";
import { cn } from "@sugt/ui/lib/utils";

/**
 * **One full-width, border-led band, its contents in the centred column.**
 *
 * `docs/product.md` describes every part of the site as a full-width band divided by a rule, with
 * its contents inside the 1120px column. This is that shape in one place: a `<section>` with a bottom
 * border, wrapping its children in a `SiteContainer`. Pages stack these; the last one's border is the
 * page's own bottom rule, and the footer's border sits below it.
 */
function Band({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className="border-b border-border">
      <SiteContainer className={cn("py-12", className)}>{children}</SiteContainer>
    </section>
  );
}

export { Band };
