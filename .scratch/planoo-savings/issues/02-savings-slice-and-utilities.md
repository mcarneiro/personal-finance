# 02 — Savings slice and pure savings utilities

**What to build:** The state and the derived arithmetic for savings, with no UI yet. A `savingsSlice` owns both the pot registry (`items: SavingsPot[]`) and the monthly balances (`balances: SavingsBalance[]`), with `setSavingsPots` / `addSavingsPot` / `updateSavingsPot` / `deleteSavingsPot` and `setSavingsBalances` / `upsertSavingsBalance` / `deleteSavingsBalance`. Removing a pot only drops it from the registry (balances are left in the sheet, ADR-0011). A pure utility module, in the shape of `utils/controlLoop.ts`, computes the two derived operations savings needs and nothing else: `potBalance(month, potId, balances)` returns the pot's carried balance for a month (the recorded balance for that month if one exists, otherwise the most recent recorded balance from any earlier month, otherwise `undefined`), and `totalSaved(month, pots, balances)` sums the carried balances of the active pots. Neither ever derives a balance from contributions, and neither reads Outflows (`utils/controlLoop.ts` must not become a dependency). The "updated in an earlier month" signal is exposed so the screen can mark a carried value: `potBalance` also reports the month the balance came from.

**Blocked by:** 01 — Sheet contract and record types for savings.

**Status:** done

- [x] `src/store/savingsSlice.ts` holds `items` (pots) and `balances`, registered in `src/store/index.ts`; removing a pot never touches `balances`.
- [x] `potBalance(month, potId, balances)` returns the recorded balance and its source month for that month, else carries forward the most recent earlier recorded balance (returning that earlier month), else `undefined` for a pot recorded in no month up to and including this one.
- [x] `totalSaved(month, pots, balances)` is the sum of the active pots' carried balances; pots with no recorded balance contribute nothing; the sum of none is `0`.
- [x] Both utilities are pure (no dispatch, state, or I/O) and neither imports Outflow / Account Net code.
- [x] Balances for a *future* month relative to the recorded rows are never invented: carry-forward only looks backwards.
- [x] Unit tests (Given/When/Then) cover: an exact-month balance wins; a missing month carries the last earlier balance; a gap of several months still carries the nearest earlier one; a pot with no record at all yields `undefined` and contributes nothing to `totalSaved`; a recorded `0` is respected as a real balance; an equal-named but removed pot's stale balance is ignored; and `totalSaved` over several pots.
- [x] `npm run lint`, `npx tsc --noEmit`, and the new tests pass. No user-facing surface, so verification is the ticket's own gate plus a no-regression render check.

## Comments

Implemented the savings data layer (slice + pure utilities) and finished the store/sync integration ticket 01 left as a placeholder.

- `src/utils/savings.ts`: `potBalance(month, potId, balances)` returns `{ balance, sourceMonth }` — the month's own record wins (source = that month), else the nearest earlier balance is carried (source = that earlier month), else `undefined`. Carry-forward only looks backwards, an explicit `0` is a real value, and nothing is ever derived from contributions. `totalSaved(month, pots, balances)` sums only the active registry's pots' carried balances; retired pots' stale rows are ignored by id. Neither function imports `controlLoop.ts` or Outflows/Account Net code.
- `src/store/savingsSlice.ts`: `items` (pots) and `balances`, with `setSavingsPots/add/update/delete` and `setSavingsBalances/upsertSavingsBalance/deleteSavingsBalance`. `deleteSavingsPot` drops only the registry, leaving balance rows intact (ADR-0011). `upsertSavingsBalance` keys on `(month, potId)` with a deterministic `month-potId` id, so one row per pot per month; `deleteSavingsBalance` removes one row by id so history is kept.
- Integration (the persistence wiring is unrequested by the ticket's literal checklist but needed to make the slice non-inert; ticket 01 explicitly deferred `selectSheetData`): `savings` reducer registered in `src/store/index.ts`; `useDataSync.applySnapshot` dispatches `setSavingsPots`/`setSavingsBalances`; `selectSheetData` now returns the savings arrays; `syncListener` writes `savings_pots`/`savings_balances` row-scoped like every other tab, recording pending changes.
- Tests: `utils/__tests__/savings.test.ts` (13) and `store/__tests__/savingsSlice.test.ts` (9) cover all seven required scenarios plus the create/update/delete reducers and the retire-keeps-balances rule; `workingCopyPersistence.test.ts` gained two persistence cases. Full suite 386 tests pass; `tsc --noEmit` and `npm run lint` clean.
- Browser (chrome-mcp, page 1): reloaded `http://localhost:5173/`; Dashboard rendered and the sync completed; console showed only the Vite/React dev messages, no errors or warnings. No savings UI yet, so the bottom-nav tab and screen land in tickets 04–06.

