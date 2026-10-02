import { describe, expect, it } from 'vitest';
import type { Bank, Outflow, Payer } from '../../types';
import {
  EMPTY_OUTFLOW_FILTER,
  outflowFilterCount,
  outflowFilterOptions,
  filterOutflows,
  isOutflowFilterEmpty,
  parseOutflowFilter,
} from '../outflowFilter';

const MARCELO: Payer = { id: 'payer-marcelo', name: 'Marcelo' };
const GUTA: Payer = { id: 'payer-guta', name: 'Guta' };
const PAYERS = [MARCELO, GUTA];

const ITAU: Bank = { id: 'bank-itau', name: 'Itaú' };
const NUBANK: Bank = { id: 'bank-nubank', name: 'Nubank' };
const BANKS = [ITAU, NUBANK];

function outflow(name: string, amount: number, payerId: string, bankId: string): Outflow {
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

describe('filterOutflows', () => {
  it('returns every outflow untouched for an empty filter', () => {
    // Given a month's outflows and no selections
    const outflows = [
      outflow('Luz', 150, MARCELO.id, NUBANK.id),
      outflow('Cartão guta', 2899, GUTA.id, ITAU.id),
    ];

    // When nothing is selected
    const result = filterOutflows(outflows, EMPTY_OUTFLOW_FILTER);

    // Then the list is unchanged
    expect(result).toBe(outflows);
  });

  it('matches any selected payer (OR within the payer facet)', () => {
    // Given outflows split across two payers
    const outflows = [
      outflow('Luz', 150, MARCELO.id, NUBANK.id),
      outflow('Gym', 200, GUTA.id, NUBANK.id),
      outflow('Cartão guta', 2899, GUTA.id, ITAU.id),
    ];

    // When I pick only Guta
    const result = filterOutflows(outflows, { payerIds: [GUTA.id], bankIds: [] });

    // Then only Guta's outflows remain
    expect(result.map((entry) => entry.name)).toEqual(['Gym', 'Cartão guta']);
  });

  it('matches any selected bank (OR within the bank facet)', () => {
    // Given outflows from two banks
    const outflows = [
      outflow('Luz', 150, MARCELO.id, NUBANK.id),
      outflow('Água', 90, MARCELO.id, ITAU.id),
      outflow('Cartão guta', 2899, GUTA.id, ITAU.id),
    ];

    // When I pick Itaú
    const result = filterOutflows(outflows, { payerIds: [], bankIds: [ITAU.id] });

    // Then only Itaú outflows remain
    expect(result.map((entry) => entry.name)).toEqual(['Água', 'Cartão guta']);
  });

  it('combines facets with AND: a payer and a bank both have to match', () => {
    // Given outflows spread across payers and banks
    const outflows = [
      outflow('Luz', 150, MARCELO.id, NUBANK.id),
      outflow('Água', 90, MARCELO.id, ITAU.id),
      outflow('Cartão guta', 2899, GUTA.id, ITAU.id),
      outflow('Gym', 200, GUTA.id, NUBANK.id),
    ];

    // When I pick both payers but only Itaú
    const result = filterOutflows(outflows, {
      payerIds: [MARCELO.id, GUTA.id],
      bankIds: [ITAU.id],
    });

    // Then only the Itaú outflows of the selected payers remain
    expect(result.map((entry) => entry.name)).toEqual(['Água', 'Cartão guta']);
  });

  it('preserves the incoming order and never mutates the input', () => {
    // Given two matching outflows in a set order
    const outflows = [
      outflow('Zebra', 10, GUTA.id, ITAU.id),
      outflow('Alfa', 20, GUTA.id, ITAU.id),
    ];
    const snapshot = [...outflows];

    // When I filter
    const result = filterOutflows(outflows, { payerIds: [GUTA.id], bankIds: [] });

    // Then the order is the caller's to decide and the input is untouched
    expect(result.map((entry) => entry.name)).toEqual(['Zebra', 'Alfa']);
    expect(outflows).toEqual(snapshot);
  });
});

describe('outflowFilterOptions', () => {
  it('offers only the payers and banks that appear on the month outflows', () => {
    // Given June only uses Marcelo and Nubank
    const outflows = [outflow('Luz', 150, MARCELO.id, NUBANK.id)];

    // When I ask for the filter options
    const options = outflowFilterOptions(outflows, BANKS, PAYERS);

    // Then Guta and Itaú are absent — every checkbox can change the list
    expect(options).toEqual({ payerIds: [MARCELO.id], bankIds: [NUBANK.id] });
  });

  it('reads options in registry order and puts unset or removed references last', () => {
    // Given a month touching an unregistered bank, an unset outflow, and both
    // registered entries out of registry order
    const outflows = [
      outflow('Sem nada', 25, '', ''),
      outflow('Sem cadastro', 40, GUTA.id, 'bank-removido'),
      outflow('Cartão guta', 2899, GUTA.id, ITAU.id),
      outflow('Luz', 150, MARCELO.id, NUBANK.id),
    ];

    // When I ask for the options
    const options = outflowFilterOptions(outflows, BANKS, PAYERS);

    // Then registered ids lead in registry order, then the unknowns
    expect(options.payerIds).toEqual([MARCELO.id, GUTA.id, '']);
    expect(options.bankIds).toEqual([ITAU.id, NUBANK.id, '', 'bank-removido']);
  });

  it('lists each id once no matter how many outflows use it', () => {
    // Given two outflows on the same payer and bank
    const outflows = [
      outflow('Luz', 150, MARCELO.id, NUBANK.id),
      outflow('Água', 90, MARCELO.id, NUBANK.id),
    ];

    // When I ask for the options
    const options = outflowFilterOptions(outflows, BANKS, PAYERS);

    // Then each id appears once
    expect(options.payerIds).toEqual([MARCELO.id]);
    expect(options.bankIds).toEqual([NUBANK.id]);
  });

  it('is empty for a month with no outflows', () => {
    // Given no outflows
    // When I ask for the options
    // Then there is nothing to choose
    expect(outflowFilterOptions([], BANKS, PAYERS)).toEqual({ payerIds: [], bankIds: [] });
  });
});

describe('outflowFilterCount and isOutflowFilterEmpty', () => {
  it('counts selections across both facets', () => {
    // Given two payers and one bank chosen
    const filter = { payerIds: [MARCELO.id, GUTA.id], bankIds: [ITAU.id] };

    // When I count them
    // Then every checkbox counts once
    expect(outflowFilterCount(filter)).toBe(3);
    expect(isOutflowFilterEmpty(filter)).toBe(false);
  });

  it('reads an empty selection as no filter', () => {
    // Given no selections
    // When I inspect the filter
    // Then it is empty and counts zero
    expect(isOutflowFilterEmpty(EMPTY_OUTFLOW_FILTER)).toBe(true);
    expect(outflowFilterCount(EMPTY_OUTFLOW_FILTER)).toBe(0);
  });
});

describe('parseOutflowFilter', () => {
  it('accepts a well-formed stored filter and copies its id arrays', () => {
    // Given a stored filter with both facets set
    const stored = { payerIds: [GUTA.id], bankIds: [ITAU.id, NUBANK.id] };

    // When I parse it
    const parsed = parseOutflowFilter(stored);

    // Then the filter comes back with the same selections
    expect(parsed).toEqual({ payerIds: [GUTA.id], bankIds: [ITAU.id, NUBANK.id] });
    expect(parsed).not.toBe(stored);
  });

  it('accepts an empty filter', () => {
    // Given an empty stored filter
    // When I parse it
    // Then it is a valid, empty selection
    expect(parseOutflowFilter({ payerIds: [], bankIds: [] })).toEqual(EMPTY_OUTFLOW_FILTER);
  });

  it.each([
    ['null', null],
    ['a primitive', 'payer-guta'],
    ['a missing facet', { payerIds: [] }],
    ['a non-array facet', { payerIds: 'payer-guta', bankIds: [] }],
    ['a non-string id', { payerIds: [1], bankIds: [] }],
  ])('rejects %s so the caller falls back to no filter', (_label, raw) => {
    // Given a malformed stored value
    // When I parse it
    // Then it is rejected rather than coerced
    expect(parseOutflowFilter(raw)).toBeNull();
  });
});
