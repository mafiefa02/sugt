"use client";

import {
  type CmdKey,
  Editor,
  defaultValueCtx,
  editorViewCtx,
  editorViewOptionsCtx,
  rootCtx,
} from "@milkdown/kit/core";
import { history } from "@milkdown/kit/plugin/history";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { type EditorState, TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { callCommand } from "@milkdown/kit/utils";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "@milkdown/react";
import { storyEditorAllowlist, storyToolbar } from "@sugt/story-format/allowlist";
import { Button } from "@sugt/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@sugt/ui/components/dialog";
import { Input } from "@sugt/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sugt/ui/components/select";
import type { LucideIcon } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import {
  type HeadingValue,
  type ToggleState,
  type ToolbarState,
  deriveToolbarState,
} from "./toolbar-state";

/**
 * **The Story body editor — the WYSIWYG surface ADR-0015 settles on.**
 *
 * Milkdown, built on ProseMirror and remark, so Markdown is the document model rather than a
 * serialiser bolted onto a rich-text one — the round trip is lossless by construction. The schema
 * is `storyEditorAllowlist` and nothing else: a mark the list omits cannot be typed, pasted, or
 * loaded into the body. Photographs are never here; they are the Dokumentasi gallery.
 *
 * Formatting is visual, not syntax: the toolbar above the prose, the mark keymaps (`mod-b`/`mod-i`),
 * and the input rules (`## `, `- `, `> `) are three doors to the same commands. Staff describe a
 * school visit; they do not learn Markdown. The toolbar's controls are bound to the allowlist's
 * command values (see `@sugt/story-format/allowlist`) and reflect the caret through the pure
 * `EditorState → ToolbarState` function in `toolbar-state.ts`.
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

  // The toolbar's state is derived here — inside the provider, where the editor lives — and passed
  // down. The derivation is registered on the `listener` plugin at config time, so it is tied to the
  // editor's own lifecycle and needs no un-subscribe (the `ListenerManager` offers none). `mounted`
  // seeds it; `updated`/`selectionUpdated` track typing and caret moves. The one thing they miss is a
  // stored-mark toggle on a collapsed caret (bold with no selection changes neither doc nor
  // selection), so the toolbar re-derives after every dispatch as well.
  const [toolbarState, setToolbarState] = useState<ToolbarState>(INITIAL_TOOLBAR_STATE);

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
        const refresh = (context: typeof ctx) => {
          // `selectionUpdated` fires **synchronously while the `EditorView` is still being
          // constructed**, and at that instant `editorViewCtx` still holds Milkdown's default
          // `{}` stub — its `state` is `undefined` at runtime, though the type says `EditorState`.
          // `deriveToolbarState` dereferences `state.schema`, so handing it the stub throws
          // "can't access property schema, state is undefined". Skip the update until the real
          // view resolves; the `mounted`/`updated` events that follow refresh the toolbar
          // correctly, and `deriveToolbarState` keeps its non-null contract. (#118)
          const state = context.get(editorViewCtx).state as EditorState | undefined;
          if (state === undefined) return;
          setToolbarState(deriveToolbarState(state));
        };
        ctx
          .get(listenerCtx)
          .mounted(refresh)
          .updated(refresh)
          .selectionUpdated(refresh)
          .markdownUpdated((_ctx, markdown, previous) => {
            if (markdown !== previous) onChangeRef.current(markdown);
          });
      })
      .use(listener)
      .use(history)
      .use(storyEditorAllowlist),
  );

  return (
    <>
      <StoryToolbar
        state={toolbarState}
        onStateChange={setToolbarState}
      />
      <Milkdown />
    </>
  );
}

/** The state shown before the editor has mounted: a plain paragraph, everything else off. */
const INITIAL_TOOLBAR_STATE: ToolbarState = {
  strong: { active: false, disabled: false },
  emphasis: { active: false, disabled: false },
  bulletList: { active: false, disabled: false },
  orderedList: { active: false, disabled: false },
  blockquote: { active: false, disabled: false },
  heading: { value: "paragraph", disabled: false },
  link: { active: false, href: null, disabled: true },
};

/** The heading `Select`'s label for a block type — including the H1 the list deliberately omits. */
function headingLabel(value: HeadingValue): string {
  if (value === null) return "Campuran";
  if (value === "paragraph") return "Paragraf";
  return `Judul ${value.slice(1)}`;
}

/** The seven controls, left to right: heading Select, bold, italic, bullet, ordered, quote, link. */
const TOOLBAR_CONTROL_COUNT = 7;

/** The five icon buttons that dispatch a payload-less command, paired with the state they reflect. */
type SimpleButton = {
  spec: { command: { key: CmdKey<unknown> }; icon: LucideIcon; label: string; hint: string };
  toggle: ToggleState;
  index: number;
};

/**
 * **The formatting toolbar.** Seven controls, one Tab stop, bound to the allowlist's command values.
 *
 * It reads the editor through `useInstance` (the reason it must sit inside `MilkdownProvider`) to
 * *dispatch*; the caret state it *reflects* is derived by the parent and arrives as `state`.
 *
 * **The blur trap.** A mousedown on a control would blur the `contenteditable` and collapse the
 * selection before the command ran — the feature would look finished and do nothing. So every
 * control that acts on a range calls `preventDefault` on `onMouseDown`, keeping focus in the editor.
 * The heading `Select` is the one exception: `preventDefault` there fights Base UI's own press
 * handling, and it does not need it — `setBlockType`/`turnIntoText` act on the caret's block, which
 * survives a collapse, and the editor is refocused after.
 */
function StoryToolbar({
  state,
  onStateChange,
}: {
  state: ToolbarState;
  onStateChange: (state: ToolbarState) => void;
}) {
  const [loading, getEditor] = useInstance();
  // Roving tabindex: one Tab stop for the whole bar, arrows move within it. `roving` is the index
  // (0–6, left to right) whose control carries `tabIndex={0}`; the rest are `-1`.
  const [roving, setRoving] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);

  function run<P>(key: CmdKey<P>, payload?: P) {
    if (loading) return;
    getEditor().action((ctx) => {
      callCommand(key, payload)(ctx);
      const view = ctx.get(editorViewCtx);
      view.focus();
      onStateChange(deriveToolbarState(view.state));
    });
  }

  function applyHeading(value: string) {
    if (loading) return;
    getEditor().action((ctx) => {
      if (value === "paragraph") callCommand(storyToolbar.heading.toParagraph.key)(ctx);
      else callCommand(storyToolbar.heading.toHeading.key, Number(value.slice(1)))(ctx);
      const view = ctx.get(editorViewCtx);
      view.focus();
      onStateChange(deriveToolbarState(view.state));
    });
  }

  function submitLink(href: string) {
    if (loading) return;
    getEditor().action((ctx) => {
      // A caret or selection already on a link updates its href; otherwise mark the selection fresh.
      if (state.link.active) callCommand(storyToolbar.link.update.key, { href })(ctx);
      else callCommand(storyToolbar.link.toggle.key, { href })(ctx);
      onStateChange(deriveToolbarState(ctx.get(editorViewCtx).state));
    });
    setLinkOpen(false);
  }

  function removeLink() {
    if (loading) return;
    getEditor().action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const range = linkRange(view);
      if (range) {
        // `toggleMark` on a collapsed caret only touches `storedMarks`, so the link's own range must
        // be selected first; toggleLink then finds the range wholly marked and removes it — keeping
        // Remove bound to an allowlist command value rather than a raw `removeMark`.
        view.dispatch(
          view.state.tr.setSelection(TextSelection.create(view.state.doc, range.from, range.to)),
        );
        callCommand(storyToolbar.link.toggle.key)(ctx);
      }
      onStateChange(deriveToolbarState(ctx.get(editorViewCtx).state));
    });
    setLinkOpen(false);
  }

  // Arrow keys move the single Tab stop across the enabled controls; a disabled control is skipped
  // because it cannot hold focus.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    const home = event.key === "Home";
    const end = event.key === "End";
    if (!forward && !back && !home && !end) return;
    event.preventDefault();

    const count = TOOLBAR_CONTROL_COUNT;
    const enabled = (index: number) => {
      const element = refs.current[index];
      return element != null && !element.disabled;
    };

    let next = roving;
    if (home) {
      next = 0;
      while (next < count && !enabled(next)) next += 1;
    } else if (end) {
      next = count - 1;
      while (next >= 0 && !enabled(next)) next -= 1;
    } else {
      const step = forward ? 1 : -1;
      for (let i = 0; i < count; i += 1) {
        next = (next + step + count) % count;
        if (enabled(next)) break;
      }
    }
    if (next >= 0 && next < count && enabled(next)) {
      setRoving(next);
      refs.current[next]?.focus();
    }
  }

  const setRef = (index: number) => (element: HTMLButtonElement | null) => {
    refs.current[index] = element;
  };

  const simpleButtons: SimpleButton[] = [
    { spec: storyToolbar.bold, toggle: state.strong, index: 1 },
    { spec: storyToolbar.italic, toggle: state.emphasis, index: 2 },
    { spec: storyToolbar.bulletList, toggle: state.bulletList, index: 3 },
    { spec: storyToolbar.orderedList, toggle: state.orderedList, index: 4 },
    { spec: storyToolbar.blockquote, toggle: state.blockquote, index: 5 },
  ];

  const LinkIcon = storyToolbar.link.icon;
  const linkDisabledHint = "Pilih teks dulu untuk menautkan";

  return (
    <div
      role="toolbar"
      aria-label="Format teks"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className="sticky top-0 z-10 -mx-4 -mt-3 mb-2 flex flex-wrap items-center gap-1 rounded-t-lg border-b border-border bg-background px-4 py-2"
    >
      <Select
        value={state.heading.value}
        onValueChange={(value) => applyHeading(value as string)}
      >
        <SelectTrigger
          ref={setRef(0)}
          size="sm"
          aria-label="Gaya paragraf"
          disabled={state.heading.disabled}
          tabIndex={roving === 0 ? 0 : -1}
          className="min-w-28"
        >
          {/*
            Function child, not `items`: it renders whatever the caret's block is — including "Judul 1"
            for an existing `# ` heading the list deliberately omits — without Base UI ever resolving
            the value against the item list. See the PR notes for why this is the H1 answer.
          */}
          <SelectValue>{(value) => headingLabel(value as HeadingValue)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="paragraph">Paragraf</SelectItem>
          <SelectItem value="h2">Judul 2</SelectItem>
          <SelectItem value="h3">Judul 3</SelectItem>
        </SelectContent>
      </Select>

      {simpleButtons.map(({ spec, toggle, index }) => {
        const Icon = spec.icon;
        return (
          <Button
            key={spec.label}
            ref={setRef(index)}
            type="button"
            variant={toggle.active ? "secondary" : "ghost"}
            size="icon-xs"
            aria-label={spec.label}
            aria-pressed={toggle.active}
            title={spec.hint}
            disabled={toggle.disabled}
            tabIndex={roving === index ? 0 : -1}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(spec.command.key)}
          >
            <Icon />
          </Button>
        );
      })}

      <Button
        ref={setRef(6)}
        type="button"
        variant={state.link.active ? "secondary" : "ghost"}
        size="icon-xs"
        aria-label={storyToolbar.link.label}
        aria-pressed={state.link.active}
        title={state.link.disabled ? linkDisabledHint : storyToolbar.link.hint}
        disabled={state.link.disabled}
        tabIndex={roving === 6 ? 0 : -1}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setLinkOpen(true)}
      >
        <LinkIcon />
      </Button>

      <StoryLinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        editing={state.link.active}
        initialHref={state.link.href ?? ""}
        onSubmit={submitLink}
        onRemove={removeLink}
      />
    </div>
  );
}

/**
 * The link dialog — URL only. It collects a href and reports it; the toolbar owns the editor and
 * does the dispatch. `editing` (the caret sits on a link) swaps Simpan for Perbarui and offers Hapus.
 * Collecting link *text* so a link can be inserted from an empty selection is a follow-up, not this.
 */
function StoryLinkDialog({
  open,
  onOpenChange,
  editing,
  initialHref,
  onSubmit,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  initialHref: string;
  onSubmit: (href: string) => void;
  onRemove: () => void;
}) {
  const [href, setHref] = useState(initialHref);
  // Reseed the field each time the dialog opens on a (possibly different) link.
  useEffect(() => {
    if (open) setHref(initialHref);
  }, [open, initialHref]);

  const trimmed = href.trim();
  const valid = trimmed !== "";

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Tautan</DialogTitle>
          <DialogDescription>Tempel URL. Teks yang dipilih akan menjadi tautan.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) onSubmit(trimmed);
          }}
        >
          <Input
            type="url"
            inputMode="url"
            autoFocus
            aria-label="Alamat tautan"
            placeholder="https://contoh.com"
            value={href}
            onChange={(event) => setHref(event.target.value)}
          />
          <DialogFooter>
            {editing ? (
              <Button
                type="button"
                variant="destructive"
                onClick={onRemove}
                className="sm:mr-auto"
              >
                Hapus
              </Button>
            ) : null}
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button
              type="submit"
              disabled={!valid}
            >
              {editing ? "Perbarui" : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The range of the first link mark within the selection, so Remove can select it before toggling it
 * off. It scans `from`→`to` (widening a collapsed caret by one, as `updateLinkCommand` itself does),
 * so it finds the link whether the caret sits inside one or a selection merely reaches into one.
 */
function linkRange(view: EditorView): { from: number; to: number } | null {
  const { state } = view;
  const linkType = state.schema.marks.link;
  if (!linkType) return null;
  const { from, to } = state.selection;
  let range: { from: number; to: number } | null = null;
  state.doc.nodesBetween(from, from === to ? to + 1 : to, (node, pos) => {
    if (range) return false;
    if (linkType.isInSet(node.marks)) {
      range = { from: pos, to: pos + node.nodeSize };
      return false;
    }
    return true;
  });
  return range;
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
 * not a prop change. The box keeps no `overflow-hidden`, so the toolbar's `sticky top-0` can hold
 * while a long body scrolls under it.
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
