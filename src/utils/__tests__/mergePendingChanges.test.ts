import { describe, expect, it } from 'vitest';
import type { Bill, PendingChanges, TabPendingChanges } from '../../types';
import { mergePendingChanges } from '../mergePendingChanges';

function bill(id: string, overrides: Partial<Bill> = {}): Bill {
  return {
    id,
    month: '2026-06',
    name: `Bill ${id}`,
    amount: 100,
    isPaid: false,
    isFinal: true,
    payerId: 'payer-marcelo',
    bankId: 'bank-nubank',
    ...overrides,
  };
}

describe('mergePendingChanges', () => {
  it('lets a local update win over a fresh row with the same id', () => {
    // Given a fresh row and a Pending Change editing the same record
    const fresh = [bill('luz', { amount: 150 }), bill('agua', { amount: 90 })];
    const changes: TabPendingChanges<Bill> = {
      luz: { type: 'update', id: 'luz', record: bill('luz', { amount: 120 }) },
    };

    // When the Pending Changes are replayed over the fresh rows
    const result = mergePendingChanges(fresh, changes);

    // Then the local value wins and the untouched row passes through
    expect(result).toEqual([
      bill('luz', { amount: 120 }),
      bill('agua', { amount: 90 }),
    ]);
  });

  it('adds a row for a create, and upserts an edit whose id is absent', () => {
    // Given fresh rows and Pending Changes for ids the sheet does not have
    const fresh = [bill('luz')];
    const changes: TabPendingChanges<Bill> = {
      netflix: { type: 'create', id: 'netflix', record: bill('netflix') },
      gym: { type: 'update', id: 'gym', record: bill('gym', { amount: 50 }) },
    };

    // When the Pending Changes are replayed
    const result = mergePendingChanges(fresh, changes);

    // Then the new and orphaned records are appended after the fresh rows
    expect(result.map((row) => row.id)).toEqual(['luz', 'netflix', 'gym']);
    expect(result[2]).toEqual(bill('gym', { amount: 50 }));
  });

  it('removes the row a delete targets and ignores a delete of an absent id', () => {
    // Given three fresh rows and a delete for the middle one, plus a bogus delete
    const fresh = [bill('luz'), bill('agua'), bill('netflix')];
    const changes: TabPendingChanges<Bill> = {
      agua: { type: 'delete', id: 'agua' },
      ghost: { type: 'delete', id: 'ghost' },
    };

    // When the Pending Changes are replayed
    const result = mergePendingChanges(fresh, changes);

    // Then the deleted row is gone and nothing else changed
    expect(result.map((row) => row.id)).toEqual(['luz', 'netflix']);
  });

  it('passes untouched fresh rows through in their original order', () => {
    // Given fresh rows in a deliberate order and a change for an unrelated id
    const fresh = [bill('zebra'), bill('alfa'), bill('meio')];
    const changes: TabPendingChanges<Bill> = {
      novo: { type: 'create', id: 'novo', record: bill('novo') },
    };

    // When the Pending Changes are replayed
    const result = mergePendingChanges(fresh, changes);

    // Then the fresh order is preserved and the create lands at the tail
    expect(result.map((row) => row.id)).toEqual(['zebra', 'alfa', 'meio', 'novo']);
  });

  it('skips blank rows, whether or not a change targets them', () => {
    // Given fresh rows including blank ids and a change keyed by a blank id
    const fresh = [bill('luz'), bill(''), bill('   '), bill('agua')];
    const changes: TabPendingChanges<Bill> = {
      '': { type: 'create', id: '', record: bill('') },
    };

    // When the Pending Changes are replayed
    const result = mergePendingChanges(fresh, changes);

    // Then no blank row survives
    expect(result.map((row) => row.id)).toEqual(['luz', 'agua']);
  });

  it('returns the fresh rows unchanged when there are no Pending Changes', () => {
    // Given fresh rows and no Pending Changes
    const fresh = [bill('luz'), bill('agua')];

    // When the Pending Changes are replayed
    const result = mergePendingChanges(fresh, {});

    // Then the rows are returned as they came
    expect(result).toEqual(fresh);
    expect(result).toEqual(mergePendingChanges(fresh, undefined));
  });

  it('never mutates its inputs', () => {
    // Given fresh rows and a change
    const fresh = [bill('luz', { amount: 150 })];
    const freshSnapshot = fresh.map((row) => ({ ...row }));
    const changes: TabPendingChanges<Bill> = {
      luz: { type: 'update', id: 'luz', record: bill('luz', { amount: 120 }) },
    };

    // When the Pending Changes are replayed
    mergePendingChanges(fresh, changes);

    // Then the caller's arrays and records are untouched
    expect(fresh).toEqual(freshSnapshot);
    expect(fresh[0]).toEqual(bill('luz', { amount: 150 }));
  });

  it('groups Pending Changes by tab and keys each by record id', () => {
    // Given one device's Pending Changes across two tabs
    const all: PendingChanges = {
      bills: { luz: { type: 'update', id: 'luz', record: bill('luz') } },
      cards: { 'card-1': { type: 'create', id: 'card-1', record: { id: 'card-1', name: 'cc guta' } } },
    };

    // When the tab groups are read by key
    // Then each tab holds its own changes, keyed by record id
    expect(Object.keys(all)).toEqual(['bills', 'cards']);
    expect(all.bills?.luz.type).toBe('update');
    expect(all.cards?.['card-1']).toEqual({
      type: 'create',
      id: 'card-1',
      record: { id: 'card-1', name: 'cc guta' },
    });
  });
});
