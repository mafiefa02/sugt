# Supabase for Postgres and storage, Better Auth for sign-in, and no Supabase client in the public app

[ADR-0005](./0005-postgres-for-the-invariants-not-the-scale.md) left the vendor open. It is
Supabase Pro, for the managed Postgres and the object storage, with both apps on Vercel. Sign-in
is **Better Auth** rather than Supabase Auth, access control is application code rather than RLS,
and `@sugt/public` gets no Supabase client of any kind.

## Why these three together

Supabase alone would barely be worth an ADR — Postgres is portable and nobody is surprised by
managed Postgres. What needs recording is the combination, because each part reads as a mistake
without the other two.

**Better Auth, not Supabase Auth.** Supabase Auth is the obvious choice on this vendor and it
was rejected. Better Auth keeps identity in our own tables, in our own migrations, on a library
that runs anywhere — which preserves the escape hatch [ADR-0005](./0005-postgres-for-the-invariants-not-the-scale.md)
deliberately left open when it named Turso as a fallback. Choosing Supabase Auth would have made
that fallback substantially more expensive.

**Therefore no RLS.** Supabase Auth's real asset is `auth.uid()` inside Postgres, which is what
lets policies enforce access at the row. Better Auth does not have it. Reproducing it means
`SET LOCAL` on every transaction plus a non-superuser role with `FORCE ROW LEVEL SECURITY` — a
lot of machinery for [ADR-0004](./0004-delivery-data-is-open-internally-money-is-not.md)'s single
two-role rule. So money queries take the authenticated Person and refuse a non-Staff caller, at
one choke point in `@sugt/db`.

This does not weaken [ADR-0005](./0005-postgres-for-the-invariants-not-the-scale.md). That ADR
chose a relational database for _domain_ invariants — one PIC per Perjadin, offline Sessions have
a Perjadin and online ones do not, exactly the Teaching Team members carry a Stream. Those are all
still constraints in the database, several of them composite foreign keys precisely so they need
no trigger. Access control was never among them.

**And no Supabase client in `@sugt/public`.** This is the part a future reader is most likely to
try to "fix" by installing `@supabase/supabase-js` in the public app and reading with the
publishable key. That would undo [ADR-0002](./0002-two-apps-in-a-pnpm-workspace.md), which claims
the internal-narrative leak is _unbuildable_ rather than unlikely — a claim about the dependency
graph. An anon key plus RLS converts it back into a claim about policy correctness, one wrong
policy away from publishing a Session Record. The public app keeps holding no credentials and
reading the aggregates endpoint.

A useful consequence: **no anon-role policy is ever needed anywhere**, because nothing
unauthenticated ever touches the database.

> That claim is about the anon **role**, and it still holds — but two routes now serve
> callers with no signed-in Person: the Participant Feedback handler
> ([ADR-0012](./0012-participants-write-through-a-short-lived-session-token.md)) and the
> aggregates endpoints `@sugt/public` reads (the endpoint contract in
> [ADR-0008](./0008-public-narrative-is-authored-in-the-internal-app.md)). Both go through
> the internal app's own credentials after a check — a token in the first case, a shared
> secret in the second — so neither is an anonymous database client. Worth knowing before
> reading the sentence above as "every query has a Person behind it".

## Consequences

- Better Auth's core tables (`user`, `session`, `account`, `verification`) live in a `better_auth`
  Postgres schema, not `public`. Its `session` would otherwise collide with the domain's Session —
  the most load-bearing word in `CONTEXT.md`. Supabase's own `auth` schema belongs to GoTrue and
  is not available for this.
- Sign-in is Google via Better Auth, which satisfies
  [ADR-0003](./0003-google-sign-in-with-an-invite-list.md) unchanged. The invite list is the
  `person` table; a `databaseHooks.user.create.before` hook rejects an email with no row, so an
  uninvited account cannot be created at all. That hook gates **signup only** — it does not
  fire on a returning sign-in — so revoking access additionally uses the admin plugin. See
  [ADR-0013](./0013-people-are-added-in-the-tool-and-their-role-is-write-once.md).
- Storage policies cannot identify the caller either, for the same reason RLS cannot. Receipts sit
  in a private bucket and are reached only through signed URLs the internal app mints after
  checking the caller is Staff.
- Vercel functions connect through Supavisor in transaction mode (port 6543, no prepared
  statements); migrations use session mode (port 5432).
- Two vendors to keep working rather than one, and the auth tables are ours to migrate.

The full schema is in [`docs/data-model.md`](../data-model.md).
