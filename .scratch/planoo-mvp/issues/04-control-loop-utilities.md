# 04 — Control-loop utilities

**What to build:** The five derived numbers — Plan Total, Total Spent, Projected Result, Plan Result, and Account Net — as pure functions with table-driven tests, including the June trace from the real historical sheet (plan 10.750; card totals 2.899 + 9.432 + 473 = 12.804; remaining 250 → Projected Result −2.304). This is the prefactor every screen reads; it is verifiable by tests alone.

**Blocked by:** 01 — App skeleton

**Status:** ready-for-agent

- [ ] The five derived numbers are computed by pure functions per the formulas in the spec
- [ ] The June trace reproduces exactly: 10.750 − 12.804 − 250 = −2.304
- [ ] Edge cases covered: empty month, zero estimates, missing card totals, negative results
- [ ] Given/When/Then comments in the tests; no rendering or store coupling in the utilities
