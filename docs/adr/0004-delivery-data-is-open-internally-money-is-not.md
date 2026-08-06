# Delivery data is open to everyone signed in; financial data is not

Inside the internal tool, anyone authenticated can read every Session, Session Record and progress view. Perjadin Reports and their financial detail are visible to Staff only. Write access in both cases stays with the record's owner.

There are two roles, Staff and Teaching Team. The Programme's leadership are senior Staff, not a separate role.

## Why

Groups are assembled per Perjadin and no Cluster has a standing team, so the tool is the only thing carrying knowledge of a School between visits. A professor travelling to a Cluster for the first time has to be able to read what the previous group wrote about those Schools. Restricting Session Records to their authors would remove the continuity mechanism the travel model depends on.

Perjadin Reports carry per-diem amounts and personal travel claims. No delivery purpose is served by a colleague reading them, so they stay with Staff and leadership.

## Publishing

Only Staff may publish content to the public site (see [ADR-0008](./0008-public-narrative-is-authored-in-the-internal-app.md)). Every Group contains a Staff member by construction, since a Perjadin requires a PIC, so no trip's material is out of reach. Teaching Team members write Session Records and nothing public.

## Consequences

- Session Record authors write knowing colleagues will read them. That is intended — it is what makes them institutional memory — and is a different thing from publication, which [ADR-0001](./0001-public-site-reads-aggregates-only.md) rules out.
- Two access rules to maintain rather than one.
