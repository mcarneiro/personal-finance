import { describe, expect, it } from 'vitest';
import type { Bill } from '../../types';
import reducer, { clearPendingChanges, dropPendingChanges, recordPendingChange } from '../pendingSlice';

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

describe('pendingSlice', () => {
  it('records a create, update or delete keyed by record id and tab', () => {
    // Given an empty Pending Changes store
    let state = reducer(undefined, { type: '@@init' });

    // When edits across two tabs are recorded
    state = reducer(
      state,
      recordPendingChange({
        tab: 'bills',
        change: { type: 'create', id: 'luz', record: bill('luz') },
      })
    );
    state = reducer(
      state,
      recordPendingChange({
        tab: 'bills',
        change: { type: 'update', id: 'agua', record: bill('agua', { amount: 90 }) },
      })
    );
    state = reducer(
      state,
      recordPendingChange({ tab: 'cards', change: { type: 'delete', id: 'c9' } })
    );

    // Then each tab holds its own changes keyed by id
    expect(state.changes.bills?.luz).toEqual({ type: 'create', id: 'luz', record: bill('luz') });
    expect(state.changes.bills?.agua).toEqual({
      type: 'update',
      id: 'agua',
      record: bill('agua', { amount: 90 }),
    });
    expect(state.changes.cards?.c9).toEqual({ type: 'delete', id: 'c9' });
  });

  it('keeps only the latest edit for a record', () => {
    // Given an edit already recorded for a bill
    let state = reducer(
      undefined,
      recordPendingChange({ tab: 'bills', change: { type: 'update', id: 'luz', record: bill('luz') } })
    );

    // When the same bill is edited again
    state = reducer(
      state,
      recordPendingChange({
        tab: 'bills',
        change: { type: 'update', id: 'luz', record: bill('luz', { amount: 250 }) },
      })
    );

    // Then only the latest value is pending
    expect(state.changes.bills?.luz).toEqual({
      type: 'update',
      id: 'luz',
      record: bill('luz', { amount: 250 }),
    });
  });

  it('drops a written Pending Change but keeps a newer edit to the same record', () => {
    // Given two pending bills, one of which was written, and a newer edit to it
    let state = reducer(
      undefined,
      recordPendingChange({ tab: 'bills', change: { type: 'update', id: 'luz', record: bill('luz') } })
    );
    state = reducer(
      state,
      recordPendingChange({
        tab: 'bills',
        change: { type: 'update', id: 'agua', record: bill('agua') },
      })
    );
    const writtenAgua = { type: 'update' as const, id: 'agua', record: bill('agua') };
    // The local edit to `luz` lands while the `agua` write is in flight.
    state = reducer(
      state,
      recordPendingChange({
        tab: 'bills',
        change: { type: 'update', id: 'luz', record: bill('luz', { amount: 300 }) },
      })
    );

    // When the successful write drops the snapshot it carried
    state = reducer(
      state,
      dropPendingChanges({
        tab: 'bills',
        changes: {
          luz: { type: 'update', id: 'luz', record: bill('luz') },
          agua: writtenAgua,
        },
      })
    );

    // Then the written `agua` is gone and the newer `luz` edit is retained
    expect(state.changes.bills?.agua).toBeUndefined();
    expect(state.changes.bills?.luz).toEqual({
      type: 'update',
      id: 'luz',
      record: bill('luz', { amount: 300 }),
    });
  });

  it('clears every Pending Change when the connected sheet changes', () => {
    // Given edits recorded across two tabs
    let state = reducer(
      undefined,
      recordPendingChange({ tab: 'bills', change: { type: 'update', id: 'luz', record: bill('luz') } })
    );
    state = reducer(
      state,
      recordPendingChange({ tab: 'cards', change: { type: 'delete', id: 'c9' } })
    );

    // When the connected sheet changes
    state = reducer(state, clearPendingChanges());

    // Then nothing from the previous sheet is left to replay or push
    expect(state.changes).toEqual({});
  });
});
