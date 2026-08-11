Bordered surface container for grouped content across SUGT.

```jsx
<Card title="SMA Negeri 3 Bandung" description="Cluster Priangan Timur">
  <p>3 of 10 sessions delivered</p>
</Card>
<Card title="Advance" footer={<Button size="sm">Export</Button>}>…</Card>
```

Props: `title`, `description` (muted sub-line), `footer` (actions row), `children`. Header divider appears only when there is a body. Flat — a 1px border does the work, no shadow, rounded corners.
