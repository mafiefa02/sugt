import { STREAMS, TOTAL_SESSIONS_PER_SCHOOL } from "@sugt/domain";

// Placeholder. The internal tool ships after the public site — see
// docs/adr/0008-public-narrative-is-authored-in-the-internal-app.md. This page
// exists so the app builds, and reads @sugt/domain so the shared package is
// wired rather than merely declared.
export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-lg font-medium">SUGT Internal</h1>
      <p className="text-sm text-muted-foreground">
        {STREAMS.join(" · ")} — {TOTAL_SESSIONS_PER_SCHOOL} sesi per sekolah
      </p>
    </main>
  );
}
