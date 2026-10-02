# 02 — Savings slice and pure savings utilities

**What to build:** The state and the derived arithmetic for savings, with no UI yet. A `savingsSlice` owns both the pot registry (`items: SavingsPot[]`) and the monthly balances (`balances: SavingsBalance[]`), with `setSavingsPots` / `addSavingsPot` / `updateSavingsPot` / `deleteSavingsPot` and `setSavingsBalances` / `upsertSavingsBalance` / `deleteSavingsBalance`. Removing a pot only drops it from the registry (balances are left in the sheet, ADR-0011). A pure utility module, in the shape of `utils/controlLoop.ts`, computes the two derived operations savings needs and nothing else: `potBalance(month, potId, balances)` returns the pot's carried balance for a month (the recorded balance for that month if one exists, otherwise the most recent recorded balance from any earlier month, otherwise `undefined`), and `totalSaved(month, pots, balances)` sums the carried balances of the active pots. Neither ever derives a balance from contributions, and neither reads Outflows (`utils/controlLoop.ts` must not become a dependency). The "updated in an earlier month" signal is exposed so the screen can mark a carried value: `potBalance` also reports the month the balance came from.

**Blocked by:** 01 — Sheet contract and record types for savings.

**Status:** todo

- [ ] `src/store/savingsSlice.ts` holds `items` (pots) and `balances`, registered in `src/store/index.ts`; removing a pot never touches `balances`.
- [ ] `potBalance(month, potId, balances)` returns the recorded balance and its source month for that month, else carries forward the most recent earlier recorded balance (returning that earlier month), else `undefined` for a pot recorded in no month up to and including this one.
- [ ] `totalSaved(month, pots, balances)` is the sum of the active pots' carried balances; pots with no recorded balance contribute nothing; the sum of none is `0`.
- [ ] Both utilities are pure (no dispatch, state, or I/O) and neither imports Outflow / Account Net code.
- [ ] Balances for a *future* month relative to the recorded rows are never invented: carry-forward only looks backwards.
- [ ] Unit tests (Given/When/Then) cover: an exact-month balance wins; a missing month carries the last earlier balance; a gap of several months still carries the nearest earlier one; a pot with no record at all yields `undefined` and contributes nothing to `totalSaved`; a recorded `0` is respected as a real balance; an equal-named but removed pot's stale balance is ignored; and `totalSaved` over several pots.
- [ ] `npm run lint`, `npx tsc --noEmit`, and the new tests pass. No user-facing surface, so verification is the ticket's own gate plus a no-regression render check.

## Comments
