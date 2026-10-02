# 04 — Savings screen with inline monthly balance check-in

**What to build:** The `/savings/:month` screen, reached from the bottom nav (whose wiring lands in ticket 06) and listed under the app shell's month-scoped screens. It uses `MonthScaffold` for month validation and prev/next navigation, and lists every active pot with an inline editable Savings Balance for the browsed month — the same check-in pattern as `CardCheckIn` and the remaining-estimate inputs (`AmountInput`). Committing a value upserts the month's `savings_balances` row for that pot; clearing the field deletes that month's row so carry-forward resumes; an explicit `0` is a recorded zero (ADR-0011). The screen shows no top-bar "+" and no record editor — pots live in Settings. When the pot registry is empty, the screen shows a highlighted callout with a shortcut straight to Settings, mirroring the Outflows screen's empty-registry callout. A pot that has no record for the browsed month yet shows its carried balance, editable, with a marker naming the earlier month it came from.

**Blocked by:** 02 — Savings slice and pure savings utilities.

**Status:** todo

- [ ] `/savings/:month` renders via `MonthScaffold basePath="/savings"`; an invalid month redirects; prev/next navigation works.
- [ ] Each active pot shows its inline `AmountInput` pre-filled with the carried balance for the browsed month (using ticket 02's `potBalance`), and committing writes/updates that month's balance row.
- [ ] Clearing the field removes the browsed month's record (carry-forward resumes); entering `0` stores a real zero — the two are distinguishable.
- [ ] A carried-forward value is visibly marked with the month it was last updated in; an exact-month value is not.
- [ ] An empty pot registry renders a callout linking to Settings instead of an unusable list.
- [ ] `savings.*` translation keys exist in both locales (title, balance label, last-updated marker, empty-registry callout, total label).
- [ ] A new pot with no record in any month shows an empty editable field and never fabricates a value.
- [ ] Tests (Given/When/Then, Testing Library) cover: commit writes a balance; clearing deletes the row; `0` vs empty behave differently; carry-forward renders and is marked; empty registry shows the callout.
- [ ] Browser-verified via chrome-mcp: navigate to `/savings/:month`, enter a balance for a pot, reload and confirm it persisted to the sheet, clear it and confirm it reverts to the carried value.
- [ ] `npm run lint`, `npx tsc --noEmit`, and the relevant tests pass.

## Comments
