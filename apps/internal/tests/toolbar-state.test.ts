import { deriveToolbarState } from "-/components/cerita/toolbar-state";
import { Schema } from "@milkdown/kit/prose/model";
import { EditorState, TextSelection } from "@milkdown/kit/prose/state";
import { describe, expect, it } from "vitest";

/**
 * **The pure toolbar-state derivation, tested with no database and no DOM.**
 *
 * This file needs neither — it builds ProseMirror `EditorState`s by hand and asserts on
 * `deriveToolbarState`, which is a pure `EditorState → ToolbarState` function. It sits with the rest
 * of the suite only because `pnpm --filter @sugt/internal test` is one Vitest project today; nothing
 * here touches Postgres, so whoever later splits the pure tests off from the ones that do can lift
 * this file out untouched. (That split is a separate ticket; the marker is this comment.)
 *
 * **The schema is transcribed, not booted.** The node and mark specs below are copied from
 * `@milkdown/preset-commonmark` 7.22.1 (`lib/index.js`) — the same package `story-editor-allowlist.ts`
 * composes — so the names, groups and content expressions the derivation reads match what the real
 * editor produces. It is a transcription of that source, kept minimal to what the derivation looks at.
 */
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    heading: {
      content: "inline*",
      group: "block",
      defining: true,
      attrs: { id: { default: "" }, level: { default: 1 } },
    },
    blockquote: { content: "block+", group: "block", defining: true },
    bullet_list: { content: "listItem+", group: "block", attrs: { spread: { default: false } } },
    ordered_list: {
      content: "listItem+",
      group: "block",
      attrs: { order: { default: 1 }, spread: { default: false } },
    },
    list_item: {
      content: "paragraph block*",
      group: "listItem",
      attrs: {
        label: { default: "•" },
        listType: { default: "bullet" },
        spread: { default: false },
      },
    },
    text: { group: "inline" },
  },
  marks: {
    // commonmark declares emphasis/strong before link; mark order is not load-bearing for the reads here.
    emphasis: { attrs: { marker: { default: "*" } } },
    strong: { attrs: { marker: { default: "*" } } },
    link: { attrs: { href: {}, title: { default: null } } },
  },
});

const strong = schema.marks.strong;
const emphasis = schema.marks.emphasis;
const link = schema.marks.link;

/** A state whose caret sits at `anchor` (to `head`, if a selection) inside `doc`. */
function stateAt(doc: ReturnType<Schema["node"]>, anchor: number, head = anchor): EditorState {
  return EditorState.create({ doc, selection: TextSelection.create(doc, anchor, head) });
}

function para(text: string): ReturnType<Schema["node"]> {
  return schema.node("paragraph", null, text ? [schema.text(text)] : []);
}

describe("deriveToolbarState", () => {
  it("marks a mark active only where the caret carries it", () => {
    // "plain BOLD" where "BOLD" carries strong.
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [
        schema.text("plain "),
        schema.text("BOLD", [strong.create()]),
      ]),
    ]);
    // Caret inside "BOLD" (after "plain " = 7 chars incl the leading paragraph open at pos 1 → pos ~9).
    const insideBold = stateAt(doc, 9);
    expect(deriveToolbarState(insideBold).strong.active).toBe(true);

    // Caret inside "plain".
    const insidePlain = stateAt(doc, 3);
    expect(deriveToolbarState(insidePlain).strong.active).toBe(false);
    // The control is available in both places.
    expect(deriveToolbarState(insidePlain).strong.disabled).toBe(false);
  });

  it("tracks emphasis independently of strong", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [schema.text("italic", [emphasis.create()])]),
    ]);
    const state = deriveToolbarState(stateAt(doc, 3));
    expect(state.emphasis.active).toBe(true);
    expect(state.strong.active).toBe(false);
  });

  it("reports the heading level under the caret, including H1", () => {
    for (const level of [1, 2, 3] as const) {
      const doc = schema.node("doc", null, [
        schema.node("heading", { level }, [schema.text("Judul")]),
      ]);
      expect(deriveToolbarState(stateAt(doc, 3)).heading.value).toBe(`h${level}`);
    }
  });

  it("reports a plain paragraph as paragraph", () => {
    const doc = schema.node("doc", null, [para("halo")]);
    const state = deriveToolbarState(stateAt(doc, 3));
    expect(state.heading.value).toBe("paragraph");
    expect(state.heading.disabled).toBe(false);
  });

  it("returns null for a mixed selection", () => {
    const doc = schema.node("doc", null, [
      schema.node("heading", { level: 2 }, [schema.text("Judul")]),
      para("teks"),
    ]);
    // Select across the heading into the paragraph.
    const state = deriveToolbarState(stateAt(doc, 3, 10));
    expect(state.heading.value).toBeNull();
  });

  it("marks a bullet list active and disables heading inside it", () => {
    const doc = schema.node("doc", null, [
      schema.node("bullet_list", null, [schema.node("list_item", null, [para("satu")])]),
    ]);
    // Caret inside the list item's paragraph.
    const state = deriveToolbarState(stateAt(doc, 4));
    expect(state.bulletList.active).toBe(true);
    expect(state.orderedList.active).toBe(false);
    // A heading is not a legal first child of a list item, so the command cannot apply.
    expect(state.heading.disabled).toBe(true);
  });

  it("marks a blockquote active", () => {
    const doc = schema.node("doc", null, [schema.node("blockquote", null, [para("dikutip")])]);
    const state = deriveToolbarState(stateAt(doc, 3));
    expect(state.blockquote.active).toBe(true);
    expect(state.bulletList.active).toBe(false);
  });

  it("disables link on an empty selection with no link under the caret", () => {
    const doc = schema.node("doc", null, [para("tanpa tautan")]);
    const state = deriveToolbarState(stateAt(doc, 3));
    expect(state.link.disabled).toBe(true);
    expect(state.link.active).toBe(false);
    expect(state.link.href).toBeNull();
  });

  it("enables link and prefills the href for a caret inside a link", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [
        schema.text("lihat ", []),
        schema.text("situs", [link.create({ href: "https://sugt.example" })]),
      ]),
    ]);
    // Caret inside "situs" — an empty selection, but sitting on a link.
    const state = deriveToolbarState(stateAt(doc, 9));
    expect(state.link.active).toBe(true);
    expect(state.link.href).toBe("https://sugt.example");
    // Empty selection, yet not disabled — Update and Remove are available.
    expect(state.link.disabled).toBe(false);
  });

  it("enables link for a non-empty selection of plain text", () => {
    const doc = schema.node("doc", null, [para("pilih aku")]);
    const state = deriveToolbarState(stateAt(doc, 1, 6));
    expect(state.link.disabled).toBe(false);
    expect(state.link.active).toBe(false);
  });
});
