/**
 * How this month's cash flow reads as a single bar on the Dashboard: outflows
 * against income. The bar fills to Outflows / Income (capped at the whole
 * income so it never overshoots) and is coloured green while the income covers
 * the outflows, red once they pass it. Unlike the Spending Plan's pace this has
 * no time dimension — monthly outflows are lumpy obligations, not a steady
 * spend — so there are only two states.
 *
 * Within that fill the bar is also the month's outflow composition: the four
 * kinds-and-states — confirmed Payments, unconfirmed Payments, confirmed
 * Investments, unconfirmed Investments — each sized by its share of the
 * Outflows Total, so the slices always add up to the whole drawn bar whether
 * the month is under or over income. That breakdown is display-only: it changes
 * no total.
 *
 * Like every other derived number this is computed on the fly and never stored.
 */

import type { Month, Outflow } from '../types';

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

/** One slice of the cash-flow bar's fill: a kind and confirmation state. */
export interface CashFlowSlice {
  /** The outflow kind this slice aggregates. */
  kind: 'payment' | 'investment';
  /** Whether the amounts are confirmed (final) for the month. */
  confirmed: boolean;
  /** Σ of the month's outflows this slice covers. */
  amount: number;
  /** The slice's share of the month's Outflows Total (0 when the total is zero). */
  share: number;
}

/**
 * The month's outflow composition as the bar's slices — confirmed Payments,
 * unconfirmed Payments, confirmed Investments, unconfirmed Investments — in that
 * fixed order. Each carries the Σ of the month's outflows it covers and its share
 * of the month's Outflows Total, so the slices always add up to the whole drawn
 * bar; a zero slice is dropped, so an all-zero month yields none.
 *
 * Filtering by `month` here keeps callers passing the full store arrays, exactly
 * as the control-loop utilities do. Display-only: no total is changed.
 */
export function cashFlowSlices(month: Month, outflows: Outflow[]): CashFlowSlice[] {
  const monthOutflows = outflows.filter((outflow) => outflow.month === month);
  const total = monthOutflows.reduce((sum, outflow) => sum + outflow.amount, 0);
  const buckets: Array<Pick<CashFlowSlice, 'kind' | 'confirmed'>> = [
    { kind: 'payment', confirmed: true },
    { kind: 'payment', confirmed: false },
    { kind: 'investment', confirmed: true },
    { kind: 'investment', confirmed: false },
  ];
  return buckets
    .map(({ kind, confirmed }) => {
      const amount = monthOutflows
        .filter(
          (outflow) =>
            outflow.isInvestment === (kind === 'investment') && outflow.isFinal === confirmed
        )
        .reduce((sum, outflow) => sum + outflow.amount, 0);
      return { kind, confirmed, amount, share: total > 0 ? amount / total : 0 };
    })
    .filter((slice) => slice.amount !== 0);
}
