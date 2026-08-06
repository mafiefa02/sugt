# The internal tool tracks delivery, not outcomes

The tool records what was delivered: Sessions, Session Records, Perjadins and their acquittal. It does not model learning outcomes. There are no stages between a School's first and last Session, no Project Teams, no Final Projects, and blocking notes are prose rather than tracked items with a resolved state.

## Why

Every outcome measure needs a human judgement entered by a human. The people who could enter them are the Teaching Team, and [ADR-0007](./0007-the-tool-generates-the-acquittal.md) records that they have no structural reason to open the tool — no acquittal, no evidence to file, nothing generated for them. Final Projects are the sharpest case: several hundred of them, arriving at the busiest point in the Programme, from the least incentivised people.

Data that will not be entered is worse than data that is absent, because a half-filled outcome field looks like a system of record and is not one. The outcome signal retained is the "how it went" pick on each part of a Session Record — six per Session, made by the people who were in the room.

That is already a meaningful ask of unincentivised authors, which is the argument for keeping the picks cheap and the prose optional. It is also the reason not to add more: every further outcome field competes with the six that already exist.

## Consequences

- "Has this School had all its Sessions?" is answerable. "Is this School finished?" is not, and the tool should not imply otherwise.
- Final Projects reach the public as curated showcase pieces authored by Staff (see [ADR-0008](./0008-public-narrative-is-authored-in-the-internal-app.md)), never as records rolled up from the internal system.
- Project Team and Final Project remain in the glossary. They are real parts of the domain and appear in published content; they are simply not things this tool stores.
