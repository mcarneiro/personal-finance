/**
 * How this month's cash flow reads as a single bar on the Dashboard: outflows
 * against income. The bar fills to Outflows / Income (capped at the whole
 * income so it never overshoots) and is coloured green while the income covers
 * the outflows, red once they pass it. Unlike the Spending Plan's pace this has
 * no time dimension — monthly outflows are lumpy obligations, not a steady
 * spend — so there are only two states.
 *
 * Like every other derived number this is computed on the fly and never stored.
 */

/** The colour the Dashboard gives the cash-flow bar. */
export type CashFlowLevel = 'under' | 'over';

export interface CashFlowBar {
  /** Outflows / Income, capped at 1. Income of zero with outflows reads as fully over. */
  ratio: number;
  level: CashFlowLevel;
}

/**
 * Classify the month's cash flow. Over the moment outflows pass income (strictly;
 * equality still reads as covered); otherwise under. A zero income with outflows
 * reads as fully over, and a zero/zero month reads as empty and under.
 */
export function cashFlowBar(income: number, outflows: number): CashFlowBar {
  const ratio = income > 0 ? Math.min(1, outflows / income) : outflows > 0 ? 1 : 0;
  const level: CashFlowLevel = outflows > income ? 'over' : 'under';
  return { ratio, level };
}
