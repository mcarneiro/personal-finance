import type { Month } from '../types';
import { formatMonth } from './month';

/**
 * How this month's card spending is pacing against its Spending Plan. The
 * Dashboard shows a filled bar (Total Spent against Plan Total) and colours it
 * by comparing how far through the plan you are against how far through the
 * month you are — the household checks in roughly weekly, so a month's spend
 * moves in ~25% steps and the two are always out of phase by up to a quarter.
 *
 * Like every other derived number this is computed on the fly and never stored.
 * Plan Total − Total Spent is the month's Plan Result (CONTEXT.md); the pace
 * adds the time comparison on top.
 */

/**
 * How far spend may run ahead of the month (in fraction of the plan) before it
 * is flagged. A quarter absorbs the weekly check-in cadence: with ~25% steps,
 * a smaller margin would cry yellow on every normal week.
 */
export const PACE_AHEAD_THRESHOLD = 0.25;

/** The colour the Dashboard gives the plan bar. */
export type PlanPaceLevel = 'under' | 'ahead' | 'over';

export interface PlanPace {
  /** Total Spent / Plan Total; can exceed 1 once spent passes the plan. 0 when there is no plan. */
  spendRatio: number;
  /** The fraction of the month already elapsed, 0..1. */
  monthRatio: number;
  level: PlanPaceLevel;
  /** Plan Total − Total Spent. Positive is headroom still available; negative is the overage. */
  headroom: number;
}

/** Days in a `YYYY-MM` month, independent of the clock. */
function daysInMonth(month: Month): number {
  const [year, monthIndex] = month.split('-').map(Number);
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
}

/**
 * The fraction of `month` that has elapsed at `now`: elapsed days over days in
 * the month, counting today as already elapsed, capped at 1. A past month is
 * complete (1) and a future month has not started (0).
 */
export function monthProgress(month: Month, now: Date = new Date()): number {
  const currentMonth = formatMonth(now);
  if (month < currentMonth) return 1;
  if (month > currentMonth) return 0;
  return Math.min(1, now.getDate() / daysInMonth(month));
}

/**
 * Classify the month's spend pace. Over plan the moment spent passes the plan;
 * otherwise ahead when spend% runs more than `PACE_AHEAD_THRESHOLD` ahead of
 * month%; otherwise under. A zero plan yields no ratio and no flag — the
 * Dashboard hides the block entirely in that case.
 */
export function planPace(
  month: Month,
  planTotal: number,
  totalSpent: number,
  now: Date = new Date()
): PlanPace {
  const spendRatio = planTotal > 0 ? totalSpent / planTotal : 0;
  const monthRatio = monthProgress(month, now);
  const headroom = planTotal - totalSpent;

  let level: PlanPaceLevel = 'under';
  if (totalSpent > planTotal) {
    level = 'over';
  } else if (spendRatio - monthRatio > PACE_AHEAD_THRESHOLD) {
    level = 'ahead';
  }

  return { spendRatio, monthRatio, level, headroom };
}
