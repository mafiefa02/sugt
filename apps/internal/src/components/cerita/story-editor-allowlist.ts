import type { MilkdownPlugin } from "@milkdown/kit/ctx";
import { Bold, Italic, Link2, List, ListOrdered, Quote } from "lucide-react";

import {
  blockquoteAttr,
  blockquoteKeymap,
  blockquoteSchema,
  bulletListAttr,
  bulletListKeymap,
  bulletListSchema,
  docSchema,
  downgradeHeadingCommand,
  emphasisAttr,
  emphasisKeymap,
  emphasisSchema,
  emphasisStarInputRule,
  emphasisUnderscoreInputRule,
  hardbreakAttr,
  hardbreakClearMarkPlugin,
  hardbreakFilterNodes,
  hardbreakFilterPlugin,
  hardbreakKeymap,
  hardbreakSchema,
  headingAttr,
  headingIdGenerator,
  headingKeymap,
  headingSchema,
  hrAttr,
  hrSchema,
  insertHardbreakCommand,
  insertHrCommand,
  insertHrInputRule,
  liftFirstListItemCommand,
  liftListItemCommand,
  linkAttr,
  linkSchema,
  listItemAttr,
  listItemKeymap,
  listItemSchema,
  orderedListAttr,
  orderedListKeymap,
  orderedListSchema,
  paragraphAttr,
  paragraphKeymap,
  paragraphSchema,
  remarkAddOrderInListPlugin,
  remarkInlineLinkPlugin,
  remarkLineBreak,
  remarkMarker,
  remarkPreserveEmptyLinePlugin,
  sinkListItemCommand,
  splitListItemCommand,
  strongAttr,
  strongInputRule,
  strongKeymap,
  strongSchema,
  syncHeadingIdPlugin,
  syncListOrderPlugin,
  textSchema,
  toggleEmphasisCommand,
  toggleLinkCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
  updateLinkCommand,
  wrapInBlockquoteCommand,
  wrapInBlockquoteInputRule,
  wrapInBulletListCommand,
  wrapInBulletListInputRule,
  wrapInHeadingCommand,
  wrapInHeadingInputRule,
  wrapInOrderedListCommand,
  wrapInOrderedListInputRule,
} from "@milkdown/kit/preset/commonmark";

/**
 * **The Story body allowlist — the one list ADR-0015 asks for.**
 *
 * ADR-0015's whole decision is that "the editor's capabilities and the renderer's allowlist are
 * not two lists that agree today. They are one list, defined once." This array is that list. The
 * editor's ProseMirror schema is built from exactly these Milkdown plugins, so a mark or node the
 * list omits **cannot be created in the editor at all** — the constraint is structural, not a rule
 * a reviewer has to remember.
 *
 * **It is composed, not subtracted.** `commonmark` bundles every node it ships — including the
 * image and raw-HTML nodes this surface must never carry — behind one `.use()`. Taking it whole and
 * then stripping two nodes would leave the allowlist unstatable ("whatever commonmark ships this
 * version, minus two things") and a dependency bump would silently widen it, which is the exact
 * failure ADR-0015 calls invisible. So the list is assembled from named pieces instead. It mirrors
 * commonmark's own composition, group for group — the schema (each node's `*Attr` context slice
 * plus its schema), the input rules, the commands, the keymaps, and the remark transformers that
 * make the Markdown round trip lossless — **minus the nodes named absent below**.
 *
 * **When the public renderer lands ([#37]), it must be configured from this list** — that is the
 * "one list, not two" property. Sharing it across the app boundary (a package both `@sugt/public`
 * and `@sugt/internal` can import) is #37's call: today there is no public renderer to share with,
 * and ADR-0015 puts the editor in `apps/internal`, not `@sugt/ui`. Relocating this module is a move,
 * not a rewrite, when that day comes.
 *
 * **What is deliberately absent, and why — the other half of an allowlist.**
 *
 * - **Image** (`imageSchema`/`imageAttr` and its commands, input rule and cursor plugin).
 *   Photographs are never placed inside the body; they live in the Dokumentasi gallery as
 *   `story_photo` rows. This is the single most important omission, and it holds structurally: with
 *   no image node in the schema, ProseMirror has nowhere to put a pasted image, so it drops one
 *   rather than smuggling it into the prose — nothing has to remember to strip it.
 * - **Raw HTML** (`htmlSchema`/`htmlAttr` and `remarkHtmlTransformer`). An HTML node is an
 *   allowlist bypass by construction — it would let arbitrary tags reach the public page through a
 *   field the whole ADR exists to bound.
 * - **Code block and inline code** (`codeBlockSchema`, `inlineCodeSchema`, and their attrs). A
 *   field account is not source code; the code block also pulls in a language picker and CodeMirror
 *   weight for a feature Staff do not need. Omitted rather than styled away.
 *
 * [#37]: https://github.com/mafiefa02/sugt/issues/37
 */
export const storyEditorAllowlist: MilkdownPlugin[] = [
  // The schema group. Each node's `*Attr` slice is injected before its schema, because a schema's
  // `toDOM` reads its attrs from that context — omitting the slice throws "context not found". The
  // order mirrors commonmark's own `schema` composition, minus image, HTML and code.
  docSchema,
  paragraphAttr,
  paragraphSchema,
  headingIdGenerator,
  headingAttr,
  headingSchema,
  hardbreakAttr,
  hardbreakSchema,
  blockquoteAttr,
  blockquoteSchema,
  hrAttr,
  hrSchema,
  bulletListAttr,
  bulletListSchema,
  orderedListAttr,
  orderedListSchema,
  listItemAttr,
  listItemSchema,
  emphasisAttr,
  emphasisSchema,
  strongAttr,
  strongSchema,
  linkAttr,
  linkSchema,
  textSchema,

  // Input rules: the "type it and see it" shortcuts — `## ` for a subheading, `- ` for a list,
  // `> ` for a quote, `**` for bold. This is what makes the editor WYSIWYG rather than syntax.
  wrapInHeadingInputRule,
  wrapInBlockquoteInputRule,
  wrapInBulletListInputRule,
  wrapInOrderedListInputRule,
  insertHrInputRule,
  strongInputRule,
  emphasisStarInputRule,
  emphasisUnderscoreInputRule,

  // Commands, invoked by the keymaps below (and available to any toolbar a later slice adds).
  turnIntoTextCommand,
  wrapInHeadingCommand,
  // Backspace and Delete at the start of a heading, bound by `headingKeymap` below. A keymap and the
  // command it calls are one unit: `$command` assigns its `key` only when the plugin runs, so a
  // keymap kept without its command calls `commandsCtx.call(undefined)` and throws on the keystroke.
  downgradeHeadingCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  sinkListItemCommand,
  liftListItemCommand,
  splitListItemCommand,
  liftFirstListItemCommand,
  insertHardbreakCommand,
  insertHrCommand,
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleLinkCommand,
  updateLinkCommand,

  // Keymaps: Enter/Backspace behaviour per node, and the mark shortcuts (`mod-b`, `mod-i`) that
  // give bold and italic without any syntax at all.
  paragraphKeymap,
  headingKeymap,
  blockquoteKeymap,
  bulletListKeymap,
  orderedListKeymap,
  listItemKeymap,
  hardbreakKeymap,
  strongKeymap,
  emphasisKeymap,

  // Supporting plugins and the remark transformers that keep the Markdown round trip faithful —
  // hard-break handling, ordered-list numbering, heading ids, link and emphasis markers, and blank
  // lines between blocks. Without these the round trip drops markers or collapses spacing, the
  // silent loss ADR-0015 is about. The HTML transformer is excluded with the HTML node.
  hardbreakClearMarkPlugin,
  hardbreakFilterNodes,
  hardbreakFilterPlugin,
  syncHeadingIdPlugin,
  syncListOrderPlugin,
  remarkAddOrderInListPlugin,
  remarkInlineLinkPlugin,
  remarkLineBreak,
  remarkMarker,
  remarkPreserveEmptyLinePlugin,
].flat();

/**
 * **The formatting toolbar's binding — the "one list, not three" property, held.**
 *
 * ADR-0015's decision is that the editor's capabilities and the public renderer's allowlist are
 * **one list, defined once** — the `storyEditorAllowlist` above. A toolbar is a candidate *third*
 * list: a hand-written `["bold", "italic", "heading", …]` is a second enumeration of the same
 * capabilities that can drift from the schema silently. When it drifts you get
 * `commandsCtx.call(undefined)` — the crash [`c79105f`](https://github.com/mafiefa02/sugt/commit/c79105f)
 * fixed on this exact surface.
 *
 * So this spec holds the imported command **values**, not their string names. Each entry below binds
 * to the same import the allowlist array binds to. Removing a command from the allowlist means
 * removing its import — which breaks *this* spec at compile time, so the failure is a build error a
 * reviewer cannot miss, not a click that dispatches `undefined`. The allowlist is a **ceiling, not a
 * quota**: this exposes six of its capabilities and deliberately omits some the schema still permits
 * (Judul 1, horizontal rule, hard break, list indent, undo/redo — each reachable another way). It
 * never exposes anything the schema does not.
 *
 * Icons and Indonesian labels live here too, beside the commands they trigger, so the whole binding
 * is one thing to read. The toolbar component in `story-editor.tsx` renders from this; the caret
 * state it reflects is derived by the pure function in `toolbar-state.ts`.
 */
export const storyToolbar = {
  /**
   * Judul 2 and Judul 3 wrap into a heading; Paragraf turns back into text. Judul 1 is deliberately
   * absent — `story.title` is the document's H1, and a second H1 in the prose is an outline bug.
   * `# ` still works, so this narrows the toolbar, not the schema.
   */
  heading: {
    toParagraph: turnIntoTextCommand,
    toHeading: wrapInHeadingCommand,
  },
  bold: {
    command: toggleStrongCommand,
    icon: Bold,
    label: "Tebal",
    hint: "Tebal (Ctrl+B)",
  },
  italic: {
    command: toggleEmphasisCommand,
    icon: Italic,
    label: "Miring",
    hint: "Miring (Ctrl+I)",
  },
  bulletList: {
    command: wrapInBulletListCommand,
    icon: List,
    label: "Daftar poin",
    hint: "Daftar poin",
  },
  orderedList: {
    command: wrapInOrderedListCommand,
    icon: ListOrdered,
    label: "Daftar bernomor",
    hint: "Daftar bernomor",
  },
  blockquote: {
    command: wrapInBlockquoteCommand,
    icon: Quote,
    label: "Kutipan",
    hint: "Kutipan",
  },
  /**
   * `toggle` marks a fresh link over a selection (and, over a selected existing link, removes it);
   * `update` rewrites the href of the link under the caret. Both are needed and both are bound here.
   */
  link: {
    toggle: toggleLinkCommand,
    update: updateLinkCommand,
    icon: Link2,
    label: "Tautan",
    hint: "Tautan",
  },
} as const;
