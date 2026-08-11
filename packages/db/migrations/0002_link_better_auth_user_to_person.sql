-- Link a sign-in identity to a Person.
--
-- RUN ORDER: this needs `better_auth.user` to exist, which the **Better Auth CLI**
-- creates, not drizzle-kit. Run the Better Auth migration first. The guard below turns
-- "ran too early" into a sentence instead of a missing-relation error.
--
-- Better Auth's four core tables live in the `better_auth` schema rather than `public`
-- because its `session` would otherwise take the most load-bearing word in CONTEXT.md
-- — a teaching occasion at one School. Supabase's own `auth` schema belongs to GoTrue
-- and is owned by supabase_auth_admin, so it is not available for this.
--
-- The column is declared to Better Auth via `user.additionalFields`; the foreign key
-- is added here because the generated schema will not write a cross-schema reference.
--
-- Direction matters. The edge sits on the LIBRARY's side of the boundary, so `person`
-- references nothing it does not own and a Better Auth major version cannot ripple
-- into the domain's foreign key graph.

DO $$
BEGIN
  IF to_regclass('better_auth."user"') IS NULL THEN
    RAISE EXCEPTION
      'better_auth."user" does not exist. Run the Better Auth CLI migration before this one.';
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE better_auth."user"
  ADD COLUMN IF NOT EXISTS "person_id" uuid;
--> statement-breakpoint

ALTER TABLE better_auth."user"
  ADD CONSTRAINT "user_person_id_key" UNIQUE ("person_id");
--> statement-breakpoint

-- A signed-in user maps to at most one Person, and only to one that exists. An
-- uninvited Google account is refused earlier still, by a databaseHooks.user.create
-- .before hook that looks the Person up by lowered email and throws when there is none
-- — so the invite list gates signup, not merely authorisation.
ALTER TABLE better_auth."user"
  ADD CONSTRAINT "user_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "public"."person" ("id");
