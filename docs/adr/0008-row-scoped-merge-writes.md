# Writes are row-scoped, merged from fresh rows, and local wins

Every save used to clear the whole tab and rewrite it from the device's current state, so a write from any stale Working Copy silently dropped hours of another member's edits — a Lost Update. The realistic collision is not rare: at month start two members work the same month's Bills together (copying last month's bills, checking variable values), saving every few seconds, so whole-tab writes would keep losing edits in practice. Saves are now row-scoped and merged: a save re-reads the id column of the affected tabs (one batched request), maps each Pending Change to its row, and writes only those rows' ranges in one `values:batchUpdate` — inserts append, deletes blank-clear the row so positions stay stable (reads already skip blank rows). On a same-row collision the local Pending Change wins — an edit is never silently dropped; the other member sees the new value on their next pull.

## Considered alternatives

- **Whole-tab merge-before-write** (re-read, replay, rewrite the whole tab): fixes losses from copies stale by hours, but still loses roughly one edit per co-editing session — two saves whose re-read/write windows interleave within a round trip, even in different months.
- **Month-scoped block writes** (rows sorted by month, rewrite only that month's block): protects only old months, which the household never edits concurrently — the real collision is same-month.
- **Append-only journaling** (append new versions, dedupe by id on read, tombstones for deletes): no lost updates at all, but the sheet stops being the human-inspectable ledger ADR-0001 chose it for, and it grows unboundedly without a single-writer compaction pass.
- **Server-wins replay**: re-creates the Lost Update in a narrower window. **Field-level merge**: its failure mode is silently mixed rows — the worst kind in a finance app.

## Consequences

- Residual and accepted: two members editing the same row at the same moment can still lose one edit (they coordinate verbally), and truly simultaneous copy-last-month taps can duplicate the replicated set. The copy action re-reads the target month first and skips if it is no longer empty, so only the same-instant double tap remains.
- Deleted rows leave blank holes; there is deliberately no compaction pass — compacting rewrites the whole tab and re-imports the clobber risk.
- Appended rows land at the tab's tail, so a backfilled old month sits after newer months; screens filter by month, so this is cosmetic.
- Until every household device runs this protocol, an old build's whole-tab write still clobbers — accepted at household scale.
- The PRD's risk-table row "Concurrent edits from multiple devices → Load on start; Refresh option" is rewritten with the implementation of this ADR (row-scoped merge writes, local wins, pull on focus).
