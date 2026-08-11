# `@sugt/db`

The schema, the migrations and the connection. Supabase Postgres; both apps deploy to
Vercel.

`docs/data-model.md` is the document this package is a translation of — read it for why
anything is shaped the way it is. This file covers only how to run it.

## `@sugt/public` must never declare this package

AGENTS.md rule 1, and the mechanism behind
[ADR-0002](../../docs/adr/0002-two-apps-in-a-pnpm-workspace.md): pnpm's strict symlinked
`node_modules` is what makes "internal narrative cannot reach a public page" a fact about
the dependency graph rather than a convention held by code review. The public app reads
the aggregates endpoint and holds no credentials of any kind.

## Two URLs, not interchangeable

| Variable       | Supavisor mode | Port | Used by                                |
| -------------- | -------------- | ---- | -------------------------------------- |
| `DATABASE_URL` | transaction    | 6543 | the apps at runtime                    |
| `DIRECT_URL`   | session        | 5432 | `db:generate`, `db:migrate`, `db:seed` |

Both resolve to IPv4. The transaction pooler cannot run migrations, and it does not
support prepared statements — hence `prepare: false` in `src/client.ts`, which is not
optional and whose absence fails intermittently under load rather than at startup.

`DATABASE_URL` is declared in `turbo.json` under `build`, `typecheck` and `dev`, because
turbo runs with `envMode: strict` and a variable missing from the consuming task's `env`
is invisible even when it is set in the shell. `DIRECT_URL` is deliberately _not_ there:
drizzle-kit is invoked as a package script, outside turbo.

## Scripts

```sh
pnpm --filter @sugt/db db:generate   # diff src/schema against the last snapshot
pnpm --filter @sugt/db db:migrate    # apply pending migrations
pnpm --filter @sugt/db db:seed       # Provinces, 4 Clusters, 42 Schools (idempotent)
```

## Two things drizzle-kit cannot express

Both are hand-written migrations. drizzle-kit leaves them alone because they are not in
its snapshot under `migrations/meta/` — verified by generating again with the schema
unchanged and getting _"No schema changes, nothing to migrate"_.

- **`0001_deferred_pic_membership.sql`** — the `DEFERRABLE INITIALLY DEFERRED` foreign
  key putting the PIC inside their own Group. drizzle-orm has `deferrable` on
  transactions but not on foreign keys. It must be deferred: `perjadin` and its
  `group_member` rows are inserted in one transaction and neither can go first.
- **`0002_link_better_auth_user_to_person.sql`** — `better_auth.user.person_id` and its
  cross-schema foreign key. **Run the Better Auth CLI migration first**; the file guards
  on that and raises a sentence rather than a missing-relation error.

Better Auth's four tables are not declared in `src/schema/`. Declaring them would make
drizzle-kit and the Better Auth CLI fight over the same DDL. Only the `better_auth`
schema itself is declared, so drizzle-kit creates it.

## Verified, not assumed

The generated migration was applied to a real Postgres alongside `docs/data-model.md`'s
own SQL, and the two catalogs compared — every column, CHECK, foreign key, unique
constraint and index. **239 entries each, identical** apart from constraint names, which
Drizzle auto-generates. The 58-check invariant suite then ran against the Drizzle-built
database and passed.

Worth keeping that habit: this schema's rules live in composite foreign keys and CHECK
constraints, and a silently-dropped one looks exactly like a working schema until the day
it doesn't.

## No queries yet

[ADR-0011](../../docs/adr/0011-supabase-and-better-auth.md) puts the money choke point
here — every money-reading query taking the authenticated Person and refusing a non-Staff
caller. There is no Person-resolution layer until the internal app exists, so a guard
written now would have no caller and an invented signature. It arrives with the app.
