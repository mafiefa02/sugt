"use client";

import { Editor, defaultValueCtx, editorViewOptionsCtx, rootCtx } from "@milkdown/kit/core";
import { history } from "@milkdown/kit/plugin/history";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { useEffect, useRef } from "react";

import { storyEditorAllowlist } from "./story-editor-allowlist";

/**
 * **The Story body editor — the WYSIWYG surface ADR-0015 settles on.**
 *
 * Milkdown, built on ProseMirror and remark, so Markdown is the document model rather than a
 * serialiser bolted onto a rich-text one — the round trip is lossless by construction. The schema
 * is `storyEditorAllowlist` and nothing else: a mark the list omits cannot be typed, pasted, or
 * loaded into the body. Photographs are never here; they are the Dokumentasi gallery.
 *
 * Formatting is visual, not syntax: bold and italic are `mod-b`/`mod-i` (the marks' keymaps), a
 * subheading is `## `, a list is `- `, all rendered live as they are typed. Staff describe a school
 * visit; they do not learn Markdown.
 *
 * **The body is reported up, never held here.** `onChange` fires on every `markdownUpdated`; the
 * form above owns the draft and persists it on an explicit Save. This component is the one place
 * the body text is produced, so there is no second source of truth for "what will be saved".
 */
function StoryEditorInner({
  initialBody,
  onChange,
}: {
  initialBody: string;
  onChange: (markdown: string) => void;
}) {
  // The editor is created once (no deps below), so its `config` closure captures `onChange` once.
  // A ref keeps the callback current without recreating the editor on every parent render.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, initialBody);
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          attributes: {
            class: EDITOR_CLASS,
            spellcheck: "false",
          },
        }));
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, previous) => {
          if (markdown !== previous) onChangeRef.current(markdown);
        });
      })
      .use(listener)
      .use(history)
      .use(storyEditorAllowlist),
  );

  return <Milkdown />;
}

/**
 * The class on the `contenteditable` itself. Milkdown is headless, so the prose styling lives here
 * as Tailwind arbitrary variants over the elements the allowlist can produce — headings, lists,
 * links, block quotes. Anything not in that list has no rule because it cannot appear.
 */
const EDITOR_CLASS = [
  "min-h-96 outline-none",
  "[&_p]:my-2.5 [&_p]:leading-relaxed",
  "[&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:font-heading [&_h1]:text-xl [&_h1]:font-semibold",
  "[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold",
  "[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:font-heading [&_h3]:text-base [&_h3]:font-semibold",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
  "[&_strong]:font-semibold",
  "[&_ul]:my-2.5 [&_ul]:list-disc [&_ul]:pl-6",
  "[&_ol]:my-2.5 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_li]:my-1",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
  "[&_hr]:my-6 [&_hr]:border-border",
].join(" ");

/**
 * The editor, wrapped in its provider and a bordered surface. Give it a React `key` of the Story id
 * at the call site: `initialBody` is read once at creation, so a different Story needs a remount,
 * not a prop change.
 */
export function StoryEditor(props: { initialBody: string; onChange: (markdown: string) => void }) {
  return (
    <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm focus-within:border-ring">
      <MilkdownProvider>
        <StoryEditorInner {...props} />
      </MilkdownProvider>
    </div>
  );
}
