# Architecture Decision Records

One file per decision that shapes the codebase and would otherwise only survive
in someone's head: `NNNN-short-slug.md`, numbered in the order they were taken,
never renumbered. A record is written *before* the code, and stays as the record
of what the decision commits us to.

Each starts with a status header (`Proposed` / `Accepted` / `Implemented` /
`Superseded by NNNN`) and a date, then Context → Decision → Consequences.
Decisions get revised by writing a new ADR that supersedes the old one, not by
editing history — the wrong turns are half of what makes the file worth keeping.

| # | Decision | Status |
| --- | --- | --- |
| [0001](./0001-app-wide-notifications.md) | App-wide notifications, on top of direct messages | Accepted, not yet implemented |
