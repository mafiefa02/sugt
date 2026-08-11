# Story bodies are Markdown, and the editor's schema is the render allowlist

`story.body` holds Markdown as `text`. The public site renders it through a strict allowlist.
The internal app authors it in a WYSIWYG editor whose document schema **is** that allowlist,
expressed once rather than twice.

## Why

[ADR-0008](./0008-public-narrative-is-authored-in-the-internal-app.md)'s second amendment puts
the authoring UI in the first release, so this format has to be chosen before anyone writes
anything. It is also the hardest thing on the map to reverse: once Staff have written thirty
Stories, changing the format means migrating prose, and prose migrations lose things quietly.

Plain text was rejected quickly — a field story will want a link and a subheading, and denying
both makes the tool worse than the email it replaced. Structured blocks were rejected because
they mean building an editor before anyone has written a Story, and the thing blocks would exist
to solve here — images, placed and ordered — is already solved: `story_photo` carries `position`
and a caption, with the first photograph as the cover. Markdown parses into blocks later if it
ever needs to. The reverse does not hold.

**Staff are not developers, so the editing surface is WYSIWYG.** That combination — Markdown
storage, visual editing — is where this decision earns an ADR rather than a line in
`data-model.md`, because it has a failure mode that is invisible until it has happened a hundred
times.

## The constraint, stated because it is the whole decision

**Anything the editor can produce that the allowlist strips is content silently lost on publish.
Anything the allowlist permits that the editor cannot express is content a hand-edit can smuggle
onto the public site.** So the editor's capabilities and the renderer's allowlist are not two
lists that agree today. They are one list, defined once.

That is a property of how the editor is built, not a rule anyone can follow reliably. An editor
whose document model is a **declared schema** — rather than whatever a `contenteditable` happened
to produce — makes the constraint structural: the schema is the allowlist, and a mark that is not
in it cannot be created in the first place.

## Considered options

- **Tiptap.** The obvious choice, ProseMirror underneath, and its core is MIT. Rejected because
  its Pro extensions, UI components and templates are commercially licensed, so "is this still
  free" becomes a question that has to be re-answered every time the editor grows a feature.
- **A raw Markdown textarea with a preview.** Cheapest, and the constraint above is trivially
  satisfied. Rejected: the people writing Stories are Staff describing a school visit, and
  asking them to learn syntax is how the publishing bottleneck ADR-0008 exists to prevent comes
  back in another form.
- **A rich-text editor with a Markdown export step.** Rejected on the constraint: the export is
  a translation layer, and translation layers are exactly where the two lists drift apart.

**Milkdown** is what this settles on — MIT throughout with no paid tier, built on ProseMirror
**and remark**, so Markdown is its document model rather than a serialiser bolted onto a
rich-text one. The round trip is lossless by construction rather than by care.

## Consequences

- The editor lives in `apps/internal/src/components`, **not `@sugt/ui`**. Only one app has an
  editor; `AGENTS.md` says an app owns what only it uses; and a dependency this size in
  `@sugt/ui` lands in `@sugt/public`'s dependency graph too, for a package
  [ADR-0010](./0010-one-shared-ui-package-not-shadcn-per-app.md) keeps deliberately thin.
- The public site needs a Markdown renderer configured from the same list. If the two ever have
  to be configured separately, that is the signal this decision has been broken.
- Nothing in the database enforces the format. `body` is `text`, and a direct insert can put
  anything in it — which is the same honesty the rest of `data-model.md` applies to rules the
  application holds.
- A Story is authored for publication and no internal record is ever a source for one. That wall
  is [ADR-0001](./0001-public-site-reads-aggregates-only.md)'s and is untouched by anything here.
