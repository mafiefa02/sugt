import { Band } from "-/components/band";
import Link from "next/link";

/**
 * **404 — a page that is not here.**
 *
 * Rendered inside the shell (the root layout wraps every route, this one included), so the header and
 * footer stay. It reaches for the surfaces a lost visitor most likely wanted rather than dead-ending.
 * A withdrawn Story, a stale link or a mistyped slug all land here.
 */
export default function NotFound() {
  return (
    <Band className="py-24">
      <p className="font-heading text-sm font-semibold text-muted-foreground">404</p>
      <h1 className="mt-2 font-heading text-4xl font-bold tracking-tight">
        Halaman tidak ditemukan
      </h1>
      <p className="mt-3 max-w-xl text-lg text-muted-foreground">
        Tautannya mungkin sudah berubah atau halamannya tidak pernah ada.
      </p>
      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
        <Link
          href="/"
          className="text-foreground hover:underline"
        >
          Beranda
        </Link>
        <Link
          href="/program"
          className="text-foreground hover:underline"
        >
          Program
        </Link>
        <Link
          href="/cerita"
          className="text-foreground hover:underline"
        >
          Cerita
        </Link>
        <Link
          href="/pencarian"
          className="text-foreground hover:underline"
        >
          Pencarian
        </Link>
      </div>
    </Band>
  );
}
