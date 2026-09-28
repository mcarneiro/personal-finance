import type { Bill, Month } from '../types';
import { generateId } from './id';

/**
 * Seed a target month's bill list from another month's obligations — the
 * replicate-last-month action. Names, amounts, payers and banks carry over;
 * Paid deliberately does not, so last month's settled bills never arrive
 * pre-ticked (a new month's obligation starts open). The card bill is an
 * ordinary bill here, so it is reseeded like any other and edited to its real
 * statement value once the statement arrives.
 */
export function copyBills(sourceBills: Bill[], targetMonth: Month): Bill[] {
  return sourceBills.map((bill) => ({
    id: generateId(),
    month: targetMonth,
    name: bill.name,
    amount: bill.amount,
    isPaid: false,
    payerId: bill.payerId,
    bankId: bill.bankId,
  }));
}
