import { describe, expect, it } from 'vitest';
import type { Outflow, PendingChanges, SheetData, TabPendingChanges } from '../../types';
import { mergePendingChanges, mergeSheetData } from '../mergePendingChanges';

function outflow(id: string, overrides: Partial<Outflow> = {}): Outflow {
  return {
    id,
    month: '2026-06',
    name: `Outflow ${id}`,
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
    const fresh = [outflow('luz', { amount: 150 }), outflow('agua', { amount: 90 })];
    const changes: TabPendingChanges<Outflow> = {
      luz: { type: 'update', id: 'luz', record: outflow('luz', { amount: 120 }) },
    };

    // When the Pending Changes are replayed over the fresh rows
    const result = mergePendingChanges(fresh, changes);

    // Then the local value wins and the untouched row passes through
    expect(result).toEqual([
      outflow('luz', { amount: 120 }),
      outflow('agua', { amount: 90 }),
    ]);
  });

  it('adds a row for a create, and upserts an edit whose id is absent', () => {
    // Given fresh rows and Pending Changes for ids the sheet does not have
    const fresh = [outflow('luz')];
    const changes: TabPendingChanges<Outflow> = {
      netflix: { type: 'create', id: 'netflix', record: outflow('netflix') },
      gym: { type: 'update', id: 'gym', record: outflow('gym', { amount: 50 }) },
    };

    // When the Pending Changes are replayed
    const result = mergePendingChanges(fresh, changes);

    // Then the new and orphaned records are appended after the fresh rows
    expect(result.map((row) => row.id)).toEqual(['luz', 'netflix', 'gym']);
    expect(result[2]).toEqual(outflow('gym', { amount: 50 }));
  });

  it('removes the row a delete targets and ignores a delete of an absent id', () => {
    // Given three fresh rows and a delete for the middle one, plus a bogus delete
    const fresh = [outflow('luz'), outflow('agua'), outflow('netflix')];
    const changes: TabPendingChanges<Outflow> = {
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
    const fresh = [outflow('zebra'), outflow('alfa'), outflow('meio')];
    const changes: TabPendingChanges<Outflow> = {
      novo: { type: 'create', id: 'novo', record: outflow('novo') },
    };

    // When the Pending Changes are replayed
    const result = mergePendingChanges(fresh, changes);

    // Then the fresh order is preserved and the create lands at the tail
    expect(result.map((row) => row.id)).toEqual(['zebra', 'alfa', 'meio', 'novo']);
  });

  it('skips blank rows, whether or not a change targets them', () => {
    // Given fresh rows including blank ids and a change keyed by a blank id
    const fresh = [outflow('luz'), outflow(''), outflow('   '), outflow('agua')];
    const changes: TabPendingChanges<Outflow> = {
      '': { type: 'create', id: '', record: outflow('') },
    };

    // When the Pending Changes are replayed
    const result = mergePendingChanges(fresh, changes);

    // Then no blank row survives
    expect(result.map((row) => row.id)).toEqual(['luz', 'agua']);
  });

  it('returns the fresh rows unchanged when there are no Pending Changes', () => {
    // Given fresh rows and no Pending Changes
    const fresh = [outflow('luz'), outflow('agua')];

    // When the Pending Changes are replayed
    const result = mergePendingChanges(fresh, {});

    // Then the rows are returned as they came
    expect(result).toEqual(fresh);
    expect(result).toEqual(mergePendingChanges(fresh, undefined));
  });

  it('never mutates its inputs', () => {
    // Given fresh rows and a change
    const fresh = [outflow('luz', { amount: 150 })];
    const freshSnapshot = fresh.map((row) => ({ ...row }));
    const changes: TabPendingChanges<Outflow> = {
      luz: { type: 'update', id: 'luz', record: outflow('luz', { amount: 120 }) },
    };

    // When the Pending Changes are replayed
    mergePendingChanges(fresh, changes);

    // Then the caller's arrays and records are untouched
    expect(fresh).toEqual(freshSnapshot);
    expect(fresh[0]).toEqual(outflow('luz', { amount: 150 }));
  });

  it('groups Pending Changes by tab and keys each by record id', () => {
    // Given one device's Pending Changes across two tabs
    const all: PendingChanges = {
      outflows: { luz: { type: 'update', id: 'luz', record: outflow('luz') } },
      cards: { 'card-1': { type: 'create', id: 'card-1', record: { id: 'card-1', name: 'cc guta' } } },
    };

    // When the tab groups are read by key
    // Then each tab holds its own changes, keyed by record id
    expect(Object.keys(all)).toEqual(['outflows', 'cards']);
    expect(all.outflows?.luz.type).toBe('update');
    expect(all.cards?.['card-1']).toEqual({
      type: 'create',
      id: 'card-1',
      record: { id: 'card-1', name: 'cc guta' },
    });
  });
});

describe('mergeSheetData', () => {
  function emptySheet(): SheetData {
    return { cards: [], banks: [], payers: [], planItems: [], cardSpending: [], outflows: [], income: [], savingsPots: [], savingsBalances: [] };
  }

  it('replays each tab group over its own fresh rows, leaving the rest untouched', () => {
    // Given a pull that brought a remote outflow edit and a local pending edit to
    // a different tab (a card rename)
    const fresh: SheetData = {
      ...emptySheet(),
      outflows: [outflow('luz', { amount: 999 })],
      cards: [{ id: 'c1', name: 'old' }],
    };
    const pending: PendingChanges = {
      outflows: { luz: { type: 'update', id: 'luz', record: outflow('luz', { amount: 120 }) } },
      cards: { c1: { type: 'update', id: 'c1', record: { id: 'c1', name: 'new' } } },
    };

    // When every tab's Pending Changes are replayed over the snapshot
    const merged = mergeSheetData(fresh, pending);

    // Then the local values win and the unrelated tabs are unchanged
    expect(merged.outflows).toEqual([outflow('luz', { amount: 120 })]);
    expect(merged.cards).toEqual([{ id: 'c1', name: 'new' }]);
    expect(merged.income).toEqual([]);
  });

  it('returns the snapshot unchanged when there are no Pending Changes', () => {
    // Given a snapshot and no Pending Changes
    const fresh: SheetData = { ...emptySheet(), outflows: [outflow('luz')] };

    // When it is merged
    const merged = mergeSheetData(fresh, {});

    // Then it is equivalent to the input
    expect(merged).toEqual(fresh);
  });
});
