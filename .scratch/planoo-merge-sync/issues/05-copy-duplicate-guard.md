# 05 — Copy-last-month duplicate guard

**What to build:** The one-tap "copy last month" actions (Plan, Bills, Income) stop being able to double-replicate. Before replicating, the action re-reads the target month's rows for the affected tab; if the month already has records, nothing is copied and the member sees a message explaining why. If the month is empty, replication proceeds exactly as today (estimates and card totals start at zero).

**Blocked by:** 02 — The pull side of the sync cycle.

**Status:** ready-for-agent

- [ ] Each copy action re-reads the target month's rows immediately before replicating.
- [ ] When the target month is no longer empty, replication is skipped and a clear message explains why.
- [ ] When the target month is empty, replication proceeds as today (zeroed estimates and card totals).
- [ ] Browser-verified via chrome-mcp with two clients: the second member's copy is blocked with the message instead of creating a second set of records.
- [ ] `npm run lint`, `npx tsc --noEmit`, and relevant tests pass.
