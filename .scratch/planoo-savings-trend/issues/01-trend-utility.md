# 01 — Savings trend window and series utility

**What to build:** The arithmetic for the trend, with no UI. A pure utility
module — a sibling of `utils/savings.ts`, in the shape of `utils/controlLoop.ts`
— that turns the recorded balances and the active pot registry into the exact
series the chart will render, so the only silent-bug surface here is fully
tested before any pixels exist.

Add to `src/utils/savings.ts` (or a new `src/utils/savingsTrend.ts` that imports
it — pick the smaller diff and keep it pure):

- `trendWindow(endMonth: Month, length = 12): Month[]` — the rolling window of
  `length` months ending at `endMonth`, oldest first, so the newest month is the
  last element (the right-edge column). Built with `shiftMonth` from
  `utils/month.ts`; asserts nothing about data.
- `trendTotal(month, pots, balances)` — the stacked bar's height for a month.
  This is `totalSaved(month, pots, balances)` (already carry-forward, already
  active-pots-only). Reuse it rather than re-deriving; do not add a second
  summation that could drift.
- `potTrendSeries(month, pots, balances): { potId: string; value: number }[]` —
  each active pot's carried balance for that month, in registry order, so the
  caller can stack segments and colour them by index. A pot with no recorded
  balance up to and including the month contributes `0` (a zero-height segment,
  never a gap) — this keeps a stacked column's segments aligned across months.
- `trendMaxTotals(window, pots, balances): number` — the tallest stacked total
  across the window, the zero-based scale denominator. Reuse `trendTotal` per
  month; never compute a per-pot max (that would let one pot's segment overflow
  the column).

Land `savingsTrend.ts` with a matching `__tests__/savingsTrend.test.ts`.

**Blocked by:** None.

**Status:** done

- [x] `trendWindow('2026-10', 12)` yields `2025-11 … 2026-10` oldest-first, across a year boundary; `length` is honoured (a 3-month window yields 3); the window is pure and reads no state.
- [x] `trendTotal` is the existing `totalSaved` value for the month (assert equality against `totalSaved` for the same inputs so the two can never drift), so a retired pot is excluded and a carried balance is included.
- [x] `potTrendSeries` returns the active pots in registry order with each pot's carried balance, a `0` for a pot never recorded, and never a retired pot.
- [x] `trendMaxTotals` is the maximum of `trendTotal` over the window and is `0` for a window with no recorded balances (the caller uses that to hide the section), never `NaN` or `-Infinity`.
- [x] The utility imports neither Outflows / Account Net code nor Redux; it stays pure like `utils/savings.ts`.
- [x] Unit tests (Given/When/Then) cover: a 12-month window's boundaries; a mid-window pot introduced (zero-filled before its first record); a carried-forward month inside the window; a retired pot ignored; an explicit `0` month respected; an all-empty window giving `maxTotals === 0`; and the equality of `trendTotal` with `totalSaved`.
- [x] `npm run lint`, `npx tsc --noEmit`, and the new tests pass. No user-facing surface, so verification is this ticket's own gate.

## Comments

Landed `src/utils/savingsTrend.ts` with a matching `__tests__/savingsTrend.test.ts` (new-file branch, per the ticket's "pick the smaller diff"; `savings.ts` untouched).

- `trendWindow(endMonth, length = 12)` builds the rolling window with `shiftMonth`, oldest-first, ending at `endMonth`.
- `trendTotal` delegates to `totalSaved`, so the bar height and the Savings headline cannot drift.
- `potTrendSeries` maps the active registry (order and colours preserved) to `PotTrendSegment[]`, zero-filling a pot with no record up to the month.
- `trendMaxTotals` reduces `trendTotal` across the window, seeded at `0` so an empty window is a finite `0`, never `NaN`/`-Infinity`; per-pot maxima are never computed.
- `PotTrendSegment` is a named export matching `savings.ts`'s `CarriedBalance` convention. The module imports only `types`, `month.ts`, and `savings.ts` — no Redux, Outflows, or Account Net.

Verification: 12 new Given/When/Then tests, the full suite (39 files, 428 tests), `npx tsc --noEmit`, and `npm run lint` all pass. No user-facing surface exists yet, so there is nothing to verify in the browser for this ticket; ticket 02 introduces the pixels.

## Comments
