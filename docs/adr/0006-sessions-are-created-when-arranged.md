# Sessions are created when arranged, not scheduled up front

A Session comes into existence when someone plans a Perjadin or schedules an online meeting. The full set of Sessions a School is due is never laid out in advance, even though the number is fixed and known from the start.

## Why

The count is known, so a complete schedule is possible — 42 Schools × N Sessions, with target dates. It was rejected because those dates would be invented. The Programme spans the Indonesian archipelago and dates will move constantly; a schedule nobody maintains displays confident wrong information, and people stop trusting the screen it appears on.

Progress does not depend on it. The denominator is the fixed Session count, so a School reads "3 of 6 delivered" without any planned rows existing. Forward visibility comes from Perjadins, which are authorisations and therefore exist before the travel they authorise.

## Consequences

- Nothing is ever "overdue" in the schedule sense, because nothing ever asserted a due date. A School falling behind shows as a low delivered count, and noticing that is a human reading a number.
- There is no at-risk surfacing on the coverage view either. It shows delivered counts and nothing else — no flagging, no colour, no health indicator. Pace and health are different things, and the tool renders only pace.
- The prose on a Session Record is for the next Group to read, not a set of tracked items with resolved states, so it carries no status meaning anywhere.
- The outcome signal is aggregated on a separate concerns list across all Schools, and nowhere else. That list is the entire justification for collecting the signal in a countable form rather than as prose. If it is not built, the signal should not be collected.

> **Amended.** The signal was originally a three-value pick — _on track_, _some concerns_, _struggling_ — made once per Class per Stream, and the sentence above argued that the concerns list was the whole reason for it being a fixed set. It is now a **Rating from 1 to 10 against each of five Aspects** of the Session: Materials, Delivery, Engagement, Facilities, Timing. Classes are no longer scored at all.
>
> The argument survives intact, and the Aspects arguably strengthen it: a pick told you a Session went badly, whereas an Aspect tells you what did, which is what a list exists to be actioned from.
>
> What changes is that a ten-point scale has no natural line on it, so the list needs a threshold the pick did not. `CONCERN_AT_OR_BELOW` is **7** — a wide net, roughly the bottom two-thirds of the scale. It is invented, which is exactly the kind of number this ADR is otherwise careful to avoid inventing; it is accepted because the alternative is a list that is never empty. Two consequences worth carrying: the same number makes prose mandatory, so raising it costs writing as well as screen space; and it sits in three index predicates, so moving it is a migration rather than an edit. See [`docs/data-model.md`](../data-model.md).

- If at-risk detection later proves necessary, the cheap version is a target window per Session index across the Programme or per Cluster, not per School. Reopening this decision means accepting the maintenance it was rejected for.
