import type { Outflow, Month } from '../types';
import { generateId } from './id';

/**
 * Seed a target month's outflow list from another month's obligations — the
 * replicate-last-month action. Names, amounts, payers, banks and the
 * Payment/Investment kind carry over; Paid and Final deliberately do not, so
 * last month's settled state never arrives pre-ticked or pre-confirmed (a new
 * month's obligation starts open and awaiting review). The kind does carry,
 * though — a recurring contribution stays an Investment — because it describes
 * what the outflow is, not last month's workflow. The card bill is an ordinary
 * outflow here, so it is reseeded like any other and edited to its real
 * statement value once the statement arrives.
 */
export function copyOutflows(sourceOutflows: Outflow[], targetMonth: Month): Outflow[] {
  return sourceOutflows.map((outflow) => ({
    id: generateId(),
    month: targetMonth,
    name: outflow.name,
    amount: outflow.amount,
    isPaid: false,
    isFinal: false,
    isInvestment: outflow.isInvestment,
    payerId: outflow.payerId,
    bankId: outflow.bankId,
  }));
}
