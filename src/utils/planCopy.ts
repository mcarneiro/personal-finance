import type { Month, PlanItem } from '../types';
import { generateId } from './id';

/**
 * Seed a target month's Spending Plan from another month's items — the
 * copy-last-month action. Names and caps carry over; Remaining Estimates
 * deliberately do not, so last month's forecast never leaks into the new month
 * (spec: the copy seeds composition only, estimates start at zero).
 * Card Spending is a separate tab and is never touched by this.
 */
export function copyPlanItems(sourceItems: PlanItem[], targetMonth: Month): PlanItem[] {
  return sourceItems.map((item) => ({
    id: generateId(),
    month: targetMonth,
    name: item.name,
    amount: item.amount,
    remainingEstimate: 0,
  }));
}
