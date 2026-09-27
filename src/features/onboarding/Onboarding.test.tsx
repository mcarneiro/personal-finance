import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../config/i18n';
import { useGoogleAuth } from '../../contexts/GoogleAuthContext';
import { googleSheetsService } from '../../services/GoogleSheetsService';
import settingsReducer from '../../store/settingsSlice';
import Onboarding from './Onboarding';

vi.mock('../../contexts/GoogleAuthContext', () => ({
  useGoogleAuth: vi.fn(),
}));

// The sheets service is an external boundary; only initialization is controlled here.
vi.mock('../../services/GoogleSheetsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/GoogleSheetsService')>();
  return {
    ...actual,
    googleSheetsService: { ...actual.googleSheetsService, initializeSheets: vi.fn() },
  };
});

const mockedUseGoogleAuth = vi.mocked(useGoogleAuth);
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/spreadsheet-abc/edit#gid=0';

function authState(overrides: Partial<ReturnType<typeof useGoogleAuth>> = {}) {
  return {
    isSignedIn: false,
    userEmail: null,
    accessToken: null,
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

function renderOnboarding(existingSheetId: string | null = null) {
  const store = configureStore({
    reducer: { settings: settingsReducer },
    preloadedState: { settings: { sheetId: existingSheetId } },
  });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/" element={<div>PLAN HOME</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

  return store;
}

describe('Onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signs the user in with Google when signed out', async () => {
    // Given a signed-out user
    const signIn = vi.fn();
    mockedUseGoogleAuth.mockReturnValue(authState({ signIn }));
    renderOnboarding();

    // When they choose to sign in
    await userEvent.click(screen.getByRole('button', { name: 'Entrar com Google' }));

    // Then the Google sign-in flow starts
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('connects a pasted sheet URL, creates missing tabs, and enters the app', async () => {
    // Given a signed-in user with no connected sheet
    mockedUseGoogleAuth.mockReturnValue(authState({ isSignedIn: true, userEmail: 'a@b.com' }));
    const store = renderOnboarding();

    // When they paste a Google Sheet URL and complete setup
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('URL da Planilha Google'), SHEET_URL);
    await user.click(screen.getByRole('button', { name: 'Concluir configuração' }));

    // Then the sheet is initialized with only the missing tabs handled by the service
    await waitFor(() =>
      expect(googleSheetsService.initializeSheets).toHaveBeenCalledWith('spreadsheet-abc')
    );

    // And the connection is remembered and the app is entered
    expect(store.getState().settings.sheetId).toBe('spreadsheet-abc');
    expect(screen.getByText('PLAN HOME')).toBeInTheDocument();
  });

  it('rejects a URL that is not a Google Sheet', async () => {
    // Given a signed-in user with no connected sheet
    mockedUseGoogleAuth.mockReturnValue(authState({ isSignedIn: true, userEmail: 'a@b.com' }));
    renderOnboarding();

    // When they submit something that is not a sheet URL
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('URL da Planilha Google'), 'not a sheet');
    await user.click(screen.getByRole('button', { name: 'Concluir configuração' }));

    // Then setup is refused with an error and nothing is initialized
    expect(
      await screen.findByText('Informe uma URL de Planilha Google válida.')
    ).toBeInTheDocument();
    expect(googleSheetsService.initializeSheets).not.toHaveBeenCalled();
  });

  it('waits for the app to load when a sheet is already connected', () => {
    // Given a signed-in user who already has a connected sheet
    mockedUseGoogleAuth.mockReturnValue(authState({ isSignedIn: true, userEmail: 'a@b.com' }));

    // When onboarding renders
    renderOnboarding('spreadsheet-abc');

    // Then it shows the loading message while the app navigates on
    expect(screen.getByText('Carregando seus dados...')).toBeInTheDocument();
  });
});
