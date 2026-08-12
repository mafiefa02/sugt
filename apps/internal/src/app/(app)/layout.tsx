import { AppShell } from "-/components/app-shell";
import type { Role } from "@sugt/domain";

/**
 * Everything a signed-in person reaches sits in this group, so it is where the shell
 * goes. Masuk stays outside it — a sign-in screen with a sidebar offers navigation to
 * someone who cannot navigate yet.
 *
 * The two values below are a placeholder. Knowing who is asking is issue #24, and
 * until it lands the shell is fed a literal rather than a session. Change `role` to
 * `"Teaching Team"` to see the Perjadin Report and Cerita links leave the sidebar.
 */
const PLACEHOLDER_ROLE: Role = "Staff";
const PLACEHOLDER_NAME = "Rani Nurhaliza";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      role={PLACEHOLDER_ROLE}
      personName={PLACEHOLDER_NAME}
    >
      {children}
    </AppShell>
  );
}
