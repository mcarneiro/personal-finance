import { configureStore } from '@reduxjs/toolkit';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import i18n from './config/i18n';
import { useGoogleAuth } from './contexts/GoogleAuthContext';
import appReducer from './store/appSlice';
import banksReducer from './store/banksSlice';
import billsReducer from './store/billsSlice';
import cardsReducer from './store/cardsSlice';
import incomeReducer from './store/incomeSlice';
import payersReducer from './store/payersSlice';
import planReducer from './store/planSlice';
import settingsReducer from './store/settingsSlice';

// Auth is an external boundary; screens are tested with a signed-in household planner.
vi.mock('./contexts/GoogleAuthContext', () => ({
  useGoogleAuth: vi.fn(),
}));

// Navigation tests are about routing, not the sheet load; the load path has its
// own test in App.sync.test.tsx.
vi.mock('./hooks/useDataSync', () => ({
  useDataSync: () => ({ loadData: vi.fn() }),
}));

const mockedUseGoogleAuth = vi.mocked(useGoogleAuth);

function authState(overrides: Partial<ReturnType<typeof useGoogleAuth>> = {}) {
  return {
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
    ...overrides,
  };
}

async function setLanguage(language: string) {
  await act(async () => {
    await i18n.changeLanguage(language);
  });
}

function appStore({ dataLoading = false, dataLoaded = true } = {}) {
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
    },
    preloadedState: {
      app: { authInitialized: true, dataLoading, dataLoaded, syncing: false, offline: false },
      settings: { sheetId: 'test-sheet' },
    },
  });
}

function renderApp(initialPath: string, store = appStore()) {
  mockedUseGoogleAuth.mockReturnValue(authState());

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </Provider>,
  );
}

describe('month navigation', () => {
  beforeEach(async () => {
    await setLanguage('pt-BR');
  });

  it('moves to the next and previous month on the Spending Plan screen', async () => {
    // Given the app is open on the plan for June 2026
    const user = userEvent.setup();
    renderApp('/plan/2026-06');
    expect(screen.getByRole('heading', { name: 'junho de 2026' })).toBeInTheDocument();

    // When I go to the next month
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));

    // Then the plan shows July 2026
    expect(screen.getByRole('heading', { name: 'julho de 2026' })).toBeInTheDocument();

    // When I go back two months
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }));
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }));

    // Then the plan shows May 2026
    expect(screen.getByRole('heading', { name: 'maio de 2026' })).toBeInTheDocument();
  });

  it('crosses the year boundary on the Bills screen', async () => {
    // Given the app is open on the bills for January 2026
    const user = userEvent.setup();
    renderApp('/bills/2026-01');

    // When I go to the previous month
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }));

    // Then the bills show December 2025
    expect(screen.getByRole('heading', { name: 'dezembro de 2025' })).toBeInTheDocument();
  });

  it('navigates months on the Income screen', async () => {
    // Given the app is open on the income for June 2026
    const user = userEvent.setup();
    renderApp('/income/2026-06');

    // When I go to the next month
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));

    // Then the income shows July 2026
    expect(screen.getByRole('heading', { name: 'julho de 2026' })).toBeInTheDocument();
  });

  it('falls back to the current month when the month is malformed', () => {
    // Given the app is opened on a malformed month
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15));

    // When the plan renders
    renderApp('/plan/not-a-month');

    // Then it redirects to the current month
    expect(screen.getByRole('heading', { name: 'junho de 2026' })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('defaults to pt-BR and switches to en-US from Settings', async () => {
    // Given the app opens on Settings in Portuguese
    const user = userEvent.setup();
    renderApp('/settings');
    expect(screen.getByRole('heading', { name: 'Ajustes' })).toBeInTheDocument();

    // When I select English
    await act(async () => {
      await user.selectOptions(screen.getByLabelText('Idioma'), 'en-US');
    });

    // Then the interface is in English
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByLabelText('Language')).toBeInTheDocument();
  });
});

describe('app shell', () => {
  beforeEach(async () => {
    await setLanguage('pt-BR');
  });

  it('names the current screen in the top bar and returns home with the back button', async () => {
    // Given the app is open on the Spending Plan
    const user = userEvent.setup();
    renderApp('/plan/2026-06');
    expect(screen.getByRole('heading', { name: 'Plano de Gastos' })).toBeInTheDocument();

    // When I tap the back button
    await user.click(screen.getByRole('button', { name: 'Voltar' }));

    // Then the home placeholder is shown
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Seu painel está chegando')).toBeInTheDocument();
  });

  it('moves Settings out of the bottom bar and into the home top bar', async () => {
    // Given the app is open on the Spending Plan
    const user = userEvent.setup();
    renderApp('/plan/2026-06');

    // Then Settings is not one of the bottom-nav tabs
    expect(screen.queryByRole('button', { name: 'Ajustes' })).not.toBeInTheDocument();

    // When I go home and open Settings from the top bar
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await user.click(screen.getByRole('button', { name: 'Ajustes' }));

    // Then Settings is a full-screen page with its own back button and no bottom nav
    expect(screen.getByRole('heading', { name: 'Ajustes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Plano' })).not.toBeInTheDocument();
  });

  it('keeps the scrollable content clear of the fixed bottom bar', () => {
    // Given the app is open on the Spending Plan
    renderApp('/plan/2026-06');

    // Then the main content reserves space for the bottom navigation
    expect(screen.getByRole('main')).toHaveClass('pb-24');
  });

  it('renders plan cards with the elevated card style', () => {
    // Given the app is open on the Spending Plan
    renderApp('/plan/2026-06');

    // Then the plan summary card uses the shared drop-shadow card style
    expect(screen.getByLabelText('Resumo do plano')).toHaveClass('shadow-sm');
  });

  it('adds a spending bucket from the top-bar "+" on the plan screen', async () => {
    // Given the app is open on the June Spending Plan
    const user = userEvent.setup();
    renderApp('/plan/2026-06');

    // When I tap the top-bar add action
    await user.click(screen.getByRole('button', { name: 'Adicionar teto de gastos' }));

    // Then the full-screen bucket editor is shown, with no bottom navigation
    expect(screen.getByRole('heading', { name: 'Novo teto de gastos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Plano' })).not.toBeInTheDocument();
  });

  it('adds a bill from the top-bar "+" on the bills screen', async () => {
    // Given the app is open on the June Bills
    const user = userEvent.setup();
    renderApp('/bills/2026-06');

    // When I tap the top-bar add action
    await user.click(screen.getByRole('button', { name: 'Adicionar conta' }));

    // Then the full-screen bill editor is shown
    expect(screen.getByRole('heading', { name: 'Nova conta' })).toBeInTheDocument();
  });

  it('adds an income entry from the top-bar "+" on the income screen', async () => {
    // Given the app is open on the June Income
    const user = userEvent.setup();
    renderApp('/income/2026-06');

    // Then the income add action is offered, and not the plan or bills ones
    expect(screen.getByRole('button', { name: 'Adicionar renda' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Adicionar teto de gastos' })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar conta' })).not.toBeInTheDocument();

    // When I tap the top-bar add action
    await user.click(screen.getByRole('button', { name: 'Adicionar renda' }));

    // Then the full-screen income editor is shown, with no bottom navigation
    expect(screen.getByRole('heading', { name: 'Nova renda' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Renda' })).not.toBeInTheDocument();
  });

  it('hides the top-bar "+" on the Dashboard', () => {
    // Given the app is open on the Dashboard
    renderApp('/');

    // Then there is no add action, only the Settings shortcut
    expect(
      screen.queryByRole('button', { name: 'Adicionar teto de gastos' })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar conta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar renda' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajustes' })).toBeInTheDocument();
  });
});

describe('startup gate', () => {
  beforeEach(async () => {
    await setLanguage('pt-BR');
  });

  it('shows the loading screen until the initial data load settles', () => {
    // Given the app is still loading the sheet data
    renderApp('/plan/2026-06', appStore({ dataLoading: true, dataLoaded: false }));

    // Then the loading screen shows instead of the plan
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Plano de Gastos' })).not.toBeInTheDocument();
  });

  it('sends a signed-out user to onboarding', () => {
    // Given the user is not signed in
    mockedUseGoogleAuth.mockReturnValue(
      authState({ isSignedIn: false, userEmail: null, accessToken: null })
    );

    // When the app opens on the plan
    render(
      <Provider store={appStore()}>
        <MemoryRouter initialEntries={['/plan/2026-06']}>
          <App />
        </MemoryRouter>
      </Provider>,
    );

    // Then onboarding is shown
    expect(screen.getByRole('heading', { name: 'Bem-vindo ao Planoo' })).toBeInTheDocument();
  });
});
