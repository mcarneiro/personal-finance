# 04 — Savings screen with inline monthly balance check-in

**What to build:** The `/savings/:month` screen, reached from the bottom nav (whose wiring lands in ticket 06) and listed under the app shell's month-scoped screens. It uses `MonthScaffold` for month validation and prev/next navigation, and lists every active pot with an inline editable Savings Balance for the browsed month — the same check-in pattern as `CardCheckIn` and the remaining-estimate inputs (`AmountInput`). Committing a value upserts the month's `savings_balances` row for that pot; clearing the field deletes that month's row so carry-forward resumes; an explicit `0` is a recorded zero (ADR-0011). The screen shows no top-bar "+" and no record editor — pots live in Settings. When the pot registry is empty, the screen shows a highlighted callout with a shortcut straight to Settings, mirroring the Outflows screen's empty-registry callout. A pot that has no record for the browsed month yet shows its carried balance, editable, with a marker naming the earlier month it came from.

**Blocked by:** 02 — Savings slice and pure savings utilities.

**Status:** done

- [x] `/savings/:month` renders via `MonthScaffold basePath="/savings"`; an invalid month redirects; prev/next navigation works.
- [x] Each active pot shows its inline `AmountInput` pre-filled with the carried balance for the browsed month (using ticket 02's `potBalance`), and committing writes/updates that month's balance row.
- [x] Clearing the field removes the browsed month's record (carry-forward resumes); entering `0` stores a real zero — the two are distinguishable.
- [x] A carried-forward value is visibly marked with the month it was last updated in; an exact-month value is not.
- [x] An empty pot registry renders a callout linking to Settings instead of an unusable list.
- [x] `savings.*` translation keys exist in both locales (title, balance label, last-updated marker, empty-registry callout, total label).
- [x] A new pot with no record in any month shows an empty editable field and never fabricates a value.
- [x] Tests (Given/When/Then, Testing Library) cover: commit writes a balance; clearing deletes the row; `0` vs empty behave differently; carry-forward renders and is marked; empty registry shows the callout.
- [x] Browser-verified via chrome-mcp: navigate to `/savings/:month`, enter a balance for a pot, reload and confirm it persisted to the sheet, clear it and confirm it reverts to the carried value.
- [x] `npm run lint`, `npx tsc --noEmit`, and the relevant tests pass.

## Comments

Built the `/savings/:month` screen and its inline monthly balance check-in.

- `src/features/savings/SavingsScreen.tsx`: renders via `MonthScaffold basePath="/savings"` (invalid month redirects, prev/next works). One row per active pot with an `AmountInput` pre-filled from `potBalance`; committing dispatches `upsertSavingsBalance` for the browsed month, clearing calls `deleteSavingsBalance` on that month's row so carry-forward resumes. A carried value gets a `savings.lastUpdated` marker naming the source month; the browsed month's own record is unmarked. Empty registry renders `NeedsPotRegistryNotice`. No top-bar "+" and no editors.
- `src/features/savings/NeedsPotRegistryNotice.tsx`: mirrors `NeedsRegistryNotice` (amber `role="note"` + Settings shortcut).
- `src/features/plan/AmountInput.tsx`: gained an optional `onClear` (clear deletes instead of committing `0`) and `hasValue` (an explicit `0` renders as `0`, not blank). Existing callers are unchanged; the ref now tracks `{ value, hasValue }` so a clear can adopt a re-render that lands on an equal number (e.g. the carried value after deleting the month's row).
- `App.tsx` routes `/savings/:month` inside `Layout` (the bare `/savings` redirect and the nav tab are ticket 06). `Layout.tsx`'s `SCREEN_TITLES` gains `/savings` with **no** `addLabelKey`.
- `savings.*` keys added to both locales: `title`, `balanceLabel`, `lastUpdated`, `emptyRegistry`, `emptyRegistryCta`, `total` (`total` is reserved for ticket 05).
- Tests: `SavingsScreen.test.tsx` (11, Given/When/Then, real store + sync middleware to the write boundary) covers commit, clear→delete, `0` vs empty, carry-forward marking, empty registry callout, malformed-month redirect, and no-inline-remove. `App.test.tsx` gains a month-nav test and a no-"+"-on-Savings test. Full suite 404 pass; `tsc --noEmit` and `npm run lint` clean.
- Browser (chrome-mcp, page 1): created a test pot in Settings, opened `/savings/2026-06`, recorded `1000`, reloaded — persisted from the sheet. `/savings/2026-07` showed the carried `1000` marked "Updated in June 2026". Recorded `1200` for July, reloaded — persisted, unmasked as carried. Cleared July on `/savings/2026-07` — the field reverted to the carried `1000` and the marker came back. Retired the test pot; `/savings/2026-06` then showed the highlighted Settings callout. Console clean (no errors/warnings). The household sheet was returned to its original state (no pots, no balances).
