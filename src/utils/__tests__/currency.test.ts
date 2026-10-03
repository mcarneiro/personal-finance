import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDisplayAmount, parseAmount } from '../currency';

describe('formatCurrency', () => {
  it('formats an amount as localized BRL in pt-BR', () => {
    // Given an amount in the app's single currency (BRL)
    // When it is formatted for the primary language
    // Then it uses pt-BR grouping and decimal separators
    expect(formatCurrency(10750, 'pt-BR')).toMatch(/10\.750,00/);
  });

  it('formats an amount as localized BRL in en-US', () => {
    // Given an amount
    // When it is formatted for the secondary language
    // Then it uses en-US grouping and decimal separators, keeping BRL
    expect(formatCurrency(10750, 'en-US')).toMatch(/10,750\.00/);
  });

  it('formats a negative amount (an over-plan result)', () => {
    // Given a negative result (the month went over the plan)
    // When it is formatted in the primary language
    // Then the sign is shown before the currency symbol
    expect(formatCurrency(-2304, 'pt-BR')).toMatch(/-R\$\s?2\.304,00/);
  });
});

describe('formatDisplayAmount', () => {
  it('mirrors formatCurrency when values are not hidden', () => {
    // Given a value and Privacy Mode off
    // When it is formatted for display
    // Then it reads exactly like formatCurrency
    expect(formatDisplayAmount(10750, 'pt-BR', false)).toBe(formatCurrency(10750, 'pt-BR'));
  });

  it('returns the mask when values are hidden, in pt-BR', () => {
    // Given a value and Privacy Mode on
    // When it is formatted for display
    // Then the amount is replaced by the localized mask, keeping the currency symbol
    expect(formatDisplayAmount(10750, 'pt-BR', true)).toBe('R$ ••••');
  });

  it('returns the mask in en-US too', () => {
    // Given the same value under the secondary language
    // When values are hidden
    // Then the mask is language-aware but still carries the currency symbol
    expect(formatDisplayAmount(10750, 'en-US', true)).toBe('R$ ••••');
  });

  it('masks sign and magnitude alike', () => {
    // Given a negative and a zero amount
    // When values are hidden
    // Then neither the sign nor the value leaks
    expect(formatDisplayAmount(-2304, 'pt-BR', true)).toBe('R$ ••••');
    expect(formatDisplayAmount(0, 'pt-BR', true)).toBe('R$ ••••');
  });
});

describe('parseAmount', () => {
  // Given amounts typed in either pt-BR or en-US notation
  // When they are parsed into numbers
  // Then both decimal separators are accepted
  it.each([
    ['110', 110],
    ['110.50', 110.5],
    ['110,50', 110.5],
    ['0', 0],
    ['  300  ', 300],
  ])('Given the typed amount %s the parsed value is %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  // Given blank or malformed input
  // When it is parsed
  // Then it is refused rather than silently recorded
  it.each([[''], ['   '], ['abc'], ['12,3,4'], ['1.2.3']])(
    'Given the unparseable amount %s the parsed value is null',
    (input) => {
      expect(parseAmount(input)).toBeNull();
    }
  );
});
