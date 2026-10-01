import { configureStore } from '@reduxjs/toolkit';
import { act, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import i18n from './config/i18n';
import { useGoogleAuth } from './contexts/GoogleAuthContext';
import { googleSheetsService } from './services/GoogleSheetsService';
import { loadWorkingCopy, saveWorkingCopy } from './services/workingCopyCache';
import appReducer from './store/appSlice';
import banksReducer from './store/banksSlice';
import billsReducer from './store/billsSlice';
import cardsReducer from './store/cardsSlice';
import incomeReducer from './store/incomeSlice';
import payersReducer from './store/payersSlice';
import pendingReducer from './store/pendingSlice';
import planReducer from './store/planSlice';
import settingsReducer, { setSheetId } from './store/settingsSlice';
import type { Bill, PendingChanges, SheetData } from './types';

vi.mock('./contexts/GoogleAuthContext', () => ({
  useGoogleAuth: vi.fn(),
}));

vi.mock('./services/GoogleSheetsService', () => ({
  googleSheetsService: {
    setAccessToken: vi.fn(),
    initializeSheets: vi.fn(),
    pullAll: vi.fn(),
    writePendingChanges: vi.fn(),
  },
  GoogleSheetsService: { extractSpreadsheetId: vi.fn() },
}));

const mockedUseGoogleAuth = vi.mocked(useGoogleAuth);
const pullAll = vi.mocked(googleSheetsService.pullAll);

function emptySheet(): SheetData {
  return { cards: [], banks: [], payers: [], planItems: [], cardSpending: [], bills: [], income: [] };
}

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

interface StoreOptions {
  pending?: PendingChanges;
  app?: Partial<{ dataLoading: boolean; dataLoaded: boolean; syncing: boolean; offline: boolean }>;
}

function createStore({ pending = {}, app = {} }: StoreOptions = {}) {
  return configureStore({
    reducer: {
      app: appReducer,
      cards: cardsReducer,
      banks: banksReducer,
      payers: payersReducer,
      plan: planReducer,
      bills: billsReducer,
      income: incomeReducer,
      settings: settingsReducer,
      pending: pendingReducer,
    },
    preloadedState: {
      app: { authInitialized: true, dataLoading: false, dataLoaded: false, syncing: false, offline: false, ...app },
      settings: { sheetId: 'test-sheet' },
      pending: { changes: pending },
    },
  });
}

function renderApp(store: ReturnType<typeof createStore>, path = '/plan/2026-06') {
  mockedUseGoogleAuth.mockReturnValue({
    isSignedIn: true,
    userEmail: 'planner@example.com',
    accessToken: 'test-token',
    error: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    fullLogout: vi.fn(),
    persistAuth: false,
    setPersistAuth: vi.fn(),
    sessionExpired: false,
    clearSessionExpired: vi.fn(),
  });

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </Provider>
  );
}

/** Flush the promise chain a pull starts (works under fake timers). */
async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('pull sync cycle', () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('pt-BR');
    });
    vi.resetAllMocks();
    // The Working Copy cache is real localStorage; start every case cold.
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the connected sheet behind the loading screen and then paints it', async () => {
    // Given the pull is still in flight
    let resolvePull!: (data: SheetData) => void;
    pullAll.mockReturnValue(
      new Promise<SheetData>((resolve) => {
        resolvePull = resolve;
      })
    );
    const store = createStore();

    // When the app opens
    renderApp(store);

    // Then it holds a loading screen instead of flashing empty data
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
    expect(pullAll).toHaveBeenCalledWith('test-sheet', { verifySchema: true });

    // When the sheet responds
    await act(async () => {
      resolvePull({ ...emptySheet(), cards: [{ id: 'c1', name: 'cc guta' }] });
    });

    // Then the plan renders and the data is in the store
    expect(screen.getByRole('heading', { name: 'Plano de Gastos' })).toBeInTheDocument();
    expect(store.getState().cards.items).toEqual([{ id: 'c1', name: 'cc guta' }]);
  });

  it('replays Pending Changes over the pull so an unwritten local edit survives', async () => {
    // Given an edit typed on this device that the sheet has not received yet
    const local = bill('b1', { amount: 120 });
    const store = createStore({
      pending: { bills: { b1: { type: 'update', id: 'b1', record: local } } },
    });
    // And a pull that brings the sheet's older value for the same row
    pullAll.mockResolvedValue({ ...emptySheet(), bills: [bill('b1', { amount: 999 })] });

    // When the app opens
    renderApp(store, '/bills/2026-06');

    // Then the local edit wins over the fresh row
    await waitFor(() => expect(store.getState().bills.items).toHaveLength(1));
    expect(store.getState().bills.items[0]).toEqual(local);
  });

  it('pushes Pending Changes after a pull and drops them once the write succeeds', async () => {
    // Given an edit whose earlier write failed (still pending on this device)
    const local = bill('b1', { amount: 120 });
    const store = createStore({
      pending: { bills: { b1: { type: 'update', id: 'b1', record: local } } },
    });
    pullAll.mockResolvedValue({ ...emptySheet(), bills: [bill('b1', { amount: 999 })] });

    // When the app opens and the pull settles
    renderApp(store, '/bills/2026-06');

    // Then the pending edit is pushed row-scoped and cleared on success
    await waitFor(() =>
      expect(googleSheetsService.writePendingChanges).toHaveBeenCalledWith('test-sheet', {
        bills: { b1: { type: 'update', id: 'b1', record: local } },
      })
    );
    await waitFor(() => expect(store.getState().pending.changes.bills?.b1).toBeUndefined());
    expect(store.getState().bills.items[0]).toEqual(local);
  });

  it('keeps Pending Changes when the post-pull push fails', async () => {
    // Given a pending edit and a pull that succeeds while the write is offline
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const local = bill('b1', { amount: 120 });
    const store = createStore({
      pending: { bills: { b1: { type: 'update', id: 'b1', record: local } } },
    });
    pullAll.mockResolvedValue({ ...emptySheet(), bills: [bill('b1', { amount: 999 })] });
    vi.mocked(googleSheetsService.writePendingChanges).mockRejectedValue(new Error('offline'));

    // When the app opens
    renderApp(store, '/bills/2026-06');

    // Then the fresh rows are painted with the local edit replayed, and the
    // Pending Change is kept for the next save or pull
    await waitFor(() => expect(store.getState().bills.items[0]).toEqual(local));
    expect(store.getState().pending.changes.bills?.b1).toBeDefined();
  });

  it('shows the syncing indicator only while a background pull is in flight, without gating the UI', async () => {
    // Given a session whose first paint has settled
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
    pullAll.mockResolvedValueOnce(emptySheet());
    const store = createStore();
    renderApp(store);
    await flushPromises();
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();

    // When a focus pull after the throttle window is held in flight
    let resolveSecond!: (data: SheetData) => void;
    pullAll.mockReturnValueOnce(
      new Promise<SheetData>((resolve) => {
        resolveSecond = resolve;
      })
    );
    vi.setSystemTime(new Date(Date.now() + 31_000));
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    // Then the subtle indicator shows and the UI is never gated
    expect(screen.getByRole('status')).toHaveTextContent('Sincronizando...');
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();

    // When the pull settles
    await act(async () => {
      resolveSecond(emptySheet());
    });

    // Then the indicator is gone
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('pulls again on focus only after the throttle window', async () => {
    // Given a session whose first paint has settled
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
    pullAll.mockResolvedValue(emptySheet());
    renderApp(createStore());
    await flushPromises();
    expect(pullAll).toHaveBeenCalledTimes(1);

    // When the window regains focus too soon
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    // Then no second pull happens
    expect(pullAll).toHaveBeenCalledTimes(1);

    // When it regains focus after the throttle window
    vi.setSystemTime(new Date(Date.now() + 31_000));
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    // Then it pulls again
    expect(pullAll).toHaveBeenCalledTimes(2);
  });

  it('ignores a focus pull while one is already in flight', async () => {
    // Given the startup pull has not settled yet
    let resolvePull!: (data: SheetData) => void;
    pullAll.mockReturnValue(
      new Promise<SheetData>((resolve) => {
        resolvePull = resolve;
      })
    );
    renderApp(createStore());
    await flushPromises();

    // When the window regains focus
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    // Then the in-flight pull is not doubled up
    expect(pullAll).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePull(emptySheet());
    });
  });

  it('keeps the loading gate after a failed cold startup pull, then reveals the app on retry', async () => {
    // Given a first-ever connect (no cache) whose initial pull fails (offline)
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
    pullAll.mockRejectedValueOnce(new Error('offline'));
    const store = createStore();
    renderApp(store);
    await flushPromises();

    // Then there is no editable empty app to overwrite the sheet from: the
    // loading gate stays up
    expect(screen.getByText('Carregando...')).toBeInTheDocument();

    // When the sheet comes back and a focus pull succeeds
    pullAll.mockResolvedValueOnce(emptySheet());
    vi.setSystemTime(new Date(Date.now() + 31_000));
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await flushPromises();

    // Then the app is revealed with the fresh data
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Plano de Gastos' })).toBeInTheDocument();
  });

  it('paints the cached Working Copy before the pull settles', async () => {
    // Given the previous session cached a bill
    saveWorkingCopy('test-sheet', { ...emptySheet(), bills: [bill('cached')] });
    let resolvePull!: (data: SheetData) => void;
    pullAll.mockReturnValue(
      new Promise<SheetData>((resolve) => {
        resolvePull = resolve;
      })
    );
    const store = createStore();

    // When the app opens while the fresh pull is still in flight
    renderApp(store, '/bills/2026-06');

    // Then the cached data is already painted, with no loading gate
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
    expect(store.getState().bills.items).toEqual([bill('cached')]);

    // When the fresh pull lands
    await act(async () => {
      resolvePull({ ...emptySheet(), bills: [bill('cached', { amount: 999 })] });
    });

    // Then it swaps the fresh value in
    expect(store.getState().bills.items[0].amount).toBe(999);
  });

  it('trusts the cached schema and skips the header checks on a warm startup', async () => {
    // Given a cached Working Copy stamped for this sheet and contract
    saveWorkingCopy('test-sheet', emptySheet());
    pullAll.mockResolvedValue(emptySheet());

    // When the app opens
    renderApp(createStore());

    // Then the pull is told the schema is already known-good
    await waitFor(() =>
      expect(pullAll).toHaveBeenCalledWith('test-sheet', { verifySchema: false })
    );
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
  });

  it('marks a cold startup so the pull runs the schema check', async () => {
    // Given a first-ever connect with no cached Working Copy
    pullAll.mockResolvedValue(emptySheet());

    // When the app opens
    renderApp(createStore());

    // Then the pull is asked to verify the schema
    await waitFor(() =>
      expect(pullAll).toHaveBeenCalledWith('test-sheet', { verifySchema: true })
    );
  });

  it('shows last-saved data with the offline hint when the startup pull fails', async () => {
    // Given a cached Working Copy from the last successful session
    vi.spyOn(console, 'error').mockImplementation(() => {});
    saveWorkingCopy('test-sheet', { ...emptySheet(), bills: [bill('cached')] });
    pullAll.mockRejectedValueOnce(new Error('offline'));
    const store = createStore();

    // When the app opens offline
    renderApp(store, '/bills/2026-06');

    // Then the last-saved data is still shown, with the offline hint
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('offline'));
    expect(store.getState().bills.items).toEqual([bill('cached')]);
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
  });

  it('persists the merged snapshot after a successful pull', async () => {
    // Given a fresh pull with a bill
    pullAll.mockResolvedValue({ ...emptySheet(), bills: [bill('fresh')] });

    // When the app opens and the pull settles
    renderApp(createStore(), '/bills/2026-06');

    // Then the snapshot is cached for the next startup
    await waitFor(() =>
      expect(loadWorkingCopy('test-sheet')?.bills).toEqual([bill('fresh')])
    );
  });

  it('never shows the previous sheet data after changing the sheet in Settings', async () => {
    // Given sheet A loaded with a bill and an unwritten local edit for it
    const localEdit = bill('a-local', { amount: 777 });
    pullAll.mockResolvedValueOnce({ ...emptySheet(), bills: [bill('sheet-a')] });
    const store = createStore({
      pending: { bills: { 'a-local': { type: 'update', id: 'a-local', record: localEdit } } },
    });
    renderApp(store, '/bills/2026-06');
    await waitFor(() => expect(store.getState().bills.items).toHaveLength(2));

    // When the household connects a different sheet and its data has not arrived
    let resolveOther!: (data: SheetData) => void;
    pullAll.mockReturnValueOnce(
      new Promise<SheetData>((resolve) => {
        resolveOther = resolve;
      })
    );
    await act(async () => {
      store.dispatch(setSheetId('other-sheet'));
    });
    await flushPromises();

    // Then the previous sheet's bill and its pending edit are gone, and the app
    // waits behind the gate
    expect(store.getState().bills.items).toEqual([]);
    expect(store.getState().pending.changes).toEqual({});
    expect(screen.getByText('Carregando...')).toBeInTheDocument();

    // And the new sheet's fresh rows are not polluted by the old pending edit
    await act(async () => {
      resolveOther({ ...emptySheet(), bills: [bill('sheet-b')] });
    });
    expect(store.getState().bills.items.map((item) => item.id)).toEqual(['sheet-b']);
  });

  it('discards a pull that lands after the sheet changed mid-flight', async () => {
    // Given a pull for sheet A is still in flight
    let resolveA!: (data: SheetData) => void;
    pullAll.mockReturnValueOnce(
      new Promise<SheetData>((resolve) => {
        resolveA = resolve;
      })
    );
    const store = createStore();
    renderApp(store, '/bills/2026-06');
    await flushPromises();

    // When the household switches to sheet B while A is still loading
    let resolveB!: (data: SheetData) => void;
    pullAll.mockReturnValueOnce(
      new Promise<SheetData>((resolve) => {
        resolveB = resolve;
      })
    );
    await act(async () => {
      store.dispatch(setSheetId('other-sheet'));
    });
    await flushPromises();

    // And A's pull finally lands with A's bill
    await act(async () => {
      resolveA({ ...emptySheet(), bills: [bill('sheet-a')] });
    });
    await flushPromises();

    // Then A's data is discarded, not painted over sheet B...
    expect(store.getState().bills.items).toEqual([]);
    // ...and B's pull has been started in its place
    expect(pullAll).toHaveBeenLastCalledWith('other-sheet', { verifySchema: true });

    await act(async () => {
      resolveB(emptySheet());
    });
  });
});
