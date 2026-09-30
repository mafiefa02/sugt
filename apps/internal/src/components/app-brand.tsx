import { cn } from "@sugt/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";

import logomark from "../../public/logomark-sekolah-garuda.png";

/**
 * The shell's brand: the Sekolah Garuda **logomark** beside the "SUGT ITB Internal" wordmark,
 * both one link home (#358). One element shared by the expanded desktop sidebar header
 * (`SidebarHeader`) and the phone top bar (`AppShellMobileBar`), so the wordmark lives in one place.
 * `Logomark` is the mark alone, which the collapsed rail's expand button shows (#359) — exported
 * from here so the logo import lives in one place too.
 *
 * The logomark is the mark the favicon shows. `app/icon.svg` is not a real vector — it wraps a
 * 971×978 PNG as base64 — so that PNG was extracted into `public/logomark-sekolah-garuda.png` and is
 * imported here, rather than the favicon file being referenced: the favicon is Next's metadata file,
 * and `next/image` sizes and serves a static import properly.
 */
function AppBrand() {
  return (
    <Link
      href="/"
      className="flex min-w-0 items-center gap-2.5"
    >
      <Logomark
        alt="Sekolah Garuda"
        className="shrink-0"
      />
      <span className="truncate text-sm font-medium text-muted-foreground">SUGT ITB Internal</span>
    </Link>
  );
}

/** The logomark alone, 28px square. `alt` is the caller's: empty where a label names the control. */
function Logomark({ alt, className }: { alt: string; className?: string }) {
  return (
    <Image
      src={logomark}
      alt={alt}
      className={cn("size-7", className)}
      priority
    />
  );
}

export { AppBrand, Logomark };
