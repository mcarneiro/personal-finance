import { describe, expect, it } from 'vitest';
import type { Bill, Month } from '../../types';
import { orderBills } from '../billOrder';

const MONTH: Month = '2026-06';

function bill(name: string, isPaid = false, isFinal = true): Bill {
  return {
    id: `${MONTH}-${name}`,
    month: MONTH,
    name,
    amount: 100,
    isPaid,
    isFinal,
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

  it('sinks bills without a final value to the end, whatever their paid status', () => {
    // Given a final and a non-final bill in each paid state
    const bills = [
      bill('Água'), // final, open
      bill('Gym', true, false), // not final, paid
      bill('Internet', true), // final, paid
      bill('Luz', false, false), // not final, open
    ];

    // When the list is ordered
    const ordered = orderBills(bills, 'pt-BR');

    // Then every final bill leads (open before paid, alphabetical), then every
    // bill still awaiting a final value (open before paid, alphabetical)
    expect(ordered.map((entry) => entry.name)).toEqual([
      'Água',
      'Internet',
      'Luz',
      'Gym',
    ]);
  });

  it('keeps open before paid within the not-final group', () => {
    // Given two non-final bills, one already paid
    const bills = [bill('Zebra', true, false), bill('Abacaxi', false, false)];

    // When the list is ordered
    const ordered = orderBills(bills, 'pt-BR');

    // Then the open one leads and the group stays alphabetical
    expect(ordered.map((entry) => entry.name)).toEqual(['Abacaxi', 'Zebra']);
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
