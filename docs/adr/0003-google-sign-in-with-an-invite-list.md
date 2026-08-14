# Google sign-in with an invite list, not ITB SSO

The internal tool authenticates Staff and Teaching Team via Google sign-in, restricted to an explicit invite list. It does not use ITB's institutional identity provider.

## Why

The site runs on a domain we own rather than an `itb.ac.id` subdomain, so no institutional identity policy applies and the choice is genuinely ours. Given that, Google sign-in wins on two counts: the Teaching Team is not guaranteed to be entirely ITB account holders, and an SSO integration would land on a university IT department's schedule rather than ours.

## The gate is two-tier, and the invite list is both halves of it

Staff sign in with an `@ditsama.itb.ac.id` Google account; Teaching Team members sign in with whatever Google account they have. **A `person` row is required either way** — the domain check on the email is an additional assertion for Staff, never a replacement for the list.

Stated because the design prototype had it the other way round, gating sign-in on the domain alone. That would exclude exactly the people the paragraph above chose Google for: a professor without an ITB account could not sign in at all, and Class Records are the largest single source of data in the system.

## Consequences

> **The indistinguishability bullet below was written when a refusal was terminal in
> practice; [#77](https://github.com/mafiefa02/sugt/issues/77) made it recoverable.**
> Google now reopens the account chooser on every sign-in, so a refused visitor can offer
> a different account, and the copy reads "Coba akun lain" to say so — but the property the
> bullet pins, one Indonesian sentence for every value of `?error` and never echoed, is
> unchanged. See [Amendment: refusal is recoverable, and indistinguishability survives the
> copy change](#amendment-refusal-is-recoverable-and-indistinguishability-survives-the-copy-change).

- The invite list is maintained by hand; someone owns adding and removing people. Where and by whom is settled in [ADR-0013](./0013-people-are-added-in-the-tool-and-their-role-is-write-once.md): a Staff-only People screen in the internal tool, with the founding rows seeded because nobody can sign in to reach it otherwise.
- **An uninvited account and a revoked Person are shown the same message.** Telling somebody they were specifically removed is a conversation for a human rather than a login screen, and keeping the two indistinguishable is also the right property against a stranger probing the form. It is the same for a Staff member who reached for a personal Gmail out of habit, which is a third case and not a fourth message.

  The two rejections are thrown from **different hooks** — the invite gate at user creation, the revocation check at session creation — and both come back as a redirect carrying an `error` query parameter. What makes them indistinguishable is not that the two strings match: `/masuk` renders one Indonesian sentence for **every** value of `?error` and never echoes it. The message could not travel in that parameter anyway; it contains full stops, and Better Auth's built-in error page renders anything outside `/^['A-Za-z0-9_-]+$/` as `UNKNOWN`. So the copy stays in the app and the parameter is only ever a signal that something was refused.

- Identity is a Google account, not an ITB one, so a person leaving ITB does not automatically lose access.

## Amendment: refusal is recoverable, and indistinguishability survives the copy change

**A refusal used to be terminal in practice, and now is recoverable by construction.** The
gate itself is unchanged — no active `person` row, no account — but until
[#77](https://github.com/mafiefa02/sugt/issues/77) the Google client carried no `prompt`, so
after the first sign-in Google silently re-authorized the account it remembered and handed the
gate the **same** refused account on every retry. The "personal Gmail out of habit" case the
indistinguishability bullet already names was, until this change, a person the system could not
let back in from inside the app. Setting `prompt: "select_account consent"` reopens the chooser
on every sign-in, so a different account can now be offered and judged. The gate did not become
kinder; it simply started being offered something new to judge.

**"Coba akun lain" is safe to say to all three refusal cases, so the copy change does not touch
indistinguishability.** The rejection now reads _Akun ini tidak terdaftar. Coba akun lain, atau
hubungi tim DITSAMA untuk mendapat akses._ — true for the uninvited stranger, the revoked
Person and the mis-picked Gmail alike, because reopening the chooser lets any of them try a
different account. It still says nothing about _why_ an account was refused. The property this
Consequence pins is untouched: `/masuk` renders **one** Indonesian sentence for every value of
`?error` and never echoes the parameter, so the three cases stay indistinguishable by
construction and not by two strings happening to match.

**Every sign-in now costs a chooser click and an Allow screen, and that price is accepted.**
`1.6.27` takes `prompt` only in server config, so it is unconditional and cannot be made to fire
only after a failure. `select_account` reopens the chooser — the fix — and `consent` re-shows
the permission screen deliberately, to put the chosen account's email in front of the person one
more time before they land, so a mis-pick is caught by them rather than by the gate. It is not
for a refresh token: nothing is persisted from Google, and the invite list is re-read by email
every request. Sessions persist, so sign-in is rare, and one extra click beats an unrecoverable
dead end.
