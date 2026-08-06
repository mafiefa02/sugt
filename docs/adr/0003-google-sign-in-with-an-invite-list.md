# Google sign-in with an invite list, not ITB SSO

The internal tool authenticates Staff and Teaching Team via Google sign-in, restricted to an explicit invite list. It does not use ITB's institutional identity provider.

## Why

The site runs on a domain we own rather than an `itb.ac.id` subdomain, so no institutional identity policy applies and the choice is genuinely ours. Given that, Google sign-in wins on two counts: the Teaching Team is not guaranteed to be entirely ITB account holders, and an SSO integration would land on a university IT department's schedule rather than ours.

## Consequences

- The invite list is maintained by hand; someone owns adding and removing people.
- Identity is a Google account, not an ITB one, so a person leaving ITB does not automatically lose access.
