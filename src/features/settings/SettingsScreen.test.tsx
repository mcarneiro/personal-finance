import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../config/i18n';
import { useGoogleAuth } from '../../contexts/GoogleAuthContext';
import { googleSheetsService } from '../../services/GoogleSheetsService';
import banksReducer from '../../store/banksSlice';
import cardsReducer from '../../store/cardsSlice';
import payersReducer from '../../store/payersSlice';
import planReducer from '../../store/planSlice';
import { syncListenerMiddleware } from '../../store/middleware/syncListener';
import pendingReducer from '../../store/pendingSlice';
import settingsReducer from '../../store/settingsSlice';
import { lastWrittenRecords, writtenChanges, writtenRecords } from '../../test/pendingWrites';
import { Bank, Card, CardSpending, Payer } from '../../types';
import SettingsScreen from './SettingsScreen';

vi.mock('../../contexts/GoogleAuthContext', () => ({
  useGoogleAuth: vi.fn(),
}));

vi.mock('../../services/GoogleSheetsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/GoogleSheetsService')>();
  return {
    ...actual,
    googleSheetsService: {
      ...actual.googleSheetsService,
      initializeSheets: vi.fn(),
      writePendingChanges: vi.fn(),
    },
  };
});

const mockedUseGoogleAuth = vi.mocked(useGoogleAuth);
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/spreadsheet-xyz/edit';

function signedInAuth() {
  return {
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
  };
}

function renderSettings(existingSheetId: string | null = null) {
  const store = configureStore({
    reducer: {
      cards: cardsReducer,
      banks: banksReducer,
      payers: payersReducer,
      settings: settingsReducer,
    },
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

/**
 * Renders the registry with the real debounced sync middleware (Seam B): only
 * the sheets service is mocked, so adding/renaming/removing a card is verified
 * all the way to the write-back call.
 */
function renderRegistry({
  cards = [] as Card[],
  cardSpending = [] as CardSpending[],
  banks = [] as Bank[],
  payers = [] as Payer[],
} = {}) {
  const store = configureStore({
    reducer: {
      cards: cardsReducer,
      banks: banksReducer,
      payers: payersReducer,
      plan: planReducer,
      settings: settingsReducer,
      pending: pendingReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(syncListenerMiddleware.middleware),
    preloadedState: {
      cards: { items: cards },
      banks: { items: banks },
      payers: { items: payers },
      plan: { items: [], cardSpending },
      settings: { sheetId: 'sheet-1' },
    },
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
    mockedUseGoogleAuth.mockReturnValue(signedInAuth());
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

describe('Settings card registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseGoogleAuth.mockReturnValue(signedInAuth());
  });

  it('lists the registered cards', () => {
    // Given the household has registered two cards
    // When settings renders
    renderRegistry({
      cards: [
        { id: 'c1', name: 'cc guta' },
        { id: 'c2', name: 'cc uv' },
      ],
    });

    // Then both cards are listed
    expect(screen.getByText('cc guta')).toBeInTheDocument();
    expect(screen.getByText('cc uv')).toBeInTheDocument();
  });

  it('adds a card and writes the updated registry back to the sheet', async () => {
    // Given no cards are registered
    renderRegistry();
    const user = userEvent.setup();

    // When the user adds a card by name
    await user.type(screen.getByLabelText('Nome do cartão'), 'cc ml');
    await user.click(screen.getByRole('button', { name: 'Adicionar cartão' }));

    // Then the card is listed under a fresh id
    expect(screen.getByText('cc ml')).toBeInTheDocument();

    // And the updated registry is persisted to the sheet's cards tab
    await waitFor(
      () =>
        expect(lastWrittenRecords(googleSheetsService, 'cards')).toEqual([
          expect.objectContaining({ id: expect.any(String), name: 'cc ml' }),
        ]),
      { timeout: 2500 }
    );
  });

  it('does not add a card without a name', async () => {
    // Given no cards are registered
    renderRegistry();
    const user = userEvent.setup();

    // When the user submits the add form with an empty name
    const addButton = screen.getByRole('button', { name: 'Adicionar cartão' });
    expect(addButton).toBeDisabled();
    await user.click(addButton);

    // Then no card is registered
    expect(screen.queryByRole('button', { name: /^Renomear/ })).not.toBeInTheDocument();
  });

  it('renames a card and writes the updated registry back to the sheet', async () => {
    // Given one registered card
    renderRegistry({ cards: [{ id: 'c1', name: 'cc guta' }] });
    const user = userEvent.setup();

    // When the user renames it
    await user.click(screen.getByRole('button', { name: 'Renomear cc guta' }));
    const input = screen.getByLabelText('Novo nome do cartão');
    await user.clear(input);
    await user.type(input, 'cc guta visa');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then the new name is shown
    expect(screen.getByText('cc guta visa')).toBeInTheDocument();

    // And the updated registry is persisted to the sheet's cards tab
    await waitFor(
      () =>
        expect(lastWrittenRecords(googleSheetsService, 'cards')).toEqual([
          expect.objectContaining({ id: 'c1', name: 'cc guta visa' }),
        ]),
      { timeout: 2500 }
    );
  });

  it('removes a card without corrupting the card spending recorded for past months', async () => {
    // Given a card with spending already recorded in June
    const juneSpending: CardSpending[] = [
      { id: '2026-06-c1', month: '2026-06', cardId: 'c1', total: 2899 },
    ];
    renderRegistry({
      cards: [
        { id: 'c1', name: 'cc guta' },
        { id: 'c2', name: 'cc uv' },
      ],
      cardSpending: juneSpending,
    });
    const user = userEvent.setup();

    // When the user removes the card
    await user.click(screen.getByRole('button', { name: 'Remover cc guta' }));

    // Then it is gone from the registry
    expect(screen.queryByText('cc guta')).not.toBeInTheDocument();

    // And only the cards tab is written back — never the card_spending tab, so
    // the historical Total Spent survives untouched
    await waitFor(
      () =>
        expect(writtenChanges(googleSheetsService, 'cards')).toContainEqual({
          type: 'delete',
          id: 'c1',
        }),
      { timeout: 2500 }
    );
    expect(writtenRecords(googleSheetsService, 'card_spending')).toEqual([]);
  });
});

describe('Settings bank and payer registries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseGoogleAuth.mockReturnValue(signedInAuth());
  });

  it('lists the registered banks and payers', () => {
    // Given the household has registered banks and payers
    // When settings renders
    renderRegistry({
      banks: [
        { id: 'b1', name: 'Nubank' },
        { id: 'b2', name: 'Itaú' },
      ],
      payers: [
        { id: 'p1', name: 'Marcelo' },
        { id: 'p2', name: 'Guta' },
      ],
    });

    // Then both registries are listed
    expect(screen.getByText('Nubank')).toBeInTheDocument();
    expect(screen.getByText('Itaú')).toBeInTheDocument();
    expect(screen.getByText('Marcelo')).toBeInTheDocument();
    expect(screen.getByText('Guta')).toBeInTheDocument();
  });

  it('adds a bank and writes the banks tab back', async () => {
    // Given no banks are registered
    renderRegistry();
    const user = userEvent.setup();

    // When the user adds a bank by name
    await user.type(screen.getByLabelText('Nome do banco'), 'Nubank');
    await user.click(screen.getByRole('button', { name: 'Adicionar banco' }));

    // Then the bank is listed and persisted to the banks tab
    expect(screen.getByText('Nubank')).toBeInTheDocument();
    await waitFor(
      () =>
        expect(lastWrittenRecords(googleSheetsService, 'banks')).toEqual([
          expect.objectContaining({ id: expect.any(String), name: 'Nubank' }),
        ]),
      { timeout: 2500 }
    );
  });

  it('adds a payer and writes the payers tab back', async () => {
    // Given no payers are registered
    renderRegistry();
    const user = userEvent.setup();

    // When the user adds a payer by name
    await user.type(screen.getByLabelText('Nome do responsável'), 'Marcelo');
    await user.click(screen.getByRole('button', { name: 'Adicionar responsável' }));

    // Then the payer is listed and persisted to the payers tab
    expect(screen.getByText('Marcelo')).toBeInTheDocument();
    await waitFor(
      () =>
        expect(lastWrittenRecords(googleSheetsService, 'payers')).toEqual([
          expect.objectContaining({ id: expect.any(String), name: 'Marcelo' }),
        ]),
      { timeout: 2500 }
    );
  });

  it('renames a bank and writes the banks tab back', async () => {
    // Given one registered bank
    renderRegistry({ banks: [{ id: 'b1', name: 'Itaú' }] });
    const user = userEvent.setup();

    // When the user renames it
    await user.click(screen.getByRole('button', { name: 'Renomear Itaú' }));
    const input = screen.getByLabelText('Novo nome do banco');
    await user.clear(input);
    await user.type(input, 'Itaú Pessoas');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then the new name is shown and persisted under the same id
    expect(screen.getByText('Itaú Pessoas')).toBeInTheDocument();
    await waitFor(
      () =>
        expect(lastWrittenRecords(googleSheetsService, 'banks')).toEqual([
          expect.objectContaining({ id: 'b1', name: 'Itaú Pessoas' }),
        ]),
      { timeout: 2500 }
    );
  });

  it('removes a payer and writes the payers tab back', async () => {
    // Given two registered payers
    renderRegistry({
      payers: [
        { id: 'p1', name: 'Marcelo' },
        { id: 'p2', name: 'Guta' },
      ],
    });
    const user = userEvent.setup();

    // When the user removes one
    await user.click(screen.getByRole('button', { name: 'Remover Guta' }));

    // Then it is gone from the registry and the payers tab reflects it
    expect(screen.queryByText('Guta')).not.toBeInTheDocument();
    await waitFor(
      () =>
        expect(writtenChanges(googleSheetsService, 'payers')).toContainEqual({
          type: 'delete',
          id: 'p2',
        }),
      { timeout: 2500 }
    );
  });
});
