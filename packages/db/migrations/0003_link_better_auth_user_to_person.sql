-- Link a sign-in identity to a Person.
--
-- The column and its UNIQUE are not here. They are declared on the Drizzle table in
-- `src/schema/people.ts` and created by 0002. **Only the foreign key is hand-written**,
-- because drizzle-kit will not write a cross-schema reference — so this migration is
-- ordered after the one that creates `better_auth."user"`, and drizzle-kit leaves it
-- alone because it is not in the snapshot under `meta/`.
--
-- Better Auth's four core tables live in the `better_auth` schema rather than `public`
-- because its `session` would otherwise take the most load-bearing word in CONTEXT.md
-- — a teaching occasion at one School. Supabase's own `auth` schema belongs to GoTrue
-- and is owned by supabase_auth_admin, so it is not available for this.
--
-- Direction matters. The edge sits on the LIBRARY's side of the boundary, so `person`
-- references nothing it does not own and a Better Auth major version cannot ripple
-- into the domain's foreign key graph.
--
-- A signed-in user maps to at most one Person, and only to one that exists. An
-- uninvited Google account is refused earlier still, by a databaseHooks.user.create
-- .before hook that looks the Person up by lowered email and throws when there is none
-- — so the invite list gates signup, not merely authorisation. A revoked Person is
-- refused by a second hook on session creation, and again on every request.

ALTER TABLE better_auth."user"
  ADD CONSTRAINT "user_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "public"."person" ("id");
