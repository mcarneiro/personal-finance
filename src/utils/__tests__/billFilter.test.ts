import { describe, expect, it } from 'vitest';
import type { Bank, Bill, Payer } from '../../types';
import {
  EMPTY_BILL_FILTER,
  billFilterCount,
  billFilterOptions,
  filterBills,
  isBillFilterEmpty,
} from '../billFilter';

const MARCELO: Payer = { id: 'payer-marcelo', name: 'Marcelo' };
const GUTA: Payer = { id: 'payer-guta', name: 'Guta' };
const PAYERS = [MARCELO, GUTA];

const ITAU: Bank = { id: 'bank-itau', name: 'Itaú' };
const NUBANK: Bank = { id: 'bank-nubank', name: 'Nubank' };
const BANKS = [ITAU, NUBANK];

function bill(name: string, amount: number, payerId: string, bankId: string): Bill {
  return {
    id: name,
    month: '2026-06',
    name,
    amount,
    isPaid: false,
    isFinal: true,
    payerId,
    bankId,
  };
}

describe('filterBills', () => {
  it('returns every bill untouched for an empty filter', () => {
    // Given a month's bills and no selections
    const bills = [
      bill('Luz', 150, MARCELO.id, NUBANK.id),
      bill('Cartão guta', 2899, GUTA.id, ITAU.id),
    ];

    // When nothing is selected
    const result = filterBills(bills, EMPTY_BILL_FILTER);

    // Then the list is unchanged
    expect(result).toBe(bills);
  });

  it('matches any selected payer (OR within the payer facet)', () => {
    // Given bills split across two payers
    const bills = [
      bill('Luz', 150, MARCELO.id, NUBANK.id),
      bill('Gym', 200, GUTA.id, NUBANK.id),
      bill('Cartão guta', 2899, GUTA.id, ITAU.id),
    ];

    // When I pick only Guta
    const result = filterBills(bills, { payerIds: [GUTA.id], bankIds: [] });

    // Then only Guta's bills remain
    expect(result.map((entry) => entry.name)).toEqual(['Gym', 'Cartão guta']);
  });

  it('matches any selected bank (OR within the bank facet)', () => {
    // Given bills from two banks
    const bills = [
      bill('Luz', 150, MARCELO.id, NUBANK.id),
      bill('Água', 90, MARCELO.id, ITAU.id),
      bill('Cartão guta', 2899, GUTA.id, ITAU.id),
    ];

    // When I pick Itaú
    const result = filterBills(bills, { payerIds: [], bankIds: [ITAU.id] });

    // Then only Itaú bills remain
    expect(result.map((entry) => entry.name)).toEqual(['Água', 'Cartão guta']);
  });

  it('combines facets with AND: a payer and a bank both have to match', () => {
    // Given bills spread across payers and banks
    const bills = [
      bill('Luz', 150, MARCELO.id, NUBANK.id),
      bill('Água', 90, MARCELO.id, ITAU.id),
      bill('Cartão guta', 2899, GUTA.id, ITAU.id),
      bill('Gym', 200, GUTA.id, NUBANK.id),
    ];

    // When I pick both payers but only Itaú
    const result = filterBills(bills, {
      payerIds: [MARCELO.id, GUTA.id],
      bankIds: [ITAU.id],
    });

    // Then only the Itaú bills of the selected payers remain
    expect(result.map((entry) => entry.name)).toEqual(['Água', 'Cartão guta']);
  });

  it('preserves the incoming order and never mutates the input', () => {
    // Given two matching bills in a set order
    const bills = [
      bill('Zebra', 10, GUTA.id, ITAU.id),
      bill('Alfa', 20, GUTA.id, ITAU.id),
    ];
    const snapshot = [...bills];

    // When I filter
    const result = filterBills(bills, { payerIds: [GUTA.id], bankIds: [] });

    // Then the order is the caller's to decide and the input is untouched
    expect(result.map((entry) => entry.name)).toEqual(['Zebra', 'Alfa']);
    expect(bills).toEqual(snapshot);
  });
});

describe('billFilterOptions', () => {
  it('offers only the payers and banks that appear on the month bills', () => {
    // Given June only uses Marcelo and Nubank
    const bills = [bill('Luz', 150, MARCELO.id, NUBANK.id)];

    // When I ask for the filter options
    const options = billFilterOptions(bills, BANKS, PAYERS);

    // Then Guta and Itaú are absent — every checkbox can change the list
    expect(options).toEqual({ payerIds: [MARCELO.id], bankIds: [NUBANK.id] });
  });

  it('reads options in registry order and puts unset or removed references last', () => {
    // Given a month touching an unregistered bank, an unset bill, and both
    // registered entries out of registry order
    const bills = [
      bill('Sem nada', 25, '', ''),
      bill('Sem cadastro', 40, GUTA.id, 'bank-removido'),
      bill('Cartão guta', 2899, GUTA.id, ITAU.id),
      bill('Luz', 150, MARCELO.id, NUBANK.id),
    ];

    // When I ask for the options
    const options = billFilterOptions(bills, BANKS, PAYERS);

    // Then registered ids lead in registry order, then the unknowns
    expect(options.payerIds).toEqual([MARCELO.id, GUTA.id, '']);
    expect(options.bankIds).toEqual([ITAU.id, NUBANK.id, '', 'bank-removido']);
  });

  it('lists each id once no matter how many bills use it', () => {
    // Given two bills on the same payer and bank
    const bills = [
      bill('Luz', 150, MARCELO.id, NUBANK.id),
      bill('Água', 90, MARCELO.id, NUBANK.id),
    ];

    // When I ask for the options
    const options = billFilterOptions(bills, BANKS, PAYERS);

    // Then each id appears once
    expect(options.payerIds).toEqual([MARCELO.id]);
    expect(options.bankIds).toEqual([NUBANK.id]);
  });

  it('is empty for a month with no bills', () => {
    // Given no bills
    // When I ask for the options
    // Then there is nothing to choose
    expect(billFilterOptions([], BANKS, PAYERS)).toEqual({ payerIds: [], bankIds: [] });
  });
});

describe('billFilterCount and isBillFilterEmpty', () => {
  it('counts selections across both facets', () => {
    // Given two payers and one bank chosen
    const filter = { payerIds: [MARCELO.id, GUTA.id], bankIds: [ITAU.id] };

    // When I count them
    // Then every checkbox counts once
    expect(billFilterCount(filter)).toBe(3);
    expect(isBillFilterEmpty(filter)).toBe(false);
  });

  it('reads an empty selection as no filter', () => {
    // Given no selections
    // When I inspect the filter
    // Then it is empty and counts zero
    expect(isBillFilterEmpty(EMPTY_BILL_FILTER)).toBe(true);
    expect(billFilterCount(EMPTY_BILL_FILTER)).toBe(0);
  });
});
