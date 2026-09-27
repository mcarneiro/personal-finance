import type { IncomeEntry, Month } from '../types';
import { generateId } from './id';

/**
 * Seed a target month's income list from another month's entries — the
 * replicate-last-month action. Amounts and source notes carry over; every copy
 * gets a fresh id so it can never collide with its source. Income is an
 * expectation, not a receipt, so there is nothing else to preserve.
 */
export function copyIncomeEntries(sourceEntries: IncomeEntry[], targetMonth: Month): IncomeEntry[] {
  return sourceEntries.map((entry) => ({
    id: generateId(),
    month: targetMonth,
    amount: entry.amount,
    source: entry.source,
  }));
}
