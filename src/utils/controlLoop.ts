import type { Outflow, CardSpending, IncomeEntry, Month, PlanItem } from '../types';
import { remainingFraction } from './planPace';

/**
 * The control-loop derived numbers, as pure functions over month-scoped
 * entities. They are never stored in state or in the sheet — every screen
 * reads them by calling these (see spec.md, Implementation Decisions):
 *
 *   Plan Total        = Σ bucket caps
 *   Total Spent       = Σ card totals
 *   Projected Result  = Plan Total − Total Spent − Σ remaining estimates
 *   Plan Result       = Plan Total − Total Spent
 *   Income Total      = Σ income
 *   Outflows Total       = Σ outflows
 *   Account Net       = Σ income − Σ outflows
 *
 * Each function filters by `month`, so callers pass the full arrays from the
 * store; no rendering or store coupling lives here. A function that reads the
 * calendar takes a `now` defaulting to the real clock, so tests can pin it.
 */

/** Σ bucket caps for the month. */
export function planTotal(month: Month, items: PlanItem[]): number {
  return items
    .filter((item) => item.month === month)
    .reduce((total, item) => total + item.amount, 0);
}

/** Σ card totals for the month. Cards without a check-in row contribute nothing. */
export function totalSpent(month: Month, cardSpending: CardSpending[]): number {
  return cardSpending
    .filter((entry) => entry.month === month)
    .reduce((total, entry) => total + entry.total, 0);
}

/**
 * The pro-rata share of a bucket's cap still to come — what an empty Remaining
 * Estimate falls back to, and the value the plan screen hints in the field. It
 * is zero for any month but the browsed current one, because the fallback is a
 * current-month assist (see `remainingFraction`).
 */
export function autoRemainingEstimate(item: PlanItem, now: Date = new Date()): number {
  return item.amount * remainingFraction(item.month, now);
}

/**
 * The Remaining Estimate a bucket contributes. A recorded value — anything but
 * zero — is the household's own estimate and wins; an empty field (`0`) falls
 * back to the automatic, pro-rata one. That is the one control-loop input the
 * household can stop typing, leaving the card check-in as the only manual step.
 */
export function effectiveRemainingEstimate(item: PlanItem, now: Date = new Date()): number {
  if (item.remainingEstimate !== 0) return item.remainingEstimate;
  return autoRemainingEstimate(item, now);
}

/** The live sobra: Plan Total − Total Spent − Σ remaining estimates. */
export function projectedResult(
  month: Month,
  items: PlanItem[],
  cardSpending: CardSpending[],
  now: Date = new Date()
): number {
  const remainingEstimates = items
    .filter((item) => item.month === month)
    .reduce((total, item) => total + effectiveRemainingEstimate(item, now), 0);
  return planTotal(month, items) - totalSpent(month, cardSpending) - remainingEstimates;
}

/** The final month result: Plan Total − Total Spent (estimates zeroed at month end). */
export function planResult(
  month: Month,
  items: PlanItem[],
  cardSpending: CardSpending[]
): number {
  return planTotal(month, items) - totalSpent(month, cardSpending);
}

/** Σ income for the month — the headline of the Income screen. */
export function incomeTotal(month: Month, income: IncomeEntry[]): number {
  return income
    .filter((entry) => entry.month === month)
    .reduce((total, entry) => total + entry.amount, 0);
}

/** Σ outflows for the month. Outflows count regardless of paid status. */
export function outflowsTotal(month: Month, outflows: Outflow[]): number {
  return outflows
    .filter((outflow) => outflow.month === month)
    .reduce((total, outflow) => total + outflow.amount, 0);
}

/** Σ income − Σ outflows for the month. */
export function accountNet(month: Month, income: IncomeEntry[], outflows: Outflow[]): number {
  return incomeTotal(month, income) - outflowsTotal(month, outflows);
}
