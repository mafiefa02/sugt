Primary action control for SUGT — use for any button, in both the public site and the internal tool.

```jsx
<Button>Simpan</Button>
<Button variant="outline">Batal</Button>
<Button variant="destructive">Batalkan Sesi</Button>
<Button size="sm" variant="secondary">Filter</Button>
<Button size="icon" variant="ghost"><SearchIcon /></Button>
```

Variants: `default` (brick-red, primary action), `outline` (bordered, secondary), `secondary` (light gray fill), `ghost` (no chrome until hover), `destructive` (tinted-red, e.g. cancelling a Session), `link` (inline text link).
Sizes: `default` (h-32px), `xs`, `sm`, `lg`, and square `icon` / `icon-xs` / `icon-sm` / `icon-lg`.
Notes: corners are rounded (driven by `--radius`). Hover fades opacity/tint; pressing nudges down 1px. Icons render at 16px (12px on `xs`). Pair with Lucide icons.
