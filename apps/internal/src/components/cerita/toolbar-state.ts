import { setBlockType, toggleMark, wrapIn } from "@milkdown/kit/prose/commands";
import type { MarkType } from "@milkdown/kit/prose/model";
import type { Command, EditorState } from "@milkdown/kit/prose/state";

/**
 * **The formatting toolbar's state, derived from the editor state and nothing else.**
 *
 * ADR-0015 gives the toolbar its commands (see `story-editor-allowlist.ts`); this gives it what the
 * buttons should *show*. It is deliberately a **pure function** — `EditorState → ToolbarState` — and
 * lives apart from the React component so it can be tested against ProseMirror states built by hand,
 * with no DOM, no jsdom and no editor to boot. The genuinely error-prone part of the feature (does a
 * mark cover the caret? which heading level is this? can a list wrap here?) is therefore the part a
 * unit test pins down. `tests/toolbar-state.test.ts` is that test.
 *
 * **`active` reads the document; `disabled` re-runs the real command as a dry run.** Whether a
 * control can apply is answered by calling the *same* ProseMirror base command the Milkdown command
 * dispatches (`toggleMark`, `wrapIn`, `setBlockType`) with no `dispatch` argument — ProseMirror
 * commands return `false` when they cannot apply. So "disabled" cannot drift from "does nothing on
 * click": they are computed from one source.
 */

/** A control that is either on or off, and either available or not. */
export type ToggleState = { active: boolean; disabled: boolean };

/**
 * What the heading `Select` displays: the block type under the caret. `"paragraph"` and `h2`/`h3`
 * are the values the toolbar offers; `h1` is shown (an existing `# ` heading) but not offered; a
 * level the toolbar never writes (`h4`–`h6`, still typeable with `#### `) is honest rather than
 * hidden. `null` is a mixed or non-text selection — the field shows its placeholder.
 */
export type HeadingValue = "paragraph" | `h${1 | 2 | 3 | 4 | 5 | 6}` | null;

export type ToolbarState = {
  strong: ToggleState;
  emphasis: ToggleState;
  bulletList: ToggleState;
  orderedList: ToggleState;
  blockquote: ToggleState;
  heading: { value: HeadingValue; disabled: boolean };
  /**
   * `active` — the caret carries a link, so the dialog opens prefilled with `href` and offers Remove.
   * `disabled` — an empty selection with no link under it: `toggleLink` marks a range and there is no
   * range, and there is nothing to update either. A selection, or a caret inside a link, enables it.
   */
  link: { active: boolean; href: string | null; disabled: boolean };
};

/** A ProseMirror command applies when, run without a `dispatch`, it reports it could. */
function canApply(command: Command | null, state: EditorState): boolean {
  return command !== null && command(state);
}

/** A mark is active when a collapsed caret carries it, or a selection is wholly covered by it. */
function markActive(state: EditorState, type: MarkType): boolean {
  const { empty, from, to, $from } = state.selection;
  if (empty) return type.isInSet(state.storedMarks ?? $from.marks()) !== undefined;
  return state.doc.rangeHasMark(from, to, type);
}

/** A toggle bound to a mark: active where the caret carries it, disabled where the mark cannot apply. */
function markToggle(state: EditorState, type: MarkType | undefined): ToggleState {
  if (!type) return { active: false, disabled: true };
  return { active: markActive(state, type), disabled: !canApply(toggleMark(type), state) };
}

/** A toggle bound to a wrapping block (list, quote): active where an ancestor is that node. */
function wrapToggle(state: EditorState, nodeName: string): ToggleState {
  const type = state.schema.nodes[nodeName];
  if (!type) return { active: false, disabled: true };
  const { $from } = state.selection;
  let active = false;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type === type) {
      active = true;
      break;
    }
  }
  return { active, disabled: !canApply(wrapIn(type), state) };
}

/** The block type under the selection: uniform → that block, mixed or non-text → `null`. */
function headingValue(state: EditorState): HeadingValue {
  const { empty, from, to, $from } = state.selection;
  const seen = new Set<HeadingValue | "other">();

  const record = (nodeName: string, level?: number) => {
    if (nodeName === "paragraph") seen.add("paragraph");
    else if (nodeName === "heading" && level && level >= 1 && level <= 6)
      seen.add(`h${level as 1 | 2 | 3 | 4 | 5 | 6}`);
    else seen.add("other");
  };

  if (empty) {
    record($from.parent.type.name, $from.parent.attrs.level as number | undefined);
  } else {
    state.doc.nodesBetween(from, to, (node) => {
      if (node.isTextblock) record(node.type.name, node.attrs.level as number | undefined);
    });
  }

  if (seen.size !== 1) return null;
  const [only] = seen;
  return only === "other" ? null : (only ?? null);
}

/** The heading control: enabled when the caret's block can be re-typed to a heading. */
function headingState(state: EditorState): { value: HeadingValue; disabled: boolean } {
  const type = state.schema.nodes.heading;
  const disabled = !type || !canApply(setBlockType(type, { level: 2 }), state);
  return { value: headingValue(state), disabled };
}

/** The link under the caret, if any — the href the dialog prefills and whether Remove is offered. */
function linkState(state: EditorState): ToolbarState["link"] {
  const type = state.schema.marks.link;
  if (!type) return { active: false, href: null, disabled: true };

  const { empty, from, to, $from } = state.selection;
  const mark = empty
    ? type.isInSet(state.storedMarks ?? $from.marks())
    : findLinkMark(state, from, to, type);

  const active = mark !== undefined;
  const href = active ? ((mark.attrs.href as string | null) ?? null) : null;
  // Empty selection with no link: nothing to mark (toggleLink needs a range) and nothing to update.
  const disabled = empty && !active;
  return { active, href, disabled };
}

function findLinkMark(state: EditorState, from: number, to: number, type: MarkType) {
  let found: ReturnType<MarkType["isInSet"]> = undefined;
  state.doc.nodesBetween(from, to, (node) => {
    if (found) return false;
    found = type.isInSet(node.marks);
    return found === undefined;
  });
  return found;
}

/** Derive the whole toolbar's state from the editor state. Pure — the module's reason to exist. */
export function deriveToolbarState(state: EditorState): ToolbarState {
  return {
    strong: markToggle(state, state.schema.marks.strong),
    emphasis: markToggle(state, state.schema.marks.emphasis),
    bulletList: wrapToggle(state, "bullet_list"),
    orderedList: wrapToggle(state, "ordered_list"),
    blockquote: wrapToggle(state, "blockquote"),
    heading: headingState(state),
    link: linkState(state),
  };
}
