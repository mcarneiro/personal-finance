import { configureStore } from '@reduxjs/toolkit';
import { act, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import i18n from './config/i18n';
import { useGoogleAuth } from './contexts/GoogleAuthContext';
import { googleSheetsService } from './services/GoogleSheetsService';
import appReducer from './store/appSlice';
import banksReducer from './store/banksSlice';
import billsReducer from './store/billsSlice';
import cardsReducer from './store/cardsSlice';
import incomeReducer from './store/incomeSlice';
import payersReducer from './store/payersSlice';
import pendingReducer from './store/pendingSlice';
import planReducer from './store/planSlice';
import settingsReducer from './store/settingsSlice';
import type { Bill, PendingChanges, SheetData } from './types';

vi.mock('./contexts/GoogleAuthContext', () => ({
  useGoogleAuth: vi.fn(),
}));

vi.mock('./services/GoogleSheetsService', () => ({
  googleSheetsService: {
    setAccessToken: vi.fn(),
    initializeSheets: vi.fn(),
    pullAll: vi.fn(),
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
  app?: Partial<{ dataLoading: boolean; dataLoaded: boolean; syncing: boolean }>;
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
      app: { authInitialized: true, dataLoading: false, dataLoaded: false, syncing: false, ...app },
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
    expect(pullAll).toHaveBeenCalledWith('test-sheet');

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

  it('does not re-gate the UI when a failed startup pull is retried on focus', async () => {
    // Given the first pull of the session fails (offline)
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
    pullAll.mockRejectedValueOnce(new Error('offline'));
    const store = createStore();
    renderApp(store);
    await flushPromises();

    // Then the app is not stranded on the loading screen
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();

    // When the window regains focus after the throttle window
    let resolveRetry!: (data: SheetData) => void;
    pullAll.mockReturnValueOnce(
      new Promise<SheetData>((resolve) => {
        resolveRetry = resolve;
      })
    );
    vi.setSystemTime(new Date(Date.now() + 31_000));
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    // Then the retry is a background pull, not another startup gate
    expect(screen.getByRole('status')).toHaveTextContent('Sincronizando...');
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();

    await act(async () => {
      resolveRetry(emptySheet());
    });
  });
});
