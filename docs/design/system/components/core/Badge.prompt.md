Compact status / count pill. Labels, counts, and a Session's status.

```jsx
<Badge variant="primary">3 / 10</Badge>
<Badge variant="outline">Daring</Badge>
<Badge variant="muted">Dibatalkan</Badge>
<Badge>Luring</Badge>
```

Variants: `default`, `primary`, `outline`, `muted`. Rounded corners like everything else (`--radius-md`).

**Badge no longer carries severity.** It used to hold the `on track / some concerns / struggling` pick, and that pick no longer exists — the outcome signal is a 1–10 Rating against a named Aspect. Use `<Rating>` for anything scored. A pill reading "4" is a label pretending to be a measurement.
