import Image from "next/image";
import Link from "next/link";

import logomark from "../../public/logomark-sekolah-garuda.png";

/**
 * The shell's brand: the Sekolah Garuda **logomark** beside the "SUGT ITB Internal" wordmark,
 * both one link home (#358). One element shared by the desktop sidebar header (`SidebarBody`) and
 * the phone top bar (`AppShellMobileBar`), so the wordmark and the logo import live in one place
 * rather than two.
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
      <Image
        src={logomark}
        alt="Sekolah Garuda"
        className="size-7 shrink-0"
        priority
      />
      <span className="truncate text-sm font-medium text-muted-foreground">SUGT ITB Internal</span>
    </Link>
  );
}

export { AppBrand };
