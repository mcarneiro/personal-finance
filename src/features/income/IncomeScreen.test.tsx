import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../config/i18n';
import i18n from '../../config/i18n';
import { googleSheetsService } from '../../services/GoogleSheetsService';
import incomeReducer from '../../store/incomeSlice';
import { syncListenerMiddleware } from '../../store/middleware/syncListener';
import settingsReducer from '../../store/settingsSlice';
import type { IncomeEntry } from '../../types';
import { getCurrentMonth, shiftMonth } from '../../utils/month';
import IncomeScreen from './IncomeScreen';

vi.mock('../../services/GoogleSheetsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/GoogleSheetsService')>();
  return {
    ...actual,
    googleSheetsService: {
      ...actual.googleSheetsService,
      writeIncome: vi.fn(),
    },
  };
});

const JUNE = '2026-06';
const MAY = '2026-05';
const JULY = '2026-07';

// Months are relative to the real "now" so month-navigation tests stay
// deterministic whenever the suite runs.
const CURRENT = getCurrentMonth();
const NEXT = shiftMonth(CURRENT, 1);

function incomeEntry(
  overrides: Partial<IncomeEntry> & Pick<IncomeEntry, 'month' | 'amount'>
): IncomeEntry {
  return { id: `${overrides.month}-${overrides.source ?? overrides.amount}`, ...overrides };
}

/**
 * Renders the Income screen with a real store and the real debounced sync
 * middleware: only the sheets service boundary is mocked, so every mutation is
 * verified all the way to the write-back call (Seam B). The editor routes are
 * stubs so a row tap's navigation is observable.
 */
function renderIncome(initialPath = `/income/${JUNE}`, items: IncomeEntry[] = []) {
  const store = configureStore({
    reducer: {
      income: incomeReducer,
      settings: settingsReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(syncListenerMiddleware.middleware),
    preloadedState: {
      income: { items },
      settings: { sheetId: 'sheet-1' },
    },
  });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/income/:month" element={<IncomeScreen />} />
          <Route path="/income/edit/:id" element={<p>Editor da renda</p>} />
          <Route path="/income/new/:month" element={<p>Nova renda</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

  return store;
}

const summary = () => within(screen.getByRole('region', { name: 'Resumo da renda' }));

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('pt-BR');
});

describe('Income entries', () => {
  it("lists the month's entries with amounts and source notes", () => {
    // Given June has a salary and an extra, the extra without a note
    renderIncome(`/income/${JUNE}`, [
      incomeEntry({ month: JUNE, amount: 12000, source: 'Salário' }),
      incomeEntry({ month: JUNE, amount: 500, source: 'Freela' }),
      incomeEntry({ month: JUNE, amount: 250 }),
    ]);

    // When the screen renders
    // Then each entry's amount and note is shown, and the unlabeled one says so
    expect(screen.getByText('Salário')).toBeInTheDocument();
    expect(screen.getByText('Freela')).toBeInTheDocument();
    expect(screen.getByText(/12\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/500,00/)).toBeInTheDocument();
    expect(screen.getByText('Sem fonte')).toBeInTheDocument();
  });

  it('shows the month total, summing only that month', () => {
    // Given June holds 12.750 and May holds another 9.000
    renderIncome(`/income/${JUNE}`, [
      incomeEntry({ month: JUNE, amount: 12000, source: 'Salário' }),
      incomeEntry({ month: JUNE, amount: 750, source: 'Freela' }),
      incomeEntry({ month: MAY, amount: 9000, source: 'Salário' }),
    ]);

    // When I look at the total
    // Then it is the sum of June's entries only
    expect(screen.getByText('Total da renda')).toBeInTheDocument();
    expect(summary().getByText(/12\.750,00/)).toBeInTheDocument();
    expect(summary().queryByText(/21\.750,00/)).not.toBeInTheDocument();
  });

  it('opens the full-screen editor when a row is tapped', async () => {
    // Given June has a salary with a source note
    renderIncome(`/income/${JUNE}`, [
      incomeEntry({ month: JUNE, amount: 12000, source: 'Salário' }),
    ]);
    const user = userEvent.setup();

    // When I tap the entry's row
    await user.click(screen.getByRole('button', { name: 'Editar Salário' }));

    // Then the full-screen editor for that entry is shown
    expect(screen.getByText('Editor da renda')).toBeInTheDocument();
  });

  it('no longer offers inline add or remove affordances', () => {
    // Given June has a salary
    renderIncome(`/income/${JUNE}`, [
      incomeEntry({ month: JUNE, amount: 12000, source: 'Salário' }),
    ]);

    // When the list renders
    // Then adding and removing happen on the editor page, not inline
    expect(screen.queryByLabelText('Valor da renda')).not.toBeInTheDocument();
    expect(screen.queryByText('Adicionar renda')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover Salário' })).not.toBeInTheDocument();
  });

  it('is empty until entries are added, with a zero total', () => {
    // Given June has no income
    // When the screen renders
    renderIncome(`/income/${JULY}`);

    // Then the empty state and a zero total are shown
    expect(screen.getByText('As entradas de renda deste mês aparecerão aqui.')).toBeInTheDocument();
    expect(summary().getByText(/0,00/)).toBeInTheDocument();
  });
});

describe('Replicate last month', () => {
  it("copies last month's entries into an empty month and persists them", async () => {
    // Given May has a salary and an extra, and June is still empty
    renderIncome(`/income/${JUNE}`, [
      incomeEntry({ month: MAY, amount: 12000, source: 'Salário' }),
      incomeEntry({ month: MAY, amount: 500, source: 'Freela' }),
    ]);
    const user = userEvent.setup();

    // When I tap replicate
    await user.click(screen.getByRole('button', { name: 'Replicar renda do mês anterior' }));

    // Then June shows copies of both entries and the total
    expect(screen.getByText('Salário')).toBeInTheDocument();
    expect(screen.getByText('Freela')).toBeInTheDocument();
    expect(summary().getByText(/12\.500,00/)).toBeInTheDocument();

    // And the income tab is written back with June's copies
    await waitFor(() => {
      const calls = vi.mocked(googleSheetsService.writeIncome).mock.calls;
      const written = calls[calls.length - 1]?.[1] ?? [];
      const juneEntries = written.filter((entry) => entry.month === JUNE);
      expect(juneEntries.map((entry) => entry.source).sort()).toEqual(['Freela', 'Salário']);
      expect(juneEntries.every((entry) => entry.amount > 0)).toBe(true);
    }, { timeout: 2500 });
  });

  it('hides the replicate button when last month has no income', () => {
    // Given May had no income at all
    // When June renders
    renderIncome(`/income/${JUNE}`);

    // Then there is nothing to replicate
    expect(
      screen.queryByRole('button', { name: 'Replicar renda do mês anterior' })
    ).not.toBeInTheDocument();
  });

  it('hides the replicate button once the month already has entries, so it can never duplicate', () => {
    // Given June already has an entry and May has one too
    renderIncome(`/income/${JUNE}`, [
      incomeEntry({ month: MAY, amount: 12000, source: 'Salário' }),
      incomeEntry({ month: JUNE, amount: 500, source: 'Freela' }),
    ]);

    // When June renders
    // Then there is no replicate affordance that could duplicate the list
    expect(
      screen.queryByRole('button', { name: 'Replicar renda do mês anterior' })
    ).not.toBeInTheDocument();
  });
});

describe('Month navigation', () => {
  it("shows each month's own entries when navigating months", async () => {
    // Given June has a salary and July is still empty
    renderIncome(`/income/${JUNE}`, [
      incomeEntry({ month: JUNE, amount: 12000, source: 'Salário' }),
    ]);
    const user = userEvent.setup();
    expect(screen.getByText('Salário')).toBeInTheDocument();

    // When I go to the next month
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));

    // Then July shows its own (empty) income
    expect(screen.getByRole('heading', { name: 'julho de 2026' })).toBeInTheDocument();
    expect(screen.queryByText('Salário')).not.toBeInTheDocument();
  });

  it('replicates from the currently browsed month, not the calendar month', async () => {
    // Given the current month has a salary and the next month is empty
    renderIncome(`/income/${CURRENT}`, [
      incomeEntry({ month: CURRENT, amount: 12000, source: 'Salário' }),
    ]);
    const user = userEvent.setup();

    // When I move to the next month and tap replicate
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(screen.queryByText('Salário')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Replicar renda do mês anterior' }));

    // Then the copy lands in the month I am browsing
    expect(screen.getByText('Salário')).toBeInTheDocument();
    await waitFor(() => {
      const calls = vi.mocked(googleSheetsService.writeIncome).mock.calls;
      const written = calls[calls.length - 1]?.[1] ?? [];
      const copies = written.filter((entry) => entry.month === NEXT);
      expect(copies).toHaveLength(1);
      expect(copies[0]).toMatchObject({ amount: 12000, source: 'Salário' });
    }, { timeout: 2500 });
  });
});
