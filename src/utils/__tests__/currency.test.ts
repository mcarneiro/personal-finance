import { describe, expect, it } from 'vitest';
import { formatCurrency, parseAmount } from '../currency';

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
    expect(formatCurrency(-2304, 'pt-BR')).toMatch(/-R\$\s?2\.304,00/);
  });
});

describe('parseAmount', () => {
  it.each([
    ['110', 110],
    ['110.50', 110.5],
    ['110,50', 110.5],
    ['0', 0],
    ['  300  ', 300],
  ])('Given the typed amount %s the parsed value is %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each([[''], ['   '], ['abc'], ['12,3,4'], ['1.2.3']])(
    'Given the unparseable amount %s the parsed value is null',
    (input) => {
      expect(parseAmount(input)).toBeNull();
    }
  );
});
