"use client";

import { authClient } from "-/lib/auth-client";
import { Button } from "@sugt/ui/components/button";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * One control that ends the session and returns to `/masuk`. The endpoint came free
 * with the mounted handler; this is the button.
 *
 * An icon button, labelled "Keluar" for a screen reader, at the right end of the sidebar's
 * profile row (#358), where a text button crowded the name beside it — and on the collapsed rail,
 * beneath the avatar (#359).
 */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Keluar"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.push("/masuk");
        router.refresh();
      }}
    >
      <LogOut />
    </Button>
  );
}
