import Image from "next/image";
import Link from "next/link";

import logoSekolahGaruda from "../../public/logo-sekolah-garuda.png";

/**
 * The shell's brand: the Sekolah Garuda logo linking home, beside the `Internal`
 * wordmark. One element shared by the desktop sidebar header (`SidebarBody`) and the
 * phone top bar (`AppShellMobileBar`), so the wordmark and the logo import live in one
 * place rather than two.
 */
function AppBrand() {
  return (
    <>
      <Link href="/">
        <Image
          src={logoSekolahGaruda}
          alt="Sekolah Garuda"
          className="h-6 w-auto"
          priority
        />
      </Link>
      <span className="text-[10.5px] font-medium text-muted-foreground">Internal</span>
    </>
  );
}

export { AppBrand };
