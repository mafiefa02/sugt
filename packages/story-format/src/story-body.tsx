import Markdown from "react-markdown";

import { STORY_BODY_ELEMENTS } from "@sugt/story-format/nodes";

/**
 * **The public renderer for a Story's Markdown body — the render half of ADR-0015's one list.**
 *
 * It permits **exactly** the elements the editor's schema can produce (`./nodes.ts`, named against
 * the schema nodes in `./allowlist.ts`), and drops everything else. `allowedElements` is a whitelist,
 * so an image, a code fence or a smuggled tag has no element to render into and is removed with its
 * children (`unwrapDisallowed` left false) — the same structural omission the editor makes, not a
 * rule this renderer has to remember. Raw HTML never becomes an element at all: `react-markdown`
 * parses no HTML without `rehype-raw`, which is deliberately absent.
 *
 * **It renders plain semantic elements and no classes.** Styling is the consuming page's: a public
 * page wraps `<StoryBody>` in a container that targets these tags with its own Tailwind child
 * selectors, so this package carries no Tailwind surface to be scanned — the cross-package content
 * problem `AGENTS.md` describes for `@sugt/ui` never arises here.
 *
 * A Server Component: it runs at build/request time, so `@milkdown/kit` (this package's editor half)
 * never reaches the client and neither does a Markdown parser beyond what `react-markdown` bundles.
 */
export function StoryBody({ markdown }: { markdown: string }) {
  return (
    <Markdown
      allowedElements={[...STORY_BODY_ELEMENTS]}
      unwrapDisallowed={false}
      components={{
        // External links get `rel="noreferrer"`: a Story body is authored prose, and a bare
        // outbound link handing the referrer to another origin is a leak the renderer can close
        // once for every Story rather than per link.
        a: ({ node: _node, ...props }) => (
          <a
            {...props}
            rel="noreferrer"
          />
        ),
      }}
    >
      {markdown}
    </Markdown>
  );
}
