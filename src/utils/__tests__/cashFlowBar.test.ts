import { describe, expect, it } from 'vitest';
import type { Outflow } from '../../types';
import { cashFlowBar, cashFlowSlices } from '../cashFlowBar';

describe('cashFlowBar', () => {
  // Given a month's Income Total and Outflows Total
  // When filling the Dashboard's single cash-flow bar
  // Then the fill ratio and colour level are derived from them

  it('is green and partly full while income covers the outflows', () => {
    // Given 12.000 of income and 3.000 of outflows
    // When filling the bar
    const bar = cashFlowBar(12000, 3000);

    // Then it is a quarter full and under income
    expect(bar.ratio).toBeCloseTo(0.25, 10);
    expect(bar.level).toBe('under');
  });

  it('is green and empty when there are no outflows', () => {
    // Given income with nothing to pay
    // When filling the bar
    const bar = cashFlowBar(12000, 0);

    // Then nothing is filled and it is under
    expect(bar.ratio).toBe(0);
    expect(bar.level).toBe('under');
  });

  it('is over and capped at full as soon as outflows pass income', () => {
    // Given 12.000 of income and 13.200 of outflows
    // When filling the bar
    const bar = cashFlowBar(12000, 13200);

    // Then the bar caps at the whole income and flags over
    expect(bar.ratio).toBe(1);
    expect(bar.level).toBe('over');
  });

  it('treats spending everything as still under income', () => {
    // Given outflows exactly equal to income
    // When filling the bar
    const bar = cashFlowBar(12000, 12000);

    // Then the rule is strict: equality is still covered
    expect(bar.ratio).toBe(1);
    expect(bar.level).toBe('under');
  });

  it('reads a zero-income month with outflows as fully over', () => {
    // Given no income but outflows to pay
    // When filling the bar
    const bar = cashFlowBar(0, 3000);

    // Then there is no divide-by-zero: the bar is full and over
    expect(bar.ratio).toBe(1);
    expect(bar.level).toBe('over');
  });

  it('reads a month with neither income nor outflows as empty and under', () => {
    // Given a month with no cash flow at all
    // When filling the bar
    const bar = cashFlowBar(0, 0);

    // Then the bar is empty and unflagged
    expect(bar.ratio).toBe(0);
    expect(bar.level).toBe('under');
  });
});

const JUNE = '2026-06';
const MAY = '2026-05';

function outflow(
  overrides: Partial<Outflow> & Pick<Outflow, 'name' | 'amount'>
): Outflow {
  return {
    id: `${JUNE}-${overrides.name}`,
    month: JUNE,
    isPaid: false,
    isFinal: true,
    isInvestment: false,
    payerId: '',
    bankId: '',
    ...overrides,
  };
}

describe('cashFlowSlices', () => {
  // Given a month's outflows (each a Payment or Investment, final or not)
  // When composing the cash-flow bar
  // Then the four kind-and-state buckets are summed, shared and ordered

  it('returns the four slices in the fixed order with their shares of the total', () => {
    // Given 100 confirmed Payment, 50 unconfirmed Payment, 30 confirmed
    // Investment and 20 unconfirmed Investment (200 total)
    const slices = cashFlowSlices(JUNE, [
      outflow({ name: 'Luz', amount: 100, isFinal: true }),
      outflow({ name: 'Água', amount: 50, isFinal: false }),
      outflow({ name: 'Aporte', amount: 30, isInvestment: true, isFinal: true }),
      outflow({ name: 'CDB', amount: 20, isInvestment: true, isFinal: false }),
    ]);

    // Then the four slices come back in the fixed order, each with its amount
    // and its share of the 200 Outflows Total
    expect(slices.map((slice) => `${slice.kind}:${slice.confirmed}`)).toEqual([
      'payment:true',
      'payment:false',
      'investment:true',
      'investment:false',
    ]);
    expect(slices.map((slice) => slice.amount)).toEqual([100, 50, 30, 20]);
    expect(slices.map((slice) => slice.share)).toEqual([0.5, 0.25, 0.15, 0.1]);
  });

  it('keeps the fixed order whatever order the outflows arrive in', () => {
    // Given the same set shuffled, Investments first
    const slices = cashFlowSlices(JUNE, [
      outflow({ name: 'Aporte', amount: 30, isInvestment: true }),
      outflow({ name: 'Água', amount: 50, isFinal: false, isInvestment: true }),
      outflow({ name: 'Luz', amount: 100 }),
      outflow({ name: 'Cartão', amount: 20, isFinal: false }),
    ]);

    // Then the order is still Payments before Investments, confirmed before not
    expect(slices.map((slice) => `${slice.kind}:${slice.confirmed}`)).toEqual([
      'payment:true',
      'payment:false',
      'investment:true',
      'investment:false',
    ]);
  });

  it('yields no slices for an all-zero month', () => {
    // Given outflows summing to nothing
    // When composing the bar
    const slices = cashFlowSlices(JUNE, [
      outflow({ name: 'Luz', amount: 0 }),
      outflow({ name: 'Aporte', amount: 0, isInvestment: true }),
    ]);

    // Then there is no composition to draw
    expect(slices).toEqual([]);
  });

  it('yields no slices for a month with no outflows', () => {
    // Given only a May outflow
    // When composing June's bar
    const slices = cashFlowSlices(JUNE, [outflow({ name: 'Luz', amount: 100, month: MAY })]);

    // Then June has nothing to show
    expect(slices).toEqual([]);
  });

  it('splits an all-Payment month into confirmed and unconfirmed', () => {
    // Given only Payments, one confirmed and one not
    const slices = cashFlowSlices(JUNE, [
      outflow({ name: 'Luz', amount: 100 }),
      outflow({ name: 'Água', amount: 50, isFinal: false }),
    ]);

    // Then only the two Payment slices remain
    expect(slices.map((slice) => `${slice.kind}:${slice.confirmed}`)).toEqual([
      'payment:true',
      'payment:false',
    ]);
  });

  it('splits an all-Investment month into confirmed and unconfirmed', () => {
    // Given only Investments, one confirmed and one not
    const slices = cashFlowSlices(JUNE, [
      outflow({ name: 'Aporte', amount: 30, isInvestment: true }),
      outflow({ name: 'CDB', amount: 20, isInvestment: true, isFinal: false }),
    ]);

    // Then only the two Investment slices remain, sharing the whole bar
    expect(slices.map((slice) => `${slice.kind}:${slice.confirmed}`)).toEqual([
      'investment:true',
      'investment:false',
    ]);
    expect(slices.map((slice) => slice.share)).toEqual([0.6, 0.4]);
  });

  it('omits the zero slices around a single unconfirmed kind', () => {
    // Given one unconfirmed Investment only
    const slices = cashFlowSlices(JUNE, [
      outflow({ name: 'CDB', amount: 20, isInvestment: true, isFinal: false }),
    ]);

    // Then just that slice, holding the whole bar
    expect(slices).toEqual([
      { kind: 'investment', confirmed: false, amount: 20, share: 1 },
    ]);
  });
});
