# Participants write through a short-lived Session token, into their own table

Participants — the people taught at a Session — may leave Feedback on it without signing in, through one link per Session that is live only briefly. Their submissions land in `participant_feedback`, never in a Session Record.

## Why this needs recording

[ADR-0003](./0003-google-sign-in-with-an-invite-list.md) says the internal tool is Google sign-in restricted to an invite list. This is the one write path in the system that has neither. A future reader finding an unauthenticated `INSERT` would reasonably assume it was an oversight, so: it is not.

The alternative is asking forty-two Schools' worth of teachers, management and students to hold accounts on DITSAMA's internal tool. That is an invite list in the thousands, maintained by hand, for people who will use it once — and [ADR-0003](./0003-google-sign-in-with-an-invite-list.md) already notes that somebody owns adding and removing every name on it. The accounts would not get created, so the feedback would not get collected.

## What the token is, and is not

One token per Session, shared — a link or QR code shown at the end of it. Issuing a new one replaces the old.

It is an authorisation to insert one row into one table, and nothing else. It grants no read access, so nobody holding it can see other people's feedback, any Session Record, or anything about the Perjadin. It carries no identity: the Participant types their own name, and nothing verifies it.

**So this is not authentication and should not be built as though it were.** Nothing stops one person submitting twice, or the link being forwarded and used by somebody who was not in the room. Participant Feedback is indicative, not a census.

## Considered options

- **One token per Participant, single-use.** Would give real de-duplication and a known response rate. Rejected: issuing them needs an attendee list, and [ADR-0009](./0009-the-tool-tracks-delivery-not-outcomes.md) decided against building enrolment. The mechanism would require exactly the data the Programme has chosen not to hold.
- **Accounts for Participants.** Rejected above.
- **No Participant Feedback at all.** Coherent, and what the system did until now — the people in the room were the only ones whose view was not recorded. Rejected because that view is the most direct evidence of how a Session actually went, and it costs one table and one route to collect.

## Consequences

- The route is the only unauthenticated write surface in either app, so it belongs behind a single handler that resolves the token, checks the expiry, and can reach `participant_feedback` and nothing else. Rate limiting goes at the edge; the database holds no defence here and should not pretend to.
- Participant Ratings feed the same concerns list as Session Record Ratings. The list must show which kind each came from — a professor scoring a Class 3 and a student scoring it 3 are not the same claim.
- **This does not weaken [ADR-0001](./0001-public-site-reads-aggregates-only.md).** Participant Feedback is a separate table precisely so a Session Record stays a document written for colleagues. Merging them later would destroy the candour ADR-0001 exists to protect, and would be a reversal of this decision rather than an extension of it.
- The form lives in the internal app, which is where the token can be resolved. The public app remains credential-free and gains nothing.

The tables are in [`docs/data-model.md`](../data-model.md).
