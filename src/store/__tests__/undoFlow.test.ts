import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Outflow } from '../../types';
import banksReducer from '../banksSlice';
import cardsReducer from '../cardsSlice';
import incomeReducer from '../incomeSlice';
import outflowsReducer, { addOutflow, addOutflows, deleteOutflow, updateOutflow } from '../outflowsSlice';
import payersReducer from '../payersSlice';
import pendingReducer from '../pendingSlice';
import planReducer from '../planSlice';
import savingsReducer from '../savingsSlice';
import settingsReducer from '../settingsSlice';
import { syncListenerMiddleware } from '../middleware/syncListener';
import { undoListenerMiddleware } from '../middleware/undoListener';
import undoReducer, { showUndo, undoRequested, UNDO_TTL_MS } from '../undoSlice';

vi.mock('../../services/GoogleSheetsService', () => ({
  googleSheetsService: {
    writePendingChanges: vi.fn().mockResolvedValue(undefined),
  },
}));

const OUTFLOW: Outflow = {
  id: 'outflow-1',
  month: '2026-06',
  name: 'Luz',
  amount: 180,
  isPaid: false,
  isFinal: true,
  isInvestment: false,
  payerId: 'payer-1',
  bankId: 'bank-1',
};

/** A connected store with the real debounced sync and undo middlewares. */
function makeStore(outflows: Outflow[] = []) {
  return configureStore({
    reducer: {
      cards: cardsReducer,
      banks: banksReducer,
      payers: payersReducer,
      plan: planReducer,
      outflows: outflowsReducer,
      income: incomeReducer,
      savings: savingsReducer,
      settings: settingsReducer,
      pending: pendingReducer,
      undo: undoReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(
        syncListenerMiddleware.middleware,
        undoListenerMiddleware.middleware
      ),
    preloadedState: {
      outflows: { items: outflows },
      settings: { sheetId: 'sheet-1' },
    },
  });
}

describe('undo flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('restores the previous value and writes it back as a normal edit', () => {
    // Given a saved outflow
    const store = makeStore([OUTFLOW]);

    // When it is edited and the change just landed
    store.dispatch(updateOutflow({ ...OUTFLOW, amount: 999 }));
    expect(store.getState().outflows.items[0].amount).toBe(999);
    expect(store.getState().undo.entry).not.toBeNull();

    // And undo is requested
    store.dispatch(undoRequested());

    // Then the old value is back in the store
    expect(store.getState().outflows.items[0].amount).toBe(180);
    // And the restore is queued for the sheet like any save
    expect(store.getState().pending.changes.outflows?.[OUTFLOW.id]).toEqual({
      type: 'update',
      id: OUTFLOW.id,
      record: OUTFLOW,
    });
    // And undo cannot be undone, so the toast is gone
    expect(store.getState().undo.entry).toBeNull();
  });

  it('removes a just-created record and queues its delete', () => {
    // Given a month without the outflow
    const store = makeStore();

    // When it is created and immediately undone
    store.dispatch(addOutflow(OUTFLOW));
    store.dispatch(undoRequested());

    // Then it is gone from the store
    expect(store.getState().outflows.items).toEqual([]);
    // And the sheet is told to delete it (a no-op if it never got a row)
    expect(store.getState().pending.changes.outflows?.[OUTFLOW.id]).toEqual({
      type: 'delete',
      id: OUTFLOW.id,
    });
  });

  it('re-creates a just-deleted record with the same id', () => {
    // Given a saved outflow
    const store = makeStore([OUTFLOW]);

    // When it is deleted and immediately undone
    store.dispatch(deleteOutflow(OUTFLOW.id));
    expect(store.getState().outflows.items).toEqual([]);
    store.dispatch(undoRequested());

    // Then the exact record returns
    expect(store.getState().outflows.items).toEqual([OUTFLOW]);
    // And the sheet write is a create of the same id
    expect(store.getState().pending.changes.outflows?.[OUTFLOW.id]).toEqual({
      type: 'create',
      id: OUTFLOW.id,
      record: OUTFLOW,
    });
  });

  it('undoes a whole replicate in one step', () => {
    // Given an empty month and a replicated set
    const store = makeStore();
    const copies = [
      { ...OUTFLOW, id: 'copy-1' },
      { ...OUTFLOW, id: 'copy-2' },
      { ...OUTFLOW, id: 'copy-3' },
    ];

    // When the copy lands and is undone
    store.dispatch(addOutflows(copies));
    store.dispatch(undoRequested());

    // Then every copied record is gone
    expect(store.getState().outflows.items).toEqual([]);
    // And each delete is queued
    expect(Object.keys(store.getState().pending.changes.outflows ?? {}).sort()).toEqual([
      'copy-1',
      'copy-2',
      'copy-3',
    ]);
  });

  it('does not apply an entry that already expired', () => {
    // Given an edit and a toast left up past its window
    const store = makeStore([OUTFLOW]);
    store.dispatch(updateOutflow({ ...OUTFLOW, amount: 999 }));
    const entry = store.getState().undo.entry;
    expect(entry).not.toBeNull();
    store.dispatch(showUndo({ ...entry!, createdAt: Date.now() - UNDO_TTL_MS - 1 }));

    // When undo is requested anyway
    store.dispatch(undoRequested());

    // Then the edit stands and the stale entry is dropped
    expect(store.getState().outflows.items[0].amount).toBe(999);
    expect(store.getState().undo.entry).toBeNull();
  });

  it('never records the undo itself as a new undoable change', () => {
    // Given an edit that is being undone
    const store = makeStore([OUTFLOW]);
    store.dispatch(updateOutflow({ ...OUTFLOW, amount: 999 }));

    // When the compensating write is dispatched
    store.dispatch(undoRequested());

    // Then no new toast is raised for it
    expect(store.getState().undo.entry).toBeNull();
    expect(store.getState().undo.applying).toBe(false);
  });
});
