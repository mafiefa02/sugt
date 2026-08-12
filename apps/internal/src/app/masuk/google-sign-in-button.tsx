"use client";

import { authClient } from "-/lib/auth-client";
import { Button } from "@sugt/ui/components/button";
import { useState } from "react";

/**
 * The one button.
 *
 * **`errorCallbackURL` is not optional.** It is what sends a rejected visitor back to
 * this page instead of Better Auth's built-in error page, and that one decision solves
 * three problems at once: the built-in page validates the error code against
 * `/^['A-Za-z0-9_-]+$/` and renders `UNKNOWN` on anything else, so the Indonesian
 * sentence — which has two full stops — would never reach a reader; a thrown message
 * arrives with its spaces turned into underscores, which is not prose anybody should
 * be shown; and the copy belongs in the app, in Indonesian, beside the rest of it.
 */
export function GoogleSignInButton() {
  const [pending, setPending] = useState(false);

  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signIn.social({
          provider: "google",
          callbackURL: "/",
          errorCallbackURL: "/masuk",
        });
      }}
    >
      {pending ? "Menghubungkan…" : "Masuk dengan Google"}
    </Button>
  );
}
