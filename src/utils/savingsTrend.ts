import type { Month, SavingsBalance, SavingsPot } from '../types';
import { shiftMonth } from './month';
import { potBalance, totalSaved } from './savings';

/**
 * The Savings trend arithmetic, as pure functions over the recorded balances
 * and the active pot registry (ADR-0011). A view-layer sibling of
 * `utils/savings.ts` in the shape of `utils/controlLoop.ts`: it turns history
 * into the exact stacked-bar series the Dashboard chart renders, and keeps the
 * only silent-bug surface of the feature inside tests.
 *
 * Pot colours are the caller's job: the registry order returned by
 * `potTrendSeries` is the index that assigns them.
 */

/**
 * The rolling window of `length` months ending at `endMonth`, oldest first, so
 * the newest month is the last element (the right-edge column). Makes no claim
 * about recorded data — empty months are the caller's to zero-fill.
 */
export function trendWindow(endMonth: Month, length = 12): Month[] {
  const months: Month[] = [];
  for (let offset = length - 1; offset >= 0; offset--) {
    months.push(shiftMonth(endMonth, -offset));
  }
  return months;
}

/**
 * One pot's segment in a month's stacked column: the pot and its carried
 * balance for that month. Mirrors `CarriedBalance`, reduced to what the stack
 * needs.
 */
export interface PotTrendSegment {
  potId: string;
  value: number;
}

/**
 * The stacked bar's height for a month: Total Saved, already carry-forward and
 * active-pots-only. Delegates to `totalSaved` so the chart's column height and
 * the Savings screen's headline can never drift apart.
 */
export function trendTotal(
  month: Month,
  pots: SavingsPot[],
  balances: SavingsBalance[]
): number {
  return totalSaved(month, pots, balances);
}

/**
 * Each active pot's carried balance for a month, in registry order, so the
 * caller can stack segments and colour them by index. A pot with no recorded
 * balance up to and including the month contributes `0` — a zero-height
 * segment, never a gap — which keeps a stacked column's segments aligned
 * across months. A retired pot never appears.
 */
export function potTrendSeries(
  month: Month,
  pots: SavingsPot[],
  balances: SavingsBalance[]
): PotTrendSegment[] {
  return pots.map((pot) => ({
    potId: pot.id,
    value: potBalance(month, pot.id, balances)?.balance ?? 0,
  }));
}

/**
 * The tallest stacked total across the window — the zero-based scale
 * denominator. Built from `trendTotal` per month only, never per-pot, so no
 * single pot's segment can overflow its column. An empty window is a finite
 * `0`, which the caller uses to hide the section.
 */
export function trendMaxTotals(
  window: Month[],
  pots: SavingsPot[],
  balances: SavingsBalance[]
): number {
  return window.reduce((max, month) => Math.max(max, trendTotal(month, pots, balances)), 0);
}
