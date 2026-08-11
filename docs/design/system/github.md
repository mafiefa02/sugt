repo: mafiefa02/sugt
branch: main
url: https://github.com/mafiefa02/sugt

## Last sync

date: 2026-08-11T00:00:00Z
source: local codebase folder "sugt" attached to the project (not read over the GitHub API, so no commit sha is known)

### Updated in this project
- Ported the theme (shadcn base-rhea, oklch) into `tokens/` and the sole real component (`Button`) into `components/core/`.
- Added Card / Badge / Input as flagged intentional additions to render the product surfaces.
- Built public + internal UI kits from `docs/product.md` (the repo apps are placeholders).

## Screen map

| Project screen | Built from |
| --- | --- |
| tokens/*.css | packages/ui/src/styles/globals.css |
| components/core/Button.* | packages/ui/src/components/button.tsx |
| components/core/{Card,Badge,Input}.* | intentional additions, styled to base-rhea (no source component) |
| ui_kits/public/ | docs/product.md ("The public site"), apps/public/src/app/layout.tsx |
| ui_kits/internal/ | docs/product.md ("The internal tool", Coverage / Concerns / acquittal) |
| guidelines/*.card.html | packages/ui/src/styles/globals.css, CONTEXT.md, docs/product.md |
