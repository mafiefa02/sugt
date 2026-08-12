import { cn } from "@sugt/ui/lib/utils";

/**
 * The public site's column: centred, 1120px, 32px of side padding.
 *
 * Every band on the site is full width and border-led, and its contents sit in this
 * column. So the shell puts one around the header, the footer and `<main>`, and a page
 * puts another around each band it draws — nesting is harmless, since an inner column
 * is already inside the outer one's width.
 *
 * It lives in `@sugt/public` rather than `@sugt/ui` because only this app is centred;
 * the internal tool is a fixed sidebar beside a fluid main. An app owns what only it
 * uses.
 */
function SiteContainer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1120px] px-8", className)}
      {...props}
    />
  );
}

export { SiteContainer };
