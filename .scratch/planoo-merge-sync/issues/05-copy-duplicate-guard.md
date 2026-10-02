# 05 — Copy-last-month duplicate guard

**What to build:** The one-tap "copy last month" actions (Plan, Bills, Income) stop being able to double-replicate. Before replicating, the action re-reads the target month's rows for the affected tab; if the month already has records, nothing is copied and the member sees a message explaining why. If the month is empty, replication proceeds exactly as today (estimates and card totals start at zero).

**Blocked by:** 02 — The pull side of the sync cycle.

**Status:** done

- [x] Each copy action re-reads the target month's rows immediately before replicating.
- [x] When the target month is no longer empty, replication is skipped and a clear message explains why.
- [x] When the target month is empty, replication proceeds as today (zeroed estimates and card totals).
- [x] Browser-verified via chrome-mcp with two clients: the second member's copy is blocked with the message instead of creating a second set of records.
- [x] `npm run lint`, `npx tsc --noEmit`, and relevant tests pass.

## Comments

- Added `src/utils/copyGuard.ts` (`monthHasRecords`) — a pure helper that reports whether a freshly-read tab already holds a row for the target month.
- Added `src/hooks/useCopyGuard.ts` — the guard shared by all three copy actions. `canCopy()` re-reads the target tab's rows straight from the sheet (via the existing per-tab readers, so it sees exactly what a fresh pull would), and returns `false` when the month is already populated or the read fails (never copy on an unknown sheet — a duplicate is worse than a retry). It also serialises attempts: while a re-read is in flight a second call returns `false` immediately, so a double tap cannot dispatch the replicated set twice.
- `PlanScreen`, `BillsScreen`, `IncomeScreen`: each copy button now awaits `canCopy()` before dispatching and is a no-op when the guard blocks. A succinct tone-consistent `role="alert"` message (`common.copyBlocked` for an already-populated month, `common.copyCheckFailed` for an unverifiable one) explains why nothing was copied. The copied list is computed before the `await` so a re-render mid-read can't change what gets copied. Added pt-BR and en-US strings.
- Tests: `copyGuard` unit cases; `copyIdUniqueness` guarding that a copy of duplicate-by-name records produces distinct ids; new screen cases per action (blocked with a message and no write; check-failure message; two taps inside one in-flight read copy once). Every existing `Plan/Bills/Income` test now stubs the tab reader to an empty sheet in `beforeEach`, so the guard's re-read is deterministic. Full suite 302 passed; `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass.
- Browser-verified via chrome-mcp with two tabs on the same sheet (auth temporarily persisted via the same mechanism the Settings "keep me signed in" toggle uses, restored to session-only afterwards; throwaway far-future months so no real month was touched). For both Bills and Plan: client A copied an empty month and the copies landed on the sheet; client B, still showing its stale empty view, tapped copy and got the "Este mês já tem registros. Nada foi copiado para não duplicar." alert with the sheet left at exactly one set of copies. Also confirmed a single copy of a two-bucket plan fuels the whole plan (both buckets, not one), and a double tap during the in-flight re-read copies only once. All throwaway rows were blanked afterwards (0 test rows remain) and the October list still renders unchanged with no console errors.
- Docs: `prd.md` now says the copy/replicate actions re-read the target month and refuse with a message when it is no longer empty (Money Management §4/§5, Spending Plan §6). ADR-0008 already documents this behaviour.
- Found and fixed a real defect while verifying: computing `copyPlanItems(lastMonthItems, month)` inside the async `onClick` after the re-read could copy a stale list; the list is now captured before the guard await, and the guard serialises concurrent attempts so one tap copies exactly one set.
