# Feedback links never expire and are never replaced

A Session's **Participant Feedback** link (`/f/{token}`) and a Perjadin's **Perjadin Evaluation** link
(`/ep/{token}`) work for as long as they exist. Neither expires, and nothing in the app replaces or
kills one: pressing "Tampilkan QR" returns the link the Session or Perjadin already has, and makes
one only when it has none. This supersedes the short-lifetime and "issuing a new one replaces the
old" parts of [ADR-0012](./0012-participants-write-through-a-short-lived-session-token.md) and
[ADR-0024](./0024-perjadin-evaluation-is-filed-through-an-unauthenticated-token-link.md). Their other
decisions stand: no sign-in, a token that authorises one insert into one table, untrusted
self-declared identity.

Settled with the product owner on 2026-10-08
([#453](https://github.com/sugt-itb/sugt-itb-26/issues/453)), urgently: printed QR codes were
breaking in the field.

## Why

Staff print the QR the day before they leave, and many shorten the link with bit.ly. The old design
broke those copies three ways:

1. **A link expired.** A Session's lasted 24 hours from issue and a Perjadin's 14 days. A QR printed
   the day before was often dead by the time it was held up in the room.
2. **"Tampilkan QR" replaced the link.** The dialog remembered an issued QR only while the page stayed
   open. After a reload, on another device, or when a colleague opened it, it started empty, and
   pressing the button upserted on `session_id` / `perjadin_id`. The new token overwrote the old one,
   so every printed QR and shortened link for that Session or Perjadin silently stopped working.
   Staff B printed the QR, staff A pressed the button later, and B's printout was dead.
3. **"Terbitkan QR baru" / "Terbitkan tautan baru" replaced it deliberately**, with the same result.

A link that dies on a schedule, or because somebody else looked at it, cannot be printed. Printing
is how the links are actually used.

## The decision

- **No expiry.** `expires_at`, its check rule, and `FEEDBACK_TOKEN_LIFETIME_HOURS` /
  `PERJADIN_FEEDBACK_TOKEN_LIFETIME_HOURS` are gone. A cancelled Session's link is still refused, as
  before. That comes from the Session being cancelled, not from the link expiring.
- **The token is the key.** Both tables are keyed on `token`, with `session_id` / `perjadin_id` a
  plain indexed foreign key, so a Session or Perjadin may hold several links. Migration `0048` makes
  the change in place, keeping every existing row and its token string, including links whose expiry
  had already passed.
- **Issuing never writes over a row.** `issueFeedbackToken` and `issuePerjadinFeedbackToken` lock the
  Session or Perjadin row, read its link, and insert only when there is none. Two staff, two devices,
  a reload or two simultaneous presses all get the same link. Of several links, issuing returns
  **the original**: the earliest `issued_at`, then `token`.
- **No in-app way to replace a link.** The reissue buttons and their "Tautan yang sedang dibagikan
  akan langsung mati…" confirmation are removed from both dialogs.
- **Links already replaced can be reattached.** Their strings are gone from the database, so they are
  collected from outside (bit.ly dashboards, printed QRs, backups;
  [#454](https://github.com/sugt-itb/sugt-itb-26/issues/454)) and attached with
  `pnpm --filter @sugt/db db:reattach-links`. Each line adds a link beside the existing one and
  never updates, deletes or moves one. The script is a dry run without `--apply` and idempotent with
  it. A reattached row is stamped with the moment it was reattached, so it never becomes the one the
  dialog shows.

## What is given up

- **A leaked link can no longer be killed in-app.** Before, reissuing was the remedy for a QR posted
  somewhere it should not be. Now the remedy is by hand in the database: delete the row from
  `session_feedback_token` or `perjadin_feedback_token`. The submit actions re-resolve the token, so a
  form already open stops at the next submit. This is acceptable for the same reason ADR-0012 gave:
  the token authorises one insert into one table and reads nothing. The worst a leaked link does is
  let junk reach `/feedback`, which ADR-0012 already accepts.
- **The "only briefly" bound on unwanted submissions is gone.** A link stays open long after the
  Session or trip. Participant Feedback and Perjadin Evaluation were always _indicative, not a
  census_, and a late or duplicate submission is the same accepted cost as a forwarded link.

## Considered and parked

Creating links up front for every Session or Perjadin, an "Unduh QR" button, and an Administrator
page for closing links by hand. None is needed to stop links breaking, so all three are out of scope
for #453 and not decided.
