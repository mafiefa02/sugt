# The internal tool tracks delivery, not outcomes

The tool records what was delivered: Sessions, Session Records, Perjadins and their acquittal. It does not model learning outcomes. There are no stages between a School's first and last Session, no Project Teams, no Final Projects, and blocking notes are prose rather than tracked items with a resolved state.

## Why

Every outcome measure needs a human judgement entered by a human. The people who could enter them are the Teaching Team, and [ADR-0007](./0007-the-tool-generates-the-acquittal.md) records that they have no structural reason to open the tool — no acquittal, no evidence to file, nothing generated for them. Final Projects are the sharpest case: several hundred of them, arriving at the busiest point in the Programme, from the least incentivised people.

Data that will not be entered is worse than data that is absent, because a half-filled outcome field looks like a system of record and is not one. The outcome signal retained is the Rating — one per Aspect, made by the people who were in the room.

That is already a meaningful ask of unincentivised authors, which is the argument for keeping the Ratings cheap and the prose optional. It is also the reason not to add more: every further outcome field competes with the ones that already exist.

> **Amended, and this is the amendment to read most carefully.** The signal was six picks per Session — one per Class per Stream. It is now **four rubrics of 1–10 Ratings**: a Class Record from each professor for each Class they taught (seven Aspects), a Session Record from the PIC about the visit (five), Participant Feedback from the room (three), and a Perjadin Evaluation from the Group (four). Nothing is required and nothing is blocked; the tool names who has not filed so they can be chased.
>
> **The ask on the Teaching Team grew by roughly an order of magnitude.** Six picks per Session became twenty-one Ratings per professor per Session — three Classes at seven Aspects — plus mandatory prose whenever any of them is 7 or below, which on a ten-point scale will be often. This ADR exists to say that data which will not be entered is worse than data that is absent. That risk is now concentrated here, and it was accepted knowingly rather than overlooked.
>
> If Class Records stop arriving, the levers in order of cheapness are: lower the threshold so prose is demanded less often; cut the Class Record's seven Aspects; or drop to one Record per Class rather than one per professor per Class. The last would cost the STEM-versus-Research disagreement, which is the most informative thing the current shape produces.
>
> Participant Feedback ([ADR-0012](./0012-participants-write-through-a-short-lived-session-token.md)) cuts the other way: a source of Ratings from people with no account at all, collecting outcome signal without asking anything more of the Teaching Team — which is the constraint this ADR is built around, and the reason it is worth having even though it is not a census.

## Consequences

- "Has this School had all its Sessions?" is answerable. "Is this School finished?" is not, and the tool should not imply otherwise.
- Final Projects reach the public as curated showcase pieces authored by Staff (see [ADR-0008](./0008-public-narrative-is-authored-in-the-internal-app.md)), never as records rolled up from the internal system.
- Project Team and Final Project remain in the glossary. They are real parts of the domain and appear in published content; they are simply not things this tool stores.
