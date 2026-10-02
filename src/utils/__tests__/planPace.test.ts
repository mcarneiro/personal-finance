import { describe, expect, it } from 'vitest';
import type { Month } from '../../types';
import { PACE_AHEAD_THRESHOLD, monthProgress, planPace } from '../planPace';

const JUNE: Month = '2026-06';
const MAY: Month = '2026-05';
const JULY: Month = '2026-07';

/** A local date inside the given month/day, used to pin "now" for the pace tests. */
function dayOf(month: Month, day: number): Date {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(year, monthIndex - 1, day, 12, 0, 0);
}

describe('monthProgress', () => {
  // Given a month and a clock
  // When measuring how much of the month has elapsed
  // Then the elapsed days count today, capped at the whole month
  it.each([
    ['the first day of a 30-day month', JUNE, dayOf(JUNE, 1), 1 / 30],
    ['mid-month', JUNE, dayOf(JUNE, 15), 15 / 30],
    ['the last day', JUNE, dayOf(JUNE, 30), 1],
    ['a 31-day month at the same day', '2026-07' as Month, dayOf('2026-07' as Month, 15), 15 / 31],
  ])('reads the elapsed fraction for %s', (_label, month, now, expected) => {
    expect(monthProgress(month, now)).toBeCloseTo(expected, 10);
  });

  // Given the Dashboard only ever shows the current month
  // When asked about a month other than "now"'s
  // Then a past month is fully elapsed and a future one has not started
  it('reads a past month as complete and a future month as not started', () => {
    // Given now is in June
    const now = dayOf(JUNE, 15);

    // When measuring May and July
    // Then May is done and July has not begun
    expect(monthProgress(MAY, now)).toBe(1);
    expect(monthProgress(JULY, now)).toBe(0);
  });
});

describe('planPace', () => {
  // Given a plan total, what has been spent, and where the month is
  // When classifying the month's spend pace
  // Then the ratio, headroom and colour level are derived from them
  it('is under plan when spend tracks the month', () => {
    // Given a 1.000 plan and 300 spent by mid-June
    // When classifying the pace
    const pace = planPace(JUNE, 1000, 300, dayOf(JUNE, 15));

    // Then it is under, with the remaining headroom
    expect(pace.spendRatio).toBeCloseTo(0.3, 10);
    expect(pace.monthRatio).toBeCloseTo(0.5, 10);
    expect(pace.level).toBe('under');
    expect(pace.headroom).toBe(700);
  });

  it('is ahead when spend outruns the month by more than a quarter', () => {
    // Given a 1.000 plan and 800 spent on day 5
    // When classifying the pace
    const pace = planPace(JUNE, 1000, 800, dayOf(JUNE, 5));

    // Then it is ahead, with headroom still positive
    expect(pace.level).toBe('ahead');
    expect(pace.headroom).toBe(200);
  });

  it('stays under when the lead is exactly the threshold', () => {
    // Given a lead of exactly 25 percentage points (spend 75% at month 50%)
    // When classifying the pace
    const pace = planPace(JUNE, 1000, 750, dayOf(JUNE, 15));

    // Then the rule is strict: exactly a quarter ahead is still under
    expect(pace.spendRatio - pace.monthRatio).toBeCloseTo(PACE_AHEAD_THRESHOLD, 10);
    expect(pace.level).toBe('under');
  });

  it('is over plan as soon as spent passes the plan total', () => {
    // Given a 1.000 plan and 1.100 spent
    // When classifying the pace
    const pace = planPace(JUNE, 1000, 1100, dayOf(JUNE, 15));

    // Then it is over, with a negative headroom equal to the overage
    expect(pace.level).toBe('over');
    expect(pace.headroom).toBe(-100);
  });

  it('never produces a level or ratio from a zero plan', () => {
    // Given a month with no Spending Plan
    // When classifying the pace
    const pace = planPace(JUNE, 0, 0, dayOf(JUNE, 15));

    // Then there is no divide-by-zero and nothing is flagged
    expect(pace.spendRatio).toBe(0);
    expect(pace.level).toBe('under');
    expect(pace.headroom).toBe(0);
  });
});
