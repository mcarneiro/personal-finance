import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Outflow } from '../../types';
import { loadWorkingCopy } from '../../services/workingCopyCache';
import { googleSheetsService } from '../../services/GoogleSheetsService';
import { syncListenerMiddleware } from '../middleware/syncListener';
import { addOutflow, updateOutflow } from '../outflowsSlice';
import outflowsReducer from '../outflowsSlice';
import banksReducer from '../banksSlice';
import cardsReducer from '../cardsSlice';
import incomeReducer from '../incomeSlice';
import payersReducer from '../payersSlice';
import pendingReducer from '../pendingSlice';
import planReducer from '../planSlice';
import settingsReducer, { setSheetId } from '../settingsSlice';

vi.mock('../../services/GoogleSheetsService', () => ({
  googleSheetsService: {
    writePendingChanges: vi.fn().mockResolvedValue(undefined),
  },
}));

function outflow(id: string, overrides: Partial<Outflow> = {}): Outflow {
  return {
    id,
    month: '2026-06',
    name: `Outflow ${id}`,
    amount: 100,
    isPaid: false,
    isFinal: true,
    payerId: 'payer-1',
    bankId: 'bank-1',
    ...overrides,
  };
}

/**
 * A successful write must refresh the cached Working Copy (ADR-0007), so the
 * next startup paints the just-saved data rather than the previous session's.
 */
function makeStore() {
  return configureStore({
    reducer: {
      cards: cardsReducer,
      banks: banksReducer,
      payers: payersReducer,
      plan: planReducer,
      outflows: outflowsReducer,
      income: incomeReducer,
      settings: settingsReducer,
      pending: pendingReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(syncListenerMiddleware.middleware),
    preloadedState: { settings: { sheetId: 'sheet-1' } },
  });
}

describe('Working Copy persistence after a write', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('caches the merged snapshot after a successful push', async () => {
    // Given a connected store with the real debounced sync middleware
    const store = makeStore();

    // When a outflow is added and the debounced write succeeds
    store.dispatch(addOutflow(outflow('b1')));

    // Then the snapshot is cached for the next startup
    await vi.waitFor(() => {
      expect(googleSheetsService.writePendingChanges).toHaveBeenCalled();
      expect(loadWorkingCopy('sheet-1')?.outflows).toEqual([outflow('b1')]);
    }, { timeout: 2500 });
  });

  it('abandons a debounced write that raced a Settings sheet change', async () => {
    // Given a outflow edit whose write is still inside the debounce window
    vi.useFakeTimers();
    const store = makeStore();
    store.dispatch(addOutflow(outflow('b1')));

    // When the household changes the connected sheet before the debounce fires
    store.dispatch(setSheetId('sheet-2'));
    await vi.advanceTimersByTimeAsync(1100);

    // Then the previous sheet's data is never written to the new sheet, nor
    // cached under it
    expect(googleSheetsService.writePendingChanges).not.toHaveBeenCalled();
    expect(loadWorkingCopy('sheet-2')).toBeNull();
  });

  it('keeps Pending Changes after a failed write and clears them on the retry', async () => {
    // Given a connected store whose sheet is unreachable for the first write
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = makeStore();
    vi.mocked(googleSheetsService.writePendingChanges).mockRejectedValueOnce(
      new Error('offline')
    );
    store.dispatch(addOutflow(outflow('b1')));

    // When the debounced write fails
    await vi.advanceTimersByTimeAsync(1100);

    // Then the Pending Change is kept for a retry, not lost
    expect(store.getState().pending.changes.outflows?.b1).toBeDefined();

    // When the household edits again and the next save succeeds
    store.dispatch(updateOutflow(outflow('b1', { amount: 150 })));
    await vi.advanceTimersByTimeAsync(1100);

    // Then the retried write clears the Pending Change
    expect(store.getState().pending.changes.outflows?.b1).toBeUndefined();
  });
});
