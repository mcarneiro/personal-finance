import type { Bank, Bill, Month, Payer } from '../types';

/**
 * How the month's bills split across payer and bank — the "who spends what
 * where" summary. Like every other derived number it is computed here, on the
 * fly, and never stored.
 *
 * Bills are grouped by payer (the top level) and then by bank within each payer.
 * Registry order is preserved so the summary reads in the order the household
 * maintains its lists; any unset or removed reference sorts last. A bill whose
 * registry entry is missing still contributes its amount — removing an entry
 * must never lose money from the totals (mirrors ADR-0002).
 */

export interface BankTotal {
  /** `''` when the bill's bank is unset or no longer registered. */
  bankId: string;
  /** `''` when unresolved; the screen substitutes a translated fallback. */
  bankName: string;
  total: number;
}

export interface PayerGroup {
  /** `''` when the bill's payer is unset or no longer registered. */
  payerId: string;
  /** `''` when unresolved; the screen substitutes a translated fallback. */
  payerName: string;
  total: number;
  banks: BankTotal[];
}

/** Registry ids first (in registry order), then unknown ids in first-seen order. */
function orderKeys(preferred: string[], present: string[]): string[] {
  const presentSet = new Set(present);
  const known = preferred.filter((id) => presentSet.has(id));
  const knownSet = new Set(known);
  return [...known, ...present.filter((id) => !knownSet.has(id))];
}

/**
 * The month's bills grouped by payer and then bank, with totals. Months with no
 * bills yield an empty array (the screen shows its empty state).
 */
export function billsByPayerAndBank(
  month: Month,
  bills: Bill[],
  banks: Bank[],
  payers: Payer[]
): PayerGroup[] {
  const monthBills = bills.filter((bill) => bill.month === month);
  if (monthBills.length === 0) return [];

  const payerNames = new Map(payers.map((payer) => [payer.id, payer.name]));
  const bankNames = new Map(banks.map((bank) => [bank.id, bank.name]));

  // payerId -> (bankId -> total), insertion-ordered by first appearance.
  const byPayer = new Map<string, Map<string, number>>();
  for (const bill of monthBills) {
    const banksForPayer = byPayer.get(bill.payerId) ?? new Map<string, number>();
    banksForPayer.set(bill.bankId, (banksForPayer.get(bill.bankId) ?? 0) + bill.amount);
    byPayer.set(bill.payerId, banksForPayer);
  }

  const payerKeys = orderKeys(
    payers.map((payer) => payer.id),
    [...byPayer.keys()]
  );
  const bankOrder = banks.map((bank) => bank.id);

  return payerKeys.map((payerId) => {
    const banksForPayer = byPayer.get(payerId) ?? new Map<string, number>();
    const bankKeys = orderKeys(bankOrder, [...banksForPayer.keys()]);
    const banks = bankKeys.map((bankId) => ({
      bankId,
      bankName: bankNames.get(bankId) ?? '',
      total: banksForPayer.get(bankId) ?? 0,
    }));

    return {
      payerId,
      payerName: payerNames.get(payerId) ?? '',
      total: banks.reduce((sum, bank) => sum + bank.total, 0),
      banks,
    };
  });
}
