import { describe, expect, it } from 'vitest';
import type { Bill, Month } from '../../types';
import { orderBills } from '../billOrder';

const MONTH: Month = '2026-06';

function bill(name: string, isPaid = false): Bill {
  return {
    id: `${MONTH}-${name}`,
    month: MONTH,
    name,
    amount: 100,
    isPaid,
    payerId: 'payer-marcelo',
    bankId: 'bank-nubank',
  };
}

describe('orderBills', () => {
  it('puts open bills before paid bills, each in alphabetical order', () => {
    // Given a mixed list where paid and open bills interleave out of order
    const bills = [
      bill('Luz', true),
      bill('Água'),
      bill('Internet', true),
      bill('Gym'),
    ];

    // When the list is ordered
    const ordered = orderBills(bills, 'pt-BR');

    // Then every open bill comes first, alphabetically, then every paid bill
    expect(ordered.map((entry) => entry.name)).toEqual([
      'Água',
      'Gym',
      'Internet',
      'Luz',
    ]);
  });

  it('leaves the input array untouched', () => {
    // Given a list out of order
    const bills = [bill('Zebra'), bill('Abacaxi')];

    // When the list is ordered
    orderBills(bills, 'pt-BR');

    // Then the original array still reads in its original order
    expect(bills.map((entry) => entry.name)).toEqual(['Zebra', 'Abacaxi']);
  });

  it('sorts names case-insensitively and accent-aware in the given locale', () => {
    // Given names whose alphabetical order is not their ASCII order
    const bills = [bill('água'), bill('Ávila'), bill('banana')];

    // When the list is ordered
    const ordered = orderBills(bills, 'pt-BR');

    // Then accented and lower-case names sort as the locale expects
    expect(ordered.map((entry) => entry.name)).toEqual(['água', 'Ávila', 'banana']);
  });

  it('is empty for an empty list', () => {
    // Given no bills
    // When the list is ordered
    // Then it stays empty
    expect(orderBills([], 'pt-BR')).toEqual([]);
  });
});
