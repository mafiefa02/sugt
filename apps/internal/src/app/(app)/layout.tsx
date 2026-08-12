import { SignOutButton } from "-/components/sign-out-button";
import { getPerson } from "-/lib/person";
import { redirect } from "next/navigation";

/**
 * The signed-in tree. Everything under this layout can assume a Person.
 *
 * **This is the cheap outer gate, and it is not the last word.** There are three
 * checks and only the third cannot be bypassed:
 *
 *   1. `proxy.ts` — optimistic, cookie present or not. Never authoritative.
 *   2. This layout — authoritative for **pages**, and only for pages.
 *   3. `@sugt/db`'s choke point — the one that covers writes.
 *
 * The distinction is load-bearing rather than pedantic: **a Next.js layout does not
 * run before a Server Action.** A Server Action runs before the layout re-renders, so
 * a layout-only check protects reads and leaves every write open. The query layer is
 * what closes that, and it is a separate spec.
 *
 * It calls `getPerson()` and redirects rather than `requirePerson()` and throwing,
 * because a revoked Person arriving mid-session should land on the sign-in screen and
 * not on an error page. Everything **inside** this tree uses `requirePerson()`, where
 * a null can only come from a bug. Both share one memoised read, so the page below
 * costs no second round trip.
 */
export default async function SignedInLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const person = await getPerson();
  if (!person) redirect("/masuk");

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <span className="text-sm font-medium">SUGT</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {person.fullName} · {person.role}
          </span>
          <SignOutButton />
        </div>
      </header>
      {children}
    </>
  );
}
