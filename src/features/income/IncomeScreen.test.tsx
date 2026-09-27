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
 * verified all the way to the write-back call (Seam B).
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

  it('adds an entry with an amount and a source note, persisting to the income tab', async () => {
    // Given June has no income yet
    renderIncome(`/income/${JUNE}`);
    const user = userEvent.setup();

    // When I add the salary with its source note
    await user.type(screen.getByLabelText('Valor da renda'), '12000');
    await user.type(screen.getByLabelText('Fonte (opcional)'), 'Salário');
    await user.click(screen.getByRole('button', { name: 'Adicionar renda' }));

    // Then it is listed and the total reflects it
    expect(screen.getByText('Salário')).toBeInTheDocument();
    expect(summary().getByText(/12\.000,00/)).toBeInTheDocument();

    // And the income tab is written back with the new entry
    await waitFor(
      () =>
        expect(googleSheetsService.writeIncome).toHaveBeenCalledWith('sheet-1', [
          expect.objectContaining({ month: JUNE, amount: 12000, source: 'Salário' }),
        ]),
      { timeout: 2500 }
    );
  });

  it('adds an entry with only an amount, leaving the source note undefined', async () => {
    // Given June has no income yet
    renderIncome(`/income/${JUNE}`);
    const user = userEvent.setup();

    // When I add an amount without a source note
    await user.type(screen.getByLabelText('Valor da renda'), '800');
    await user.click(screen.getByRole('button', { name: 'Adicionar renda' }));

    // Then the entry is recorded without a source
    await waitFor(() => {
      const calls = vi.mocked(googleSheetsService.writeIncome).mock.calls;
      const written = calls[calls.length - 1]?.[1] ?? [];
      expect(written).toHaveLength(1);
      expect(written[0]).toMatchObject({ month: JUNE, amount: 800 });
      expect(written[0].source).toBeUndefined();
    }, { timeout: 2500 });
  });

  it('does not add an entry without a valid amount', async () => {
    // Given June has no income yet
    renderIncome(`/income/${JUNE}`);
    const user = userEvent.setup();
    const addButton = screen.getByRole('button', { name: 'Adicionar renda' });

    // When the amount is missing or unparseable
    expect(addButton).toBeDisabled();
    await user.type(screen.getByLabelText('Fonte (opcional)'), 'Freela');
    expect(addButton).toBeDisabled();
    await user.type(screen.getByLabelText('Valor da renda'), 'abc');
    expect(addButton).toBeDisabled();

    // And only becomes submittable once the amount parses
    await user.clear(screen.getByLabelText('Valor da renda'));
    await user.type(screen.getByLabelText('Valor da renda'), '500');
    expect(addButton).toBeEnabled();
  });

  it('edits an entry and writes the income tab back', async () => {
    // Given June has a salary of 12.000
    renderIncome(`/income/${JUNE}`, [
      incomeEntry({ month: JUNE, amount: 12000, source: 'Salário' }),
    ]);
    const user = userEvent.setup();

    // When I edit its amount and note
    await user.click(screen.getByRole('button', { name: 'Editar Salário' }));
    const amountInput = screen.getByLabelText('Valor da entrada');
    await user.clear(amountInput);
    await user.type(amountInput, '12500');
    const sourceInput = screen.getByLabelText('Fonte');
    await user.clear(sourceInput);
    await user.type(sourceInput, 'Salário líquido');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then the updated entry is shown
    expect(screen.getByText('Salário líquido')).toBeInTheDocument();
    expect(screen.queryByText('Salário')).not.toBeInTheDocument();

    // And the income tab carries the edit
    await waitFor(
      () =>
        expect(googleSheetsService.writeIncome).toHaveBeenCalledWith('sheet-1', [
          expect.objectContaining({ amount: 12500, source: 'Salário líquido' }),
        ]),
      { timeout: 2500 }
    );
  });

  it('removes an entry and writes the income tab back', async () => {
    // Given June has a salary and an extra
    renderIncome(`/income/${JUNE}`, [
      incomeEntry({ month: JUNE, amount: 12000, source: 'Salário' }),
      incomeEntry({ month: JUNE, amount: 500, source: 'Freela' }),
    ]);
    const user = userEvent.setup();

    // When I remove the extra
    await user.click(screen.getByRole('button', { name: 'Remover Freela' }));

    // Then it is gone from the list and the total drops
    expect(screen.queryByText('Freela')).not.toBeInTheDocument();
    expect(screen.getByText('Salário')).toBeInTheDocument();
    expect(summary().getByText(/12\.000,00/)).toBeInTheDocument();

    // And the income tab is written back without it
    await waitFor(
      () =>
        expect(googleSheetsService.writeIncome).toHaveBeenCalledWith('sheet-1', [
          expect.objectContaining({ source: 'Salário' }),
        ]),
      { timeout: 2500 }
    );
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
