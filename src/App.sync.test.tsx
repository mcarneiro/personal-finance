import { configureStore } from '@reduxjs/toolkit';
import { act, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import i18n from './config/i18n';
import { useGoogleAuth } from './contexts/GoogleAuthContext';
import { googleSheetsService } from './services/GoogleSheetsService';
import appReducer from './store/appSlice';
import billsReducer from './store/billsSlice';
import cardsReducer from './store/cardsSlice';
import incomeReducer from './store/incomeSlice';
import planReducer from './store/planSlice';
import settingsReducer from './store/settingsSlice';
import { Card } from './types';

vi.mock('./contexts/GoogleAuthContext', () => ({
  useGoogleAuth: vi.fn(),
}));

vi.mock('./services/GoogleSheetsService', () => ({
  googleSheetsService: {
    setAccessToken: vi.fn(),
    initializeSheets: vi.fn(),
    readCards: vi.fn(),
    readPlanItems: vi.fn(),
    readCardSpending: vi.fn(),
    readBills: vi.fn(),
    readIncome: vi.fn(),
  },
  GoogleSheetsService: { extractSpreadsheetId: vi.fn() },
}));

const mockedUseGoogleAuth = vi.mocked(useGoogleAuth);

describe('startup data load', () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('pt-BR');
    });
    vi.clearAllMocks();
  });

  it('loads the connected sheet on start behind the loading screen', async () => {
    // Given the sheet read is still in flight
    let resolveCards: (cards: Card[]) => void = () => {};
    vi.mocked(googleSheetsService.readCards).mockReturnValue(
      new Promise<Card[]>((resolve) => {
        resolveCards = resolve;
      })
    );
    vi.mocked(googleSheetsService.readPlanItems).mockResolvedValue([]);
    vi.mocked(googleSheetsService.readCardSpending).mockResolvedValue([]);
    vi.mocked(googleSheetsService.readBills).mockResolvedValue([]);
    vi.mocked(googleSheetsService.readIncome).mockResolvedValue([]);

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

    const store = configureStore({
      reducer: {
        app: appReducer,
        cards: cardsReducer,
        plan: planReducer,
        bills: billsReducer,
        income: incomeReducer,
        settings: settingsReducer,
      },
      preloadedState: {
        app: { authInitialized: true, dataLoading: false, dataLoaded: false },
        settings: { sheetId: 'test-sheet' },
      },
    });

    // When the app opens on the plan
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/plan/2026-06']}>
          <App />
        </MemoryRouter>
      </Provider>,
    );

    // Then it holds a loading screen instead of flashing empty data
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
    expect(googleSheetsService.readCards).toHaveBeenCalledWith('test-sheet');

    // When the sheet responds
    await act(async () => {
      resolveCards([{ id: 'c1', name: 'cc guta' }]);
    });

    // Then the plan renders and the data is in the store
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Plano de Gastos' })).toBeInTheDocument()
    );
    expect(store.getState().cards.items).toEqual([{ id: 'c1', name: 'cc guta' }]);
  });
});
