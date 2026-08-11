# Google sign-in with an invite list, not ITB SSO

The internal tool authenticates Staff and Teaching Team via Google sign-in, restricted to an explicit invite list. It does not use ITB's institutional identity provider.

## Why

The site runs on a domain we own rather than an `itb.ac.id` subdomain, so no institutional identity policy applies and the choice is genuinely ours. Given that, Google sign-in wins on two counts: the Teaching Team is not guaranteed to be entirely ITB account holders, and an SSO integration would land on a university IT department's schedule rather than ours.

## The gate is two-tier, and the invite list is both halves of it

Staff sign in with an `@ditsama.itb.ac.id` Google account; Teaching Team members sign in with whatever Google account they have. **A `person` row is required either way** — the domain check on the email is an additional assertion for Staff, never a replacement for the list.

Stated because the design prototype had it the other way round, gating sign-in on the domain alone. That would exclude exactly the people the paragraph above chose Google for: a professor without an ITB account could not sign in at all, and Class Records are the largest single source of data in the system.

## Consequences

- The invite list is maintained by hand; someone owns adding and removing people. Where and by whom is settled in [ADR-0013](./0013-people-are-added-in-the-tool-and-their-role-is-write-once.md): a Staff-only People screen in the internal tool, with the founding rows seeded because nobody can sign in to reach it otherwise.
- **An uninvited account and a revoked Person are shown the same message.** Telling somebody they were specifically removed is a conversation for a human rather than a login screen, and keeping the two indistinguishable is also the right property against a stranger probing the form. The rejection is a thrown `APIError` from the signup hook, so the string arrives back as a query parameter and has to survive being underscored.
- Identity is a Google account, not an ITB one, so a person leaving ITB does not automatically lose access.
