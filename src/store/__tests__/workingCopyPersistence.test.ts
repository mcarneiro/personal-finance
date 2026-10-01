import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bill } from '../../types';
import { loadWorkingCopy } from '../../services/workingCopyCache';
import { googleSheetsService } from '../../services/GoogleSheetsService';
import { syncListenerMiddleware } from '../middleware/syncListener';
import { addBill } from '../billsSlice';
import billsReducer from '../billsSlice';
import banksReducer from '../banksSlice';
import cardsReducer from '../cardsSlice';
import incomeReducer from '../incomeSlice';
import payersReducer from '../payersSlice';
import pendingReducer from '../pendingSlice';
import planReducer from '../planSlice';
import settingsReducer, { setSheetId } from '../settingsSlice';

vi.mock('../../services/GoogleSheetsService', () => ({
  googleSheetsService: {
    writeBills: vi.fn().mockResolvedValue(undefined),
  },
}));

function bill(id: string): Bill {
  return {
    id,
    month: '2026-06',
    name: `Bill ${id}`,
    amount: 100,
    isPaid: false,
    isFinal: true,
    payerId: 'payer-1',
    bankId: 'bank-1',
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
      bills: billsReducer,
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

    // When a bill is added and the debounced write succeeds
    store.dispatch(addBill(bill('b1')));

    // Then the snapshot is cached for the next startup
    await vi.waitFor(() => {
      expect(googleSheetsService.writeBills).toHaveBeenCalled();
      expect(loadWorkingCopy('sheet-1')?.bills).toEqual([bill('b1')]);
    }, { timeout: 2500 });
  });

  it('abandons a debounced write that raced a Settings sheet change', async () => {
    // Given a bill edit whose write is still inside the debounce window
    vi.useFakeTimers();
    const store = makeStore();
    store.dispatch(addBill(bill('b1')));

    // When the household changes the connected sheet before the debounce fires
    store.dispatch(setSheetId('sheet-2'));
    await vi.advanceTimersByTimeAsync(1100);

    // Then the previous sheet's data is never written to the new sheet, nor
    // cached under it
    expect(googleSheetsService.writeBills).not.toHaveBeenCalled();
    expect(loadWorkingCopy('sheet-2')).toBeNull();
  });
});
