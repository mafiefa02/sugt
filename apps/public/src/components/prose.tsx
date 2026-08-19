/**
 * **Typography for a Story body**, applied from the page rather than the renderer.
 *
 * `StoryBody` (`@sugt/story-format`) emits plain semantic elements with no classes, so it carries no
 * Tailwind surface to be scanned across the package boundary. This wrapper — which lives in the app
 * Tailwind *does* scan — styles those elements through child selectors. Only the elements the render
 * allowlist can produce are targeted (`h2`–`h4`, `p`, `ul`/`ol`/`li`, `blockquote`, `a`, `hr`); an
 * `h1` is left at the browser default because `story.title` is already the page's H1.
 */
function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-2xl text-base leading-relaxed [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_blockquote]:mt-5 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_h4]:mt-6 [&_h4]:text-lg [&_h4]:font-semibold [&_hr]:my-8 [&_hr]:border-border [&_li]:mt-1 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&>*:first-child]:mt-0">
      {children}
    </div>
  );
}

export { Prose };
