import { describe, expect, it } from 'vitest';
import { cashFlowBar } from '../cashFlowBar';

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
