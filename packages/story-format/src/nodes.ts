/**
 * **The render half of ADR-0015's one list.**
 *
 * ADR-0015 requires the public renderer's allowlist and the editor's ProseMirror schema to be "one
 * list, defined once." They cannot be *literally* the same value — the editor needs Milkdown plugins
 * (`./allowlist.ts`), the renderer needs a set of HTML elements to permit — so the two live in **one
 * package** and this module names the correspondence explicitly, element by schema node. A tag added
 * to the editor's schema without being added here (or vice versa) is the drift the ADR calls the
 * signal the decision has been broken; keeping both halves in this package is what makes that drift a
 * one-file review rather than a cross-app one.
 *
 * Each element below maps to a node in `storyEditorAllowlist`:
 *
 * | Element        | Editor schema node            |
 * | -------------- | ----------------------------- |
 * | `p`            | `paragraphSchema`             |
 * | `h1`–`h6`      | `headingSchema`               |
 * | `br`           | `hardbreakSchema`             |
 * | `blockquote`   | `blockquoteSchema`            |
 * | `hr`           | `hrSchema`                    |
 * | `ul`           | `bulletListSchema`            |
 * | `ol`           | `orderedListSchema`           |
 * | `li`           | `listItemSchema`              |
 * | `em`           | `emphasisSchema`              |
 * | `strong`       | `strongSchema`                |
 * | `a`            | `linkSchema`                  |
 *
 * **Headings run `h1`–`h6` because the schema does**, not because the toolbar offers them: the
 * toolbar deliberately omits `# ` (`story.title` is the document's H1), but the schema still permits
 * it, and ADR-0015 pins the renderer to the schema, not the toolbar. **`img`, `code`/`pre` and raw
 * HTML are absent** — the same three nodes `./allowlist.ts` leaves out — so a whitelist that never
 * names them drops a pasted image, a code fence or a smuggled tag rather than rendering it.
 */
export const STORY_BODY_ELEMENTS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "br",
  "blockquote",
  "hr",
  "ul",
  "ol",
  "li",
  "em",
  "strong",
  "a",
] as const;
