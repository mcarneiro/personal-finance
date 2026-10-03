import { describe, expect, it } from 'vitest';
import type { Outflow, Month } from '../../types';
import { orderOutflows } from '../outflowOrder';

const MONTH: Month = '2026-06';

function outflow(name: string, isPaid = false, isFinal = true): Outflow {
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

describe('orderOutflows', () => {
  it('puts open outflows before paid outflows, each in alphabetical order', () => {
    // Given a mixed list where paid and open outflows interleave out of order
    const outflows = [
      outflow('Luz', true),
      outflow('Água'),
      outflow('Internet', true),
      outflow('Gym'),
    ];

    // When the list is ordered
    const ordered = orderOutflows(outflows, 'pt-BR');

    // Then every open outflow comes first, alphabetically, then every paid outflow
    expect(ordered.map((entry) => entry.name)).toEqual([
      'Água',
      'Gym',
      'Internet',
      'Luz',
    ]);
  });

  it('sinks paid outflows to the end, whatever their final status', () => {
    // Given an open and a paid outflow in each final state
    const outflows = [
      outflow('Água'), // final, open
      outflow('Gym', true, false), // not final, paid
      outflow('Internet', true), // final, paid
      outflow('Luz', false, false), // not final, open
    ];

    // When the list is ordered
    const ordered = orderOutflows(outflows, 'pt-BR');

    // Then every open outflow leads (final before non-final, alphabetical), then
    // every paid outflow (alphabetical)
    expect(ordered.map((entry) => entry.name)).toEqual([
      'Água',
      'Luz',
      'Gym',
      'Internet',
    ]);
  });

  it('ignores final status once paid, sorting the paid rows alphabetically', () => {
    // Given two paid outflows whose final status disagrees with their names
    const outflows = [outflow('Zebra', true), outflow('Abacaxi', true, false)];

    // When the list is ordered
    const ordered = orderOutflows(outflows, 'pt-BR');

    // Then the paid rows read purely alphabetically
    expect(ordered.map((entry) => entry.name)).toEqual(['Abacaxi', 'Zebra']);
  });

  it('keeps open before paid within the not-final group', () => {
    // Given two non-final outflows, one already paid
    const outflows = [outflow('Zebra', true, false), outflow('Abacaxi', false, false)];

    // When the list is ordered
    const ordered = orderOutflows(outflows, 'pt-BR');

    // Then the open one leads and the group stays alphabetical
    expect(ordered.map((entry) => entry.name)).toEqual(['Abacaxi', 'Zebra']);
  });

  it('leaves the input array untouched', () => {
    // Given a list out of order
    const outflows = [outflow('Zebra'), outflow('Abacaxi')];

    // When the list is ordered
    orderOutflows(outflows, 'pt-BR');

    // Then the original array still reads in its original order
    expect(outflows.map((entry) => entry.name)).toEqual(['Zebra', 'Abacaxi']);
  });

  it('sorts names case-insensitively and accent-aware in the given locale', () => {
    // Given names whose alphabetical order is not their ASCII order
    const outflows = [outflow('água'), outflow('Ávila'), outflow('banana')];

    // When the list is ordered
    const ordered = orderOutflows(outflows, 'pt-BR');

    // Then accented and lower-case names sort as the locale expects
    expect(ordered.map((entry) => entry.name)).toEqual(['água', 'Ávila', 'banana']);
  });

  it('is empty for an empty list', () => {
    // Given no outflows
    // When the list is ordered
    // Then it stays empty
    expect(orderOutflows([], 'pt-BR')).toEqual([]);
  });
});
