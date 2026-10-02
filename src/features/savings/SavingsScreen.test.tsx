import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../config/i18n';
import i18n from '../../config/i18n';
import { googleSheetsService } from '../../services/GoogleSheetsService';
import savingsReducer from '../../store/savingsSlice';
import { syncListenerMiddleware } from '../../store/middleware/syncListener';
import pendingReducer from '../../store/pendingSlice';
import settingsReducer from '../../store/settingsSlice';
import { writtenChanges, writtenRecords } from '../../test/pendingWrites';
import type { SavingsBalance, SavingsPot } from '../../types';
import SavingsScreen from './SavingsScreen';

vi.mock('../../services/GoogleSheetsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/GoogleSheetsService')>();
  return {
    ...actual,
    googleSheetsService: {
      ...actual.googleSheetsService,
      writePendingChanges: vi.fn(),
    },
  };
});

const JUNE = '2026-06';
const MAY = '2026-05';

const EMERGENCY: SavingsPot = { id: 'pot-emergency', name: 'Emergência' };
const RETIREMENT: SavingsPot = { id: 'pot-retirement', name: 'Aposentadoria' };

function balance(month: string, potId: string, amount: number): SavingsBalance {
  return { id: `${month}-${potId}`, month, potId, balance: amount };
}

/**
 * Renders the Savings screen with a real store and the real debounced sync
 * middleware: only the sheets service boundary is mocked, so a committed balance
 * is verified all the way to the write-back call.
 */
function renderSavings(
  initialPath = `/savings/${JUNE}`,
  pots: SavingsPot[] = [EMERGENCY],
  balances: SavingsBalance[] = []
) {
  const store = configureStore({
    reducer: {
      savings: savingsReducer,
      settings: settingsReducer,
      pending: pendingReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(syncListenerMiddleware.middleware),
    preloadedState: {
      savings: { items: pots, balances },
      settings: { sheetId: 'sheet-1' },
    },
  });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/savings/:month" element={<SavingsScreen />} />
          <Route path="/settings" element={<p>Ajustes</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

  return store;
}

const balanceField = (name = EMERGENCY.name) =>
  screen.getByLabelText(`Saldo da poupança ${name}`);

/** Wait out the debounced sync and assert the balances written satisfy `matches`. */
async function expectBalancesWritten(matches: (written: SavingsBalance[]) => boolean) {
  await waitFor(
    () => {
      expect(matches(writtenRecords(googleSheetsService, 'savings_balances'))).toBe(true);
    },
    { timeout: 2500 }
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(googleSheetsService.writePendingChanges).mockResolvedValue(undefined);
  await i18n.changeLanguage('pt-BR');
});

describe('Savings', () => {
  it('lists every active pot with an editable balance field', () => {
    // Given two pots are registered
    renderSavings(`/savings/${JUNE}`, [EMERGENCY, RETIREMENT]);

    // When the screen renders
    // Then each pot has its own balance field
    expect(balanceField('Emergência')).toBeInTheDocument();
    expect(balanceField('Aposentadoria')).toBeInTheDocument();
  });

  it('commits a typed balance as the browsed month’s record', async () => {
    // Given a pot with no recorded balance
    renderSavings(`/savings/${JUNE}`, [EMERGENCY]);
    const user = userEvent.setup();

    // When I type a balance
    await user.type(balanceField(), '1500');

    // Then the browsed month’s row is written with that value
    await expectBalancesWritten((written) =>
      written.some(
        (row) => row.month === JUNE && row.potId === EMERGENCY.id && row.balance === 1500
      )
    );
  });

  it('pre-fills a carried balance and marks the earlier month it came from', () => {
    // Given the pot was last recorded in May, and June has no record
    renderSavings(`/savings/${JUNE}`, [EMERGENCY], [balance(MAY, EMERGENCY.id, 1000)]);

    // When I browse June
    // Then the May balance is carried into the field, marked with its month
    expect(balanceField()).toHaveValue('1000');
    expect(screen.getByText('Atualizado em maio de 2026')).toBeInTheDocument();
  });

  it('does not mark an exact-month balance as carried', () => {
    // Given June has its own recorded balance
    renderSavings(`/savings/${JUNE}`, [EMERGENCY], [balance(JUNE, EMERGENCY.id, 2000)]);

    // When I browse June
    // Then the value is shown without a carry-forward marker
    expect(balanceField()).toHaveValue('2000');
    expect(screen.queryByText(/Atualizado em/)).not.toBeInTheDocument();
  });

  it('shows an empty field for a pot recorded in no month and never fabricates a value', async () => {
    // Given a pot with no record at all
    const store = renderSavings(`/savings/${JUNE}`, [EMERGENCY]);
    const user = userEvent.setup();

    // When I browse June and leave the field empty
    expect(balanceField()).toHaveValue('');
    await user.tab();

    // Then nothing is recorded for the pot
    expect(store.getState().savings.balances).toEqual([]);
    expect(writtenRecords(googleSheetsService, 'savings_balances')).toEqual([]);
  });

  it('records an explicit 0 as a real zero, distinct from an empty field', async () => {
    // Given a pot with no recorded balance
    const store = renderSavings(`/savings/${JUNE}`, [EMERGENCY]);
    const user = userEvent.setup();

    // When I type a zero
    await user.type(balanceField(), '0');

    // Then a real zero is stored, and shown as 0 rather than blank
    expect(balanceField()).toHaveValue('0');
    await expectBalancesWritten((written) =>
      written.some(
        (row) => row.month === JUNE && row.potId === EMERGENCY.id && row.balance === 0
      )
    );
    expect(store.getState().savings.balances).toEqual([
      { id: `${JUNE}-${EMERGENCY.id}`, month: JUNE, potId: EMERGENCY.id, balance: 0 },
    ]);
    expect(screen.queryByText(/Atualizado em/)).not.toBeInTheDocument();
  });

  it('clearing the field removes the browsed month’s record so carry-forward resumes', async () => {
    // Given May and June both have recorded balances
    renderSavings(
      `/savings/${JUNE}`,
      [EMERGENCY],
      [balance(MAY, EMERGENCY.id, 1000), balance(JUNE, EMERGENCY.id, 1500)]
    );
    const user = userEvent.setup();
    expect(balanceField()).toHaveValue('1500');

    // When I clear the field and leave it
    await user.clear(balanceField());
    await user.tab();

    // Then June's record is deleted
    await waitFor(
      () => {
        expect(writtenChanges(googleSheetsService, 'savings_balances')).toContainEqual({
          type: 'delete',
          id: `${JUNE}-${EMERGENCY.id}`,
        });
      },
      { timeout: 2500 }
    );

    // And the field falls back to the carried May value, marked as carried
    await waitFor(() => expect(balanceField()).toHaveValue('1000'));
    expect(screen.getByText('Atualizado em maio de 2026')).toBeInTheDocument();
  });

  it('renders a highlighted callout linking to Settings when no pot is registered', async () => {
    // Given no pots are registered
    renderSavings(`/savings/${JUNE}`, []);
    const user = userEvent.setup();

    // When the screen renders
    // Then the guidance sits in a highlighted callout instead of an unusable list
    expect(
      screen.getByText(
        'Cadastre ao menos uma poupança em Ajustes para registrar saldos.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveClass('bg-amber-50');

    // When I tap the callout's shortcut
    await user.click(screen.getByRole('button', { name: 'Ir para Ajustes' }));

    // Then the Settings page opens
    expect(screen.getByText('Ajustes')).toBeInTheDocument();
  });

  it('falls back to the current month when the month is malformed', () => {
    // Given the app is opened on a malformed month
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15));

    // When the savings screen renders
    renderSavings('/savings/not-a-month', [EMERGENCY]);

    // Then it redirects to the current month
    expect(screen.getByRole('heading', { name: 'junho de 2026' })).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe('Total Saved', () => {
  const summary = () => within(screen.getByRole('region', { name: 'Resumo das poupanças' }));

  it('sums the carried balances of the active pots', () => {
    // Given Emergency is recorded in June and Retirement only in May
    renderSavings(
      `/savings/${JUNE}`,
      [EMERGENCY, RETIREMENT],
      [
        balance(JUNE, EMERGENCY.id, 11000),
        balance(MAY, RETIREMENT.id, 40000),
      ]
    );

    // When I look at the headline
    // Then it is June's 11000 plus May's carried 40000
    expect(summary().getByText('Total guardado')).toBeInTheDocument();
    expect(summary().getByText(/51\.000,00/)).toBeInTheDocument();
  });

  it('falls back to the carried value in the total after the month’s balance is cleared', async () => {
    // Given May and June both have recorded balances
    renderSavings(
      `/savings/${JUNE}`,
      [EMERGENCY],
      [balance(MAY, EMERGENCY.id, 1000), balance(JUNE, EMERGENCY.id, 1500)]
    );
    const user = userEvent.setup();
    expect(summary().getByText(/1\.500,00/)).toBeInTheDocument();

    // When I clear June's field and leave it
    await user.clear(balanceField());
    await user.tab();

    // Then the total falls back to the carried May value
    await waitFor(() => expect(summary().getByText(/1\.000,00/)).toBeInTheDocument());
    expect(summary().queryByText(/1\.500,00/)).not.toBeInTheDocument();
  });

  it('counts nothing for a pot with no record and moves with a typed balance', async () => {
    // Given a pot with no recorded balance
    renderSavings(`/savings/${JUNE}`, [EMERGENCY]);
    const user = userEvent.setup();
    expect(summary().getByText(/0,00/)).toBeInTheDocument();

    // When I type a balance
    await user.type(balanceField(), '2000');

    // Then the total updates immediately
    await waitFor(() => expect(summary().getByText(/2\.000,00/)).toBeInTheDocument());
  });

  it('drops a retired pot’s carried balance from the total', async () => {
    // Given two pots with balances, and a store I can dispatch a retirement to
    const store = renderSavings(
      `/savings/${JUNE}`,
      [EMERGENCY, RETIREMENT],
      [
        balance(JUNE, EMERGENCY.id, 11000),
        balance(JUNE, RETIREMENT.id, 40000),
      ]
    );
    expect(summary().getByText(/51\.000,00/)).toBeInTheDocument();

    // When the Retirement pot is retired
    const { deleteSavingsPot } = await import('../../store/savingsSlice');
    store.dispatch(deleteSavingsPot(RETIREMENT.id));

    // Then the total drops by exactly its carried balance
    await waitFor(() => expect(summary().getByText(/11\.000,00/)).toBeInTheDocument());
  });

  it('states that savings do not affect income, outflows or account net', () => {
    // Given a registered pot
    renderSavings(`/savings/${JUNE}`, [EMERGENCY]);

    // Then the scope line is shown
    expect(
      screen.getByText('As poupanças não afetam a renda, as saídas nem o saldo da conta.')
    ).toBeInTheDocument();
  });

  it('shows no target, goal, progress bar or month-over-month delta', () => {
    // Given two pots with balances
    renderSavings(
      `/savings/${JUNE}`,
      [EMERGENCY, RETIREMENT],
      [balance(JUNE, EMERGENCY.id, 11000), balance(MAY, RETIREMENT.id, 40000)]
    );

    // Then the savings UI carries only the total and the check-in fields
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/meta/i)).not.toBeInTheDocument();
  });
});

describe('Savings screen chrome', () => {
  it('has no inline add or remove affordances', () => {
    // Given a registered pot
    renderSavings(`/savings/${JUNE}`, [EMERGENCY]);

    // When the list renders
    // Then pots are managed in Settings, not inline here
    expect(screen.queryByLabelText('Nome da poupança')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover Emergência' })).not.toBeInTheDocument();
    expect(screen.queryByText('Cadastre ao menos uma poupança em Ajustes para registrar saldos.'))
      .not.toBeInTheDocument();
  });

  it('is not inside a Settings-like page and shows the pot section', () => {
    // Given a pot is registered
    renderSavings(`/savings/${JUNE}`, [EMERGENCY]);

    // Then the pot list is its own labelled section
    const section = screen.getByRole('region', { name: 'Poupanças' });
    expect(within(section).getByText('Emergência')).toBeInTheDocument();
  });
});
