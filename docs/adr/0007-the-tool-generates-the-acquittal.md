# The tool generates the acquittal, and has to win adoption on merit

A PIC enters a Perjadin's transactions once, in this tool, and exports a filled template of the acquittal paperwork. Nothing requires them to do this here.

## Why

The obligation is concrete regardless of what we build. The Advance is fixed at planning, transferred to the PIC before departure, the leftover is returned to the Treasurer, and every transaction that consumed it has to be evidenced. Someone assembles that record either way. The only question is where.

This decision originally rested on the tool sitting upstream of a compulsory institutional process. That argument is void: the acquittal is DITSAMA's own, on a deadline DITSAMA sets, nothing is gated, and the Treasurer accepts any format. **No structural force pushes a PIC into this tool.**

So it has to be plainly better than the alternative — receipts photographed and uploaded from a phone at the airport, running reconciliation against the Advance, one click to the finished document. That beats a spreadsheet, a calculator and a folder of WhatsApp photos. People do adopt tools that are obviously faster without being made to.

## How it wins, concretely

A transaction can be entered whenever suits the PIC — photographed and logged on the pavement as it happens, or worked through after returning. Both are first-class paths, not a primary and a fallback. What the tool adds over a spreadsheet is that evidence attaches to the line it belongs to, the running total reconciles against the Advance without anyone doing arithmetic, and nothing is retyped to produce the final document.

**Offline support is deliberately deferred.** Capture needs connectivity, and trips cross the archipelago, so there will be moments — airports, remote Schools — where logging on the spot fails. That costs convenience rather than data, precisely because post-trip entry is fully supported: a PIC who cannot upload at the gate does it that evening and loses nothing. Worth adding later; not worth blocking on now.

## What this decision rests on

Execution quality, not structure. If the form is mediocre, PICs keep doing what they did last time, and the largest single piece of this build serves nobody.

If that happens, the fallback is to drop the money side and keep the tool as a delivery tracker. That is a coherent smaller product rather than a mutilated one: tracking needs Perjadin and Session data, but never transaction-level detail.

## Considered and rejected

**Transactions without generation.** Recording spend for visibility while producing no document. Rejected as the worst available position — it asks for all of the work and returns none of the benefit, so PICs either enter everything twice or not at all.

## Consequences

- The build is materially larger than a form: itemised transactions with evidence, reconciled against the Advance, exported as a filled template. Mobile capture matters, because receipts are photographed in transit on poor connections.
- The templates are DITSAMA's own, so they are ours to change — no external dependency, and no external authority to point at when someone wants a different one.
- Adoption reaches PICs only, and only if the bet lands. Teaching Team members have no Advance, no transactions and nothing generated for them; they open the tool solely to write Session Record parts, with no material consequence if they don't. See [ADR-0004](./0004-delivery-data-is-open-internally-money-is-not.md) and [ADR-0009](./0009-the-tool-tracks-delivery-not-outcomes.md).
