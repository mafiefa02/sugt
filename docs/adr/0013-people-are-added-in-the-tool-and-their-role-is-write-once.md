# People are added in the tool, and a Person's role is write-once

[ADR-0003](./0003-google-sign-in-with-an-invite-list.md) says the invite list is "maintained by hand" and leaves who and where open. It is a Staff-only People screen in the internal tool. The founding Staff rows are seeded, because the sign-up hook makes a `person` row a prerequisite for anyone getting an account at all; everyone after that is added through the screen. A Person's `role` cannot be changed once they have been used, so correcting one means revoking the row and adding a new one — and setting `active = false` has to be **read** in more places than the signup hook, or somebody who has signed in once keeps signing in.

## Why a screen and not a seed file

Schools, Clusters and Topics have no admin screens because they are fixed reference data — [`product.md`](../product.md) is explicit, and [`data-model.md`](../data-model.md) scopes the rule the same way. **People are not reference data.** The Teaching Team roster grows as professors are recruited, and `active = false` is a revocation that happens on a Tuesday for a reason nobody planned for.

Maintaining `person` in an authored seed file the way `reference-data.sql` maintains Schools would make every new professor a commit and a deploy by the single developer. That is precisely the publishing bottleneck [ADR-0008](./0008-public-narrative-is-authored-in-the-internal-app.md) exists to prevent, applied to people instead of photographs.

## Why the first rows are still seeded

There is no way around this. `data-model.md` gives Better Auth a `databaseHooks.user.create.before` hook that throws when an email has no `person` row, so **an uninvited Google account cannot create a user row at all**. That is the mechanism ADR-0003 relies on, and it means nobody can sign in to reach the People screen until a Person already exists.

So the bootstrap is a seeded row — the founding Staff — and nothing else. The seed exists to break the cycle, not as an ongoing channel. A Person added by editing SQL after that is a Person the screen did not validate.

## Why role is write-once

Not a policy — the database already enforces it, and nobody had written that down. `group_member`, `session_teacher`, `class_record`, `session_record`, `perjadin.pic_person_id` and `session.online_pic_person_id` all reference `person (id, role)`, the composite key that makes "the PIC is Staff" and "only Teaching Team taught a Stream" declarative rather than trigger code. None of the six declares `on update`, so they default to `NO ACTION` and Postgres refuses to change `person.role` the moment a Person has been on a trip, taught a Stream, filed a record or been named PIC of an online Session.

Adding `on update cascade` was considered and is wrong on its own terms. It would rewrite history — a past Perjadin would come to claim a Staff member taught a Stream — and it fails anyway on the row that matters most, because `session_teacher.person_role` is pinned to `'Teaching Team'` by a CHECK the cascade cannot satisfy.

**So a wrong role is corrected by revoking the row and creating a new Person.** The old row keeps every historical reference intact and truthful: that Perjadin really did carry them as Teaching Team. The People screen says role is fixed after first use rather than offering an edit that the database will reject.

## What this costs: the email index becomes partial

Revoke-and-re-add means two rows share an email, which the original `unique on (lower(email))` across all rows rejects. It becomes partial:

```sql
create unique index person_email_key on person (lower(email)) where active;
```

At most one **active** Person per email, any number of revoked ones — the same partial-index trick already holding `session_one_per_school_per_perjadin`. Two consequences worth stating:

- The sign-up hook's lookup becomes `where lower(email) = $1 and active`, and is unambiguous by construction rather than by convention.
- A revoked person who has **never signed in** can no longer create an account, because the hook finds nothing.

## Revocation needs enforcing on every request, and `active` is the whole mechanism

_Amended while the auth work was built. This section first said revocation went through Better Auth's **admin plugin** and its ban. The problem below is unchanged and still correct; the answer is not, and the plugin is dropped._

The point above is as far as `active = false` reaches on its own, and it is much less far than it looks. `databaseHooks.user.create.before` fires **before a user row is created** — Better Auth's own documentation files this hook under `signup_disabled`. A returning sign-in creates a _session_, not a user, so the hook never runs again. `data-model.md` was right that the invite list "gates signup, not merely authorisation"; the corollary nobody had drawn is that **anyone who has signed in once keeps signing in after being revoked.**

That was tolerable when the internal tool held only delivery records. It is not now: the invite list gates a Staff-only publishing surface that writes the public site.

The plugin was chosen because nothing checked revocation _per request_. Something does now. **`requirePerson()` reads `person.active` on every request** and refuses when it is false — and the argument for why that is free was already in this ADR: every request resolves the Person in order to read `role`, so the row is being fetched regardless and one more column off it costs nothing.

So there is **one authority and no second state to keep in step**: `person.active`, read at three points.

- `databaseHooks.user.create.before` — the invite gate. No active Person, no `user` row.
- `databaseHooks.session.create.before` — the same lookup at sign-in, which is what keeps "no new session" true for a revoked Person who already has a `user` row.
- `requirePerson()` — every request thereafter, including one they are already mid-session for.

A revoked Person's existing session row survives until it expires. Nothing deletes it, and nothing needs to: every request re-reads `active` and is refused. **Revocation is one write**, so there is no half-failed state for the People screen to design for.

`active = false` does not mean "off the Programme but still allowed to read" — that would be a third role, and [`product.md`](../product.md) says there are two.

## Consequences

- One more screen in the internal tool, Staff-only for writes. Reads follow [ADR-0004](./0004-delivery-data-is-open-internally-money-is-not.md)'s open-delivery rule: anyone signed in can see the roster, because a Group is assembled from it.
- A migration to make `person_email_key` partial.
- The founding-Staff seed is a real artefact someone has to write and keep out of the reference-data seed, which is about fixed facts and re-run freely.
- **No plugin joins the stack.** Revocation is one write. _(Amended: this read "Better Auth's admin plugin joins the stack" and budgeted for the four columns it adds — `role`, `banned`, `banReason`, `banExpires` on `user` and `impersonatedBy` on `session`. None of them exists, so neither does the `role` collision beside write-once `person.role` that the plugin's schema mapping was going to rename away.)_
- **A second `databaseHooks` entry instead**, on `session.create.before`, making the same lookup as the invite hook. Two enforcement points in the library, one authority in our own table.
- **Revocation is immediate by construction, and `session.cookieCache` is no longer what makes it so.** _(Amended.)_ `person` is our table, not Better Auth's, so the `active` lookup on every request is a fresh read whatever the library's session cache does. Cookie caching stays off — it is the default and the performance case for turning it on is weak, since every request already resolves the Person in order to read `role` — but nothing about revocation now depends on that.
