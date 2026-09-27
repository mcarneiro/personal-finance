import type { Bill, CardSpending, IncomeEntry, Month, PlanItem } from '../types';

/**
 * The five control-loop derived numbers, as pure functions over month-scoped
 * entities. They are never stored in state or in the sheet — every screen
 * reads them by calling these (see spec.md, Implementation Decisions):
 *
 *   Plan Total        = Σ fixed charges + Σ bucket caps
 *   Total Spent       = Σ card totals
 *   Projected Result  = Plan Total − Total Spent − Σ remaining estimates
 *   Plan Result       = Plan Total − Total Spent
 *   Account Net       = Σ income − Σ bills
 *
 * Each function filters by `month`, so callers pass the full arrays from the
 * store; no rendering or store coupling lives here.
 */

/** Σ fixed charges + Σ bucket caps for the month. */
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

/** The live sobra: Plan Total − Total Spent − Σ remaining estimates. */
export function projectedResult(
  month: Month,
  items: PlanItem[],
  cardSpending: CardSpending[]
): number {
  const remainingEstimates = items
    .filter((item) => item.month === month && item.kind === 'variable')
    .reduce((total, item) => total + item.remainingEstimate, 0);
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

/** Σ income − Σ bills for the month. Bills count regardless of paid status. */
export function accountNet(month: Month, income: IncomeEntry[], bills: Bill[]): number {
  const incomeTotal = income
    .filter((entry) => entry.month === month)
    .reduce((total, entry) => total + entry.amount, 0);
  const billsTotal = bills
    .filter((bill) => bill.month === month)
    .reduce((total, bill) => total + bill.amount, 0);
  return incomeTotal - billsTotal;
}
