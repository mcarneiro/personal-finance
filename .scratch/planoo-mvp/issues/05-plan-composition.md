# 05 — Plan composition

**What to build:** The Spending Plan screen for a month: fixed charges and spending buckets with user-defined names and amounts, addable/editable/removable, the plan total displayed, and the one-tap copy-last-month button that seeds items (names, kinds, amounts) but never remaining estimates or card totals — those start at zero. Demo: build June's plan in the app and see the 10.750 total.

**Blocked by:** 02 — Onboarding + Google Sheets foundation; 04 — Control-loop utilities

**Status:** ready-for-agent

- [ ] Plan items are addable/editable/removable per month, with kind (fixed charge / spending bucket) and user-defined names
- [ ] Plan total is displayed, computed by the control-loop utilities
- [ ] Copy-last-month button seeds items with zero remaining estimates and zero card totals; it is absent when last month has no plan
- [ ] Items persist to the plan tab through the sync path
- [ ] Month navigation shows each month's own composition
