import { LinkButton } from "@sugt/ui/components/link-button";
import Link from "next/link";

/**
 * What `forbidden()` renders, at HTTP **403**.
 *
 * It sits at the app root rather than inside `(app)` so that a route handler and a
 * Server Action reach it too — neither runs under the signed-in layout, and the
 * choke point exists precisely because a layout does not gate a write.
 *
 * The copy says the screen is Staff-only and stops. Reaching this is a bug or an
 * attack rather than a user state: money surfaces are **absent** for a Teaching Team
 * member, not offered and refused, so there is nothing here for them to do
 * differently and a page that suggested otherwise would be inventing a workflow.
 */
export default function Forbidden() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <div>
        <h1 className="font-heading text-lg font-medium">Layar ini khusus Staff DITSAMA.</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Data keuangan hanya terbuka untuk Staff. Hubungi tim DITSAMA jika Anda perlu akses.
        </p>
      </div>
      <LinkButton
        render={<Link href="/" />}
        variant="outline"
      >
        Kembali ke Dashboard
      </LinkButton>
    </main>
  );
}
