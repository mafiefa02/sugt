import { SiteContainer } from "-/components/site-container";
import { SiteNav } from "-/components/site-nav";
import { ThemeToggle } from "-/components/theme-toggle";
import Image from "next/image";
import Link from "next/link";

import logoDpb from "../../public/logo-dpb-full.jpeg";
import logoSekolahGaruda from "../../public/logo-sekolah-garuda.png";

/**
 * The footer's link columns. Destinations only — each surface belongs to its own
 * ticket.
 */
const FOOTER_COLUMNS = [
  {
    heading: "Program",
    links: [
      { href: "/program", label: "Cakupan" },
      { href: "/cluster", label: "Cluster" },
      { href: "/tentang", label: "Tentang" },
    ],
  },
  {
    heading: "Cerita",
    links: [
      { href: "/cerita", label: "Lapangan" },
      { href: "/final-project", label: "Final Project" },
      { href: "/pencarian", label: "Pencarian" },
    ],
  },
] as const;

/**
 * The public site's shell: a sticky header, the page, and a footer.
 *
 * It lives in `@sugt/public` because only this app is shaped this way. `@sugt/ui`
 * holds the primitives both apps share; a shell is a composition of them that one app
 * uses, so it belongs to that app — AGENTS.md rule 4 and the split
 * `shadcn add` already writes to.
 */
function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-background">
        <SiteContainer className="flex h-16 items-center justify-between">
          <Link href="/">
            <Image
              src={logoSekolahGaruda}
              alt="Sekolah Garuda"
              className="h-[30px] w-auto"
              priority
            />
          </Link>
          <div className="flex items-center gap-2">
            <SiteNav />
            <ThemeToggle />
          </div>
        </SiteContainer>
      </header>

      <main className="flex-1">{children}</main>

      <footer>
        <SiteContainer className="flex flex-wrap justify-between gap-10 py-12">
          <div className="max-w-[300px]">
            <Image
              src={logoSekolahGaruda}
              alt="Sekolah Garuda"
              className="h-[34px] w-auto"
            />
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Sekolah Unggul Garuda Transformasi — STEM &amp; Research Track, dijalankan oleh
              DITSAMA ITB.
            </p>
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <div
              key={column.heading}
              className="flex flex-col gap-2 text-sm text-muted-foreground"
            >
              <span className="font-semibold text-foreground">{column.heading}</span>
              {column.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Penyelenggara</span>
            <Image
              src={logoDpb}
              alt="Direktorat Persiapan Bersama ITB"
              className="mt-1 mb-1.5 h-[34px] w-auto"
            />
            <span>DITSAMA ITB</span>
            <span>Kementerian Pendidikan Tinggi</span>
          </div>
        </SiteContainer>
        <div className="border-t">
          <SiteContainer className="flex justify-between py-4 text-xs text-muted-foreground">
            <span>© 2026 DITSAMA ITB</span>
            <span>Direktorat Persiapan Bersama ITB</span>
          </SiteContainer>
        </div>
      </footer>
    </>
  );
}

export { SiteShell };
