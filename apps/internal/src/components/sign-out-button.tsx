"use client";

import { authClient } from "-/lib/auth-client";
import { Button } from "@sugt/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * One control that ends the session and returns to `/masuk`. The endpoint came free
 * with the mounted handler; this is the button.
 *
 * Where it eventually sits — a sidebar, an account menu — belongs to the app shell and
 * the two dashboards. A signed-in layout with no way out is not a defensible first
 * iteration, and one button is not a design.
 */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.push("/masuk");
        router.refresh();
      }}
    >
      Keluar
    </Button>
  );
}
