import type { Bank, Outflow, Month, Payer } from '../types';

/**
 * How the month's outflows split across payer and bank — the "who spends what
 * where" summary, and how much of it is still to pay. Like every other derived
 * number it is computed here, on the fly, and never stored.
 *
 * Outflows are grouped by payer (the top level) and then by bank within each payer.
 * Each group and bank line carries its full `total` and its `remaining` — the
 * part of that total whose outflows are still open (not `isPaid`). Registry order
 * is preserved so the summary reads in the order the household maintains its
 * lists; any unset or removed reference sorts last. A outflow whose registry entry
 * is missing still contributes its amount — removing an entry must never lose
 * money from the totals (mirrors ADR-0002).
 */

export interface BankTotal {
  /** `''` when the outflow's bank is unset or no longer registered. */
  bankId: string;
  /** `''` when unresolved; the screen substitutes a translated fallback. */
  bankName: string;
  total: number;
  /** The part of `total` still open (not paid). */
  remaining: number;
}

export interface PayerGroup {
  /** `''` when the outflow's payer is unset or no longer registered. */
  payerId: string;
  /** `''` when unresolved; the screen substitutes a translated fallback. */
  payerName: string;
  total: number;
  /** The part of `total` still open (not paid). */
  remaining: number;
  banks: BankTotal[];
}

/** Registry ids first (in registry order), then unknown ids in first-seen order. */
export function orderKeys(preferred: string[], present: string[]): string[] {
  const presentSet = new Set(present);
  const known = preferred.filter((id) => presentSet.has(id));
  const knownSet = new Set(known);
  return [...known, ...present.filter((id) => !knownSet.has(id))];
}

/**
 * The month's outflows grouped by payer and then bank, with totals and the part
 * still to pay. Months with no outflows yield an empty array (the screen shows its
 * empty state).
 */
export function outflowsByPayerAndBank(
  month: Month,
  outflows: Outflow[],
  banks: Bank[],
  payers: Payer[]
): PayerGroup[] {
  const monthOutflows = outflows.filter((outflow) => outflow.month === month);
  if (monthOutflows.length === 0) return [];

  const payerNames = new Map(payers.map((payer) => [payer.id, payer.name]));
  const bankNames = new Map(banks.map((bank) => [bank.id, bank.name]));

  // payerId -> (bankId -> { total, remaining }), insertion-ordered.
  interface Line {
    total: number;
    remaining: number;
  }
  const byPayer = new Map<string, Map<string, Line>>();
  for (const outflow of monthOutflows) {
    const banksForPayer = byPayer.get(outflow.payerId) ?? new Map<string, Line>();
    const line = banksForPayer.get(outflow.bankId) ?? { total: 0, remaining: 0 };
    line.total += outflow.amount;
    if (!outflow.isPaid) line.remaining += outflow.amount;
    banksForPayer.set(outflow.bankId, line);
    byPayer.set(outflow.payerId, banksForPayer);
  }

  const payerKeys = orderKeys(
    payers.map((payer) => payer.id),
    [...byPayer.keys()]
  );
  const bankOrder = banks.map((bank) => bank.id);

  return payerKeys.map((payerId) => {
    const banksForPayer = byPayer.get(payerId) ?? new Map<string, Line>();
    const bankKeys = orderKeys(bankOrder, [...banksForPayer.keys()]);
    const banks = bankKeys.map((bankId) => {
      const line = banksForPayer.get(bankId) ?? { total: 0, remaining: 0 };
      return {
        bankId,
        bankName: bankNames.get(bankId) ?? '',
        total: line.total,
        remaining: line.remaining,
      };
    });

    return {
      payerId,
      payerName: payerNames.get(payerId) ?? '',
      total: banks.reduce((sum, bank) => sum + bank.total, 0),
      remaining: banks.reduce((sum, bank) => sum + bank.remaining, 0),
      banks,
    };
  });
}
