import { describe, expect, it } from 'vitest';
import type { Month, SavingsBalance, SavingsPot } from '../../types';
import { totalSaved } from '../savings';
import { potTrendSeries, trendMaxTotals, trendTotal, trendWindow } from '../savingsTrend';

const OCT: Month = '2026-10';
const NOV: Month = '2025-11';
const SEP: Month = '2026-09';
const MAY: Month = '2026-05';
const APRIL: Month = '2026-04';

/** Build an active pot in the registry. */
function pot(id: string, name: string): SavingsPot {
  return { id, name };
}

/** Build a recorded balance row for one pot in one month. */
function balance(month: Month, potId: string, value: number): SavingsBalance {
  return { id: `${month}-${potId}`, month, potId, balance: value };
}

describe('trendWindow', () => {
  // Given an end month and a length
  // When building the rolling window of months
  // Then it runs oldest-first up to and including the end month

  it('yields 12 months ending at the end month, oldest first, across a year boundary', () => {
    // Given the trend should end at October 2026
    // When building a 12-month window
    const window = trendWindow(OCT, 12);

    // Then it starts the previous November and ends at October
    expect(window[0]).toBe(NOV);
    expect(window[window.length - 1]).toBe(OCT);
    expect(window).toEqual([
      NOV,
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      OCT,
    ]);
  });

  it('honours a shorter length', () => {
    // Given a 3-month window ending at October
    // When building the window
    const window = trendWindow(OCT, 3);

    // Then exactly three months, oldest first, are returned
    expect(window).toEqual(['2026-08', SEP, OCT]);
  });

  it('is pure and reads no data', () => {
    // Given a balances array that has nothing to do with the window
    const balances = [balance(OCT, 'pot-1', 11000)];

    // When building the window twice, around a mutation of the balances
    const before = trendWindow(OCT, 3);
    balances.push(balance(SEP, 'pot-1', 12000));
    const after = trendWindow(OCT, 3);

    // Then the window is a function of its arguments alone
    expect(after).toEqual(before);
  });
});

describe('trendTotal', () => {
  // Given active pots and recorded balances
  // When computing a month's stacked bar height
  // Then it equals the existing Total Saved for the same inputs

  it('matches totalSaved for a month with a carried balance and a retired pot', () => {
    // Given an active pot recorded in the month and a retired pot with stale rows
    const pots = [pot('pot-1', 'Emergência'), pot('pot-2', 'Aposentadoria')];
    const balances = [
      balance(MAY, 'pot-1', 9000),
      balance('pot-retired', OCT, 99999),
    ];

    // When computing the October trend total
    const result = trendTotal(OCT, pots, balances);

    // Then it is the carried value and equals Total Saved exactly
    expect(result).toBe(9000);
    expect(result).toBe(totalSaved(OCT, pots, balances));
  });

  it('matches totalSaved for an all-empty month', () => {
    // Given no recorded balances at all
    const pots = [pot('pot-1', 'Emergência')];

    // When computing the trend total
    // Then both are zero, never negative or NaN
    expect(trendTotal(APRIL, pots, [])).toBe(0);
    expect(trendTotal(APRIL, pots, [])).toBe(totalSaved(APRIL, pots, []));
  });
});

describe('potTrendSeries', () => {
  // Given the active registry and recorded balances
  // When computing a month's per-pot segments
  // Then every active pot appears once, in registry order, never a retired pot

  it('returns each active pot in registry order with its carried balance', () => {
    // Given two active pots, one recorded in the month and one earlier
    const pots = [pot('pot-1', 'Emergência'), pot('pot-2', 'Aposentadoria')];
    const balances = [balance(OCT, 'pot-1', 11000), balance(MAY, 'pot-2', 40000)];

    // When computing the October series
    const series = potTrendSeries(OCT, pots, balances);

    // Then the registry order is preserved and the carried value is used
    expect(series).toEqual([
      { potId: 'pot-1', value: 11000 },
      { potId: 'pot-2', value: 40000 },
    ]);
  });

  it('contributes zero for an active pot never recorded up to the month', () => {
    // Given a pot introduced in the middle of the window (its first record in June)
    const pots = [pot('pot-1', 'Emergência'), pot('pot-2', 'Viagem')];
    const balances = [balance('2026-06', 'pot-2', 5000)];

    // When computing a month before its first record
    const series = potTrendSeries(MAY, pots, balances);

    // Then the pot still has a zero-height segment, never a gap
    expect(series).toEqual([
      { potId: 'pot-1', value: 0 },
      { potId: 'pot-2', value: 0 },
    ]);
  });

  it('respects an explicit zero as a real value', () => {
    // Given a pot explicitly recorded as zero in the month
    const pots = [pot('pot-1', 'Emergência')];
    const balances = [balance('2026-05', 'pot-1', 10000), balance(OCT, 'pot-1', 0)];

    // When computing the October series
    // Then the segment is zero, not carried
    expect(potTrendSeries(OCT, pots, balances)).toEqual([{ potId: 'pot-1', value: 0 }]);
  });

  it('never includes a retired pot', () => {
    // Given a retired pot with lucky balance rows
    const pots = [pot('pot-1', 'Emergência')];
    const balances = [balance(OCT, 'pot-retired', 50000)];

    // When computing the series
    // Then only the active pot is a segment
    expect(potTrendSeries(OCT, pots, balances)).toEqual([{ potId: 'pot-1', value: 0 }]);
  });
});

describe('trendMaxTotals', () => {
  // Given a window of months and recorded balances
  // When computing the scale denominator
  // Then it is the tallest stacked total across the window

  it('is the maximum trendTotal over the window', () => {
    // Given a window whose middle month has the tallest stack
    const window = trendWindow(OCT, 3);
    const pots = [pot('pot-1', 'Emergência')];
    const balances = [balance(SEP, 'pot-1', 12000), balance(OCT, 'pot-1', 11000)];

    // When computing the maximum
    // Then it is September's carried-forward 12000 (fresh in September, carried in October)
    expect(trendMaxTotals(window, pots, balances)).toBe(12000);
  });

  it('is 0 for a window with no recorded balances, never NaN or -Infinity', () => {
    // Given a window and no records anywhere
    const window = trendWindow(OCT, 3);
    const pots = [pot('pot-1', 'Emergência')];

    // When computing the maximum
    const max = trendMaxTotals(window, pots, []);

    // Then it is a finite zero
    expect(max).toBe(0);
    expect(Number.isFinite(max)).toBe(true);
  });

  it('is 0 for an empty pot registry', () => {
    // Given no active pots
    // When computing the maximum over the window
    // Then it is zero
    expect(trendMaxTotals(trendWindow(OCT, 3), [], [])).toBe(0);
  });
});
