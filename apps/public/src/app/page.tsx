import { SiteContainer } from "-/components/site-container";
import { Button } from "@sugt/ui/components/button";

// Placeholder. Beranda is issue #38; this page exists so the app builds and so the
// shell has a page to wrap.
export default function Home() {
  return (
    <SiteContainer className="py-16">
      <h1 className="text-4xl font-extrabold tracking-tight">Sekolah Unggul Garuda Transformasi</h1>
      <p className="mt-4 max-w-[620px] text-base leading-relaxed text-muted-foreground">
        STEM &amp; Research Track, dijalankan oleh DITSAMA ITB.
      </p>
      <Button
        size="lg"
        className="mt-8"
      >
        Lihat Program
      </Button>
    </SiteContainer>
  );
}
