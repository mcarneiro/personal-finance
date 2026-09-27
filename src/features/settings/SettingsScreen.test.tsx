import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../config/i18n';
import { useGoogleAuth } from '../../contexts/GoogleAuthContext';
import { googleSheetsService } from '../../services/GoogleSheetsService';
import settingsReducer from '../../store/settingsSlice';
import SettingsScreen from './SettingsScreen';

vi.mock('../../contexts/GoogleAuthContext', () => ({
  useGoogleAuth: vi.fn(),
}));

vi.mock('../../services/GoogleSheetsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/GoogleSheetsService')>();
  return {
    ...actual,
    googleSheetsService: { ...actual.googleSheetsService, initializeSheets: vi.fn() },
  };
});

const mockedUseGoogleAuth = vi.mocked(useGoogleAuth);
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/spreadsheet-xyz/edit';

function renderSettings(existingSheetId: string | null = null) {
  const store = configureStore({
    reducer: { settings: settingsReducer },
    preloadedState: { settings: { sheetId: existingSheetId } },
  });

  render(
    <Provider store={store}>
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>
    </Provider>
  );

  return store;
}

describe('Settings connected sheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseGoogleAuth.mockReturnValue({
      isSignedIn: true,
      userEmail: 'a@b.com',
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
  });

  it('shows the connected sheet without exposing its full ID', () => {
    // Given a connected sheet ending in 1234
    // When settings renders
    renderSettings('spreadsheet-1234');

    // Then only a masked identifier is shown
    expect(screen.getByText(/••••••1234/)).toBeInTheDocument();
  });

  it('changes the connected sheet and remembers it', async () => {
    // Given no sheet is connected
    const store = renderSettings(null);

    // When the user pastes a sheet URL and connects it
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('URL da Planilha Google'), SHEET_URL);
    await user.click(screen.getByRole('button', { name: 'Conectar planilha' }));

    // Then missing tabs are ensured, the connection is remembered, and it is acknowledged
    await waitFor(() =>
      expect(googleSheetsService.initializeSheets).toHaveBeenCalledWith('spreadsheet-xyz')
    );
    expect(store.getState().settings.sheetId).toBe('spreadsheet-xyz');
    expect(screen.getByText('Planilha conectada.')).toBeInTheDocument();
  });

  it('rejects an invalid sheet URL', async () => {
    // Given no sheet is connected
    renderSettings(null);

    // When the user submits something that is not a sheet URL
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('URL da Planilha Google'), 'not a sheet');
    await user.click(screen.getByRole('button', { name: 'Conectar planilha' }));

    // Then the connection is refused
    expect(
      await screen.findByText('Informe uma URL de Planilha Google válida.')
    ).toBeInTheDocument();
    expect(googleSheetsService.initializeSheets).not.toHaveBeenCalled();
  });
});
