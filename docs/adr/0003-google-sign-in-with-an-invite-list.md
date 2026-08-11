# Google sign-in with an invite list, not ITB SSO

The internal tool authenticates Staff and Teaching Team via Google sign-in, restricted to an explicit invite list. It does not use ITB's institutional identity provider.

## Why

The site runs on a domain we own rather than an `itb.ac.id` subdomain, so no institutional identity policy applies and the choice is genuinely ours. Given that, Google sign-in wins on two counts: the Teaching Team is not guaranteed to be entirely ITB account holders, and an SSO integration would land on a university IT department's schedule rather than ours.

## Consequences

- The invite list is maintained by hand; someone owns adding and removing people. Where and by whom is settled in [ADR-0013](./0013-people-are-added-in-the-tool-and-their-role-is-write-once.md): a Staff-only People screen in the internal tool, with the founding rows seeded because nobody can sign in to reach it otherwise.
- Identity is a Google account, not an ITB one, so a person leaving ITB does not automatically lose access.
