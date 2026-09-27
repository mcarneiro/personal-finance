# 04 — Control-loop utilities

**What to build:** The five derived numbers — Plan Total, Total Spent, Projected Result, Plan Result, and Account Net — as pure functions with table-driven tests, including the June trace from the real historical sheet (plan 10.750; card totals 2.899 + 9.432 + 473 = 12.804; remaining 250 → Projected Result −2.304). This is the prefactor every screen reads; it is verifiable by tests alone.

**Blocked by:** 01 — App skeleton

**Status:** done

- [x] The five derived numbers are computed by pure functions per the formulas in the spec
- [x] The June trace reproduces exactly: 10.750 − 12.804 − 250 = −2.304
- [x] Edge cases covered: empty month, zero estimates, missing card totals, negative results
- [x] Given/When/Then comments in the tests; no rendering or store coupling in the utilities

## Comments

- Implemented 2026-09-27. Added `src/utils/controlLoop.ts` with the five pure derived-number functions — `planTotal`, `totalSpent`, `projectedResult`, `planResult`, `accountNet` — each month-filtered over the plain entity arrays (PlanItem, CardSpending, Bill, IncomeEntry), no store or rendering coupling, nothing stored.
- Remaining estimates are summed over variable buckets only; bills count in the Account Net regardless of paid status (spec formula: Σ income − Σ bills).
- Tests: `src/utils/__tests__/controlLoop.test.ts` (27) — table-driven `it.each` per function with Given/When/Then comments, plus the dedicated June 2026 trace (plan 10.750 = buckets 9.000 + fixed 1.750; totals 2.899 + 9.432 + 473 = 12.804; restaurante estimate 250 → Projected Result −2.304, Plan Result −2.054) and a month-end test asserting the projection equals the Plan Result when estimates are zero.
- `npm run lint`, `npm run typecheck`, and the full `npm test` suite (62 tests) are all green.
