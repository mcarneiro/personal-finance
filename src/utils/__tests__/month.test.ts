import { describe, expect, it } from 'vitest';
import { formatMonth, getMonthName, isValidMonth, parseMonth, shiftMonth } from '../month';

describe('month utilities', () => {
  it('accepts well-formed months and rejects malformed ones', () => {
    // Given a set of month-shaped strings
    // When validating them
    // Then only real YYYY-MM months pass
    expect(isValidMonth('2026-06')).toBe(true);
    expect(isValidMonth('2026-12')).toBe(true);
    expect(isValidMonth('2026-13')).toBe(false);
    expect(isValidMonth('2026-00')).toBe(false);
    expect(isValidMonth('2026-6')).toBe(false);
    expect(isValidMonth('not-a-month')).toBe(false);
    expect(isValidMonth(undefined)).toBe(false);
  });

  it('formats a Date as YYYY-MM using the local calendar month', () => {
    // Given a date in June 2026
    const date = new Date(2026, 5, 15);

    // When formatting it as a month
    const result = formatMonth(date);

    // Then it is June 2026
    expect(result).toBe('2026-06');
  });

  it('shifts forward and backward across a year boundary', () => {
    // Given January 2026
    // When shifting forward and backward
    // Then the adjacent months are correct
    expect(shiftMonth('2026-01', 1)).toBe('2026-02');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('shifts from December into the next January', () => {
    // Given December 2026
    // When shifting forward one month
    // Then it lands in January 2027
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('round-trips a month string through parse and format', () => {
    // Given a month string
    const month = '2026-06';

    // When parsing and re-formatting
    const result = formatMonth(parseMonth(month));

    // Then the month is preserved
    expect(result).toBe(month);
  });

  it('names a month in Portuguese and English', () => {
    // Given June 2026
    // When asking for the localized month name
    // Then each locale reads naturally
    expect(getMonthName('2026-06', 'pt-BR')).toBe('junho de 2026');
    expect(getMonthName('2026-06', 'en-US')).toBe('June 2026');
  });
});
