import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../config/i18n';
import i18n from '../../config/i18n';
import { googleSheetsService } from '../../services/GoogleSheetsService';
import billsReducer from '../../store/billsSlice';
import incomeReducer from '../../store/incomeSlice';
import { syncListenerMiddleware } from '../../store/middleware/syncListener';
import settingsReducer from '../../store/settingsSlice';
import type { Bill, IncomeEntry } from '../../types';
import { getCurrentMonth, shiftMonth } from '../../utils/month';
import BillsScreen from './BillsScreen';

vi.mock('../../services/GoogleSheetsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/GoogleSheetsService')>();
  return {
    ...actual,
    googleSheetsService: {
      ...actual.googleSheetsService,
      writeBills: vi.fn(),
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

function bill(
  overrides: Partial<Bill> & Pick<Bill, 'month' | 'name' | 'amount'>
): Bill {
  return { id: `${overrides.month}-${overrides.name}`, isPaid: false, ...overrides };
}

function incomeEntry(month: string, amount: number, source?: string): IncomeEntry {
  return { id: `${month}-${source ?? amount}`, month, amount, source };
}

/**
 * Renders the Bills screen with a real store and the real debounced sync
 * middleware: only the sheets service boundary is mocked, so every mutation is
 * verified all the way to the write-back call (Seam B).
 */
function renderBills(
  initialPath = `/bills/${JUNE}`,
  bills: Bill[] = [],
  income: IncomeEntry[] = []
) {
  const store = configureStore({
    reducer: {
      bills: billsReducer,
      income: incomeReducer,
      settings: settingsReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(syncListenerMiddleware.middleware),
    preloadedState: {
      bills: { items: bills },
      income: { items: income },
      settings: { sheetId: 'sheet-1' },
    },
  });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/bills/:month" element={<BillsScreen />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

  return store;
}

const summary = () => within(screen.getByRole('region', { name: 'Resumo do mês' }));

/** The value cell of one summary line, addressed by its label. */
const summaryRow = (label: string) =>
  within(screen.getByText(label).parentElement as HTMLElement);

/** Wait out the debounced sync and assert some bills write-back satisfies `matches`. */
async function expectBillsWritten(matches: (written: Bill[]) => boolean) {
  await waitFor(() => {
    const snapshots = vi
      .mocked(googleSheetsService.writeBills)
      .mock.calls.map(([, written]) => written);
    expect(snapshots.some(matches)).toBe(true);
  }, { timeout: 2500 });
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('pt-BR');
});

describe('Bills', () => {
  it("lists the month's bills with amounts and open/paid status", () => {
    // Given June has an open bill and a paid one
    renderBills(`/bills/${JUNE}`, [
      bill({ month: JUNE, name: 'Luz', amount: 150 }),
      bill({ month: JUNE, name: 'Internet', amount: 110, isPaid: true }),
    ]);

    // When the screen renders
    // Then both bills and their status are visible
    expect(screen.getByText('Luz')).toBeInTheDocument();
    expect(screen.getByText('Internet')).toBeInTheDocument();
    expect(screen.getByText(/150,00/)).toBeInTheDocument();
    expect(screen.getByText(/110,00/)).toBeInTheDocument();
    expect(screen.getByText('Em aberto')).toBeInTheDocument();
    expect(screen.getByText('Pago')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Marcar como paga: Luz' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Marcar como em aberto: Internet' })).toBeChecked();
  });

  it('shows the bills total, income total and account net for the month', () => {
    // Given June has 150 + 2.899 in bills and 12.000 of income
    renderBills(
      `/bills/${JUNE}`,
      [bill({ month: JUNE, name: 'Luz', amount: 150 }), bill({ month: JUNE, name: 'Cartão guta', amount: 2899 })],
      [incomeEntry(JUNE, 12000, 'Salário')]
    );

    // When I look at the month summary
    // Then Account Net is income − bills = 8.951, and each total is its own sum
    expect(screen.getByText('Total das contas')).toBeInTheDocument();
    expect(screen.getByText('Total da renda')).toBeInTheDocument();
    expect(screen.getByText('Saldo da conta')).toBeInTheDocument();
    expect(summaryRow('Total das contas').getByText(/3\.049,00/)).toBeInTheDocument();
    expect(summaryRow('Total da renda').getByText(/12\.000,00/)).toBeInTheDocument();
    expect(summaryRow('Saldo da conta').getByText(/8\.951,00/)).toBeInTheDocument();
  });

  it('sums only the browsed month, ignoring other months', () => {
    // Given June holds 150 in bills and May holds another 900
    renderBills(`/bills/${JUNE}`, [
      bill({ month: JUNE, name: 'Luz', amount: 150 }),
      bill({ month: MAY, name: 'Água', amount: 900 }),
    ]);

    // When I look at June's summary
    // Then only June's bills are counted
    expect(summaryRow('Total das contas').getByText(/150,00/)).toBeInTheDocument();
    expect(summary().queryByText(/1\.050,00/)).not.toBeInTheDocument();
  });

  it('adds a bill with a name and amount, persisting to the bills tab', async () => {
    // Given June has no bills yet
    renderBills(`/bills/${JUNE}`);
    const user = userEvent.setup();

    // When I add a bill
    await user.type(screen.getByLabelText('Nome da conta'), 'Luz');
    await user.type(screen.getByLabelText('Valor da conta'), '150');
    await user.click(screen.getByRole('button', { name: 'Adicionar conta' }));

    // Then it is listed, open by default, and counted in the total
    expect(screen.getByText('Luz')).toBeInTheDocument();
    expect(screen.getByText('Em aberto')).toBeInTheDocument();
    expect(summaryRow('Total das contas').getByText(/150,00/)).toBeInTheDocument();

    // And the bills tab is written back with the new bill
    await expectBillsWritten((written) =>
      written.some(
        (entry) => entry.month === JUNE && entry.name === 'Luz' && entry.amount === 150 && !entry.isPaid
      )
    );
  });

  it('enters the card bill as a regular bill with the real statement value', async () => {
    // Given June has no bills yet
    renderBills(`/bills/${JUNE}`);
    const user = userEvent.setup();

    // When I record the card bill exactly as the statement reads
    await user.type(screen.getByLabelText('Nome da conta'), 'Cartão guta');
    await user.type(screen.getByLabelText('Valor da conta'), '2899');
    await user.click(screen.getByRole('button', { name: 'Adicionar conta' }));

    // Then it is an ordinary bill — name, statement amount, paid toggle — with
    // no installment-specific anything
    expect(screen.getByText('Cartão guta')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Marcar como paga: Cartão guta' })).toBeInTheDocument();
    expect(summaryRow('Total das contas').getByText(/2\.899,00/)).toBeInTheDocument();
    await expectBillsWritten((written) =>
      written.some((entry) => entry.name === 'Cartão guta' && entry.amount === 2899)
    );
  });

  it('does not add a bill without a name or a valid amount', async () => {
    // Given June has no bills yet
    renderBills(`/bills/${JUNE}`);
    const user = userEvent.setup();
    const addButton = screen.getByRole('button', { name: 'Adicionar conta' });

    // When the name or amount is missing, or the amount is unparseable
    expect(addButton).toBeDisabled();
    await user.type(screen.getByLabelText('Valor da conta'), '150');
    expect(addButton).toBeDisabled();
    await user.type(screen.getByLabelText('Nome da conta'), 'Luz');
    expect(addButton).toBeEnabled();
    await user.clear(screen.getByLabelText('Valor da conta'));
    await user.type(screen.getByLabelText('Valor da conta'), 'abc');
    expect(addButton).toBeDisabled();
  });

  it('toggles a bill paid and writes the bills tab back', async () => {
    // Given June has an open bill
    renderBills(`/bills/${JUNE}`, [bill({ month: JUNE, name: 'Luz', amount: 150 })]);
    const user = userEvent.setup();

    // When I mark it paid
    await user.click(screen.getByRole('checkbox', { name: 'Marcar como paga: Luz' }));

    // Then it reads as paid
    expect(screen.getByRole('checkbox', { name: 'Marcar como em aberto: Luz' })).toBeChecked();
    expect(screen.getByText('Pago')).toBeInTheDocument();

    // And the bills tab carries the paid status
    await expectBillsWritten((written) =>
      written.some((entry) => entry.name === 'Luz' && entry.isPaid)
    );
  });

  it('edits a bill and writes the bills tab back', async () => {
    // Given June has a bill of 150
    renderBills(`/bills/${JUNE}`, [bill({ month: JUNE, name: 'Luz', amount: 150 })]);
    const user = userEvent.setup();

    // When I edit its name and amount
    await user.click(screen.getByRole('button', { name: 'Editar Luz' }));
    const nameInput = screen.getByLabelText('Nome');
    await user.clear(nameInput);
    await user.type(nameInput, 'Energia elétrica');
    const amountInput = screen.getByLabelText('Valor');
    await user.clear(amountInput);
    await user.type(amountInput, '175');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then the updated bill is shown
    expect(screen.getByText('Energia elétrica')).toBeInTheDocument();
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();
    expect(summaryRow('Total das contas').getByText(/175,00/)).toBeInTheDocument();

    // And the bills tab carries the edit
    await expectBillsWritten((written) =>
      written.some((entry) => entry.name === 'Energia elétrica' && entry.amount === 175)
    );
  });

  it('removes a bill and writes the bills tab back', async () => {
    // Given June has two bills
    renderBills(`/bills/${JUNE}`, [
      bill({ month: JUNE, name: 'Luz', amount: 150 }),
      bill({ month: JUNE, name: 'Internet', amount: 110 }),
    ]);
    const user = userEvent.setup();

    // When I remove one
    await user.click(screen.getByRole('button', { name: 'Remover Internet' }));

    // Then it is gone and the bills total drops
    expect(screen.queryByText('Internet')).not.toBeInTheDocument();
    expect(screen.getByText('Luz')).toBeInTheDocument();
    expect(summaryRow('Total das contas').getByText(/150,00/)).toBeInTheDocument();

    // And the bills tab is written back without it
    await expectBillsWritten(
      (written) =>
        written.some((entry) => entry.name === 'Luz') &&
        !written.some((entry) => entry.name === 'Internet')
    );
  });

  it('keeps the account net unchanged when a bill is marked paid', async () => {
    // Given June has 12.000 of income and a 2.899 card bill still open
    renderBills(
      `/bills/${JUNE}`,
      [bill({ month: JUNE, name: 'Cartão guta', amount: 2899 })],
      [incomeEntry(JUNE, 12000, 'Salário')]
    );
    const user = userEvent.setup();
    expect(summaryRow('Saldo da conta').getByText(/9\.101,00/)).toBeInTheDocument();

    // When I mark the card bill paid
    await user.click(screen.getByRole('checkbox', { name: 'Marcar como paga: Cartão guta' }));

    // Then the net is unchanged — the bill is an obligation either way
    expect(summaryRow('Saldo da conta').getByText(/9\.101,00/)).toBeInTheDocument();

    // And the toggle still reaches the sheet
    await expectBillsWritten((written) =>
      written.some((entry) => entry.name === 'Cartão guta' && entry.isPaid)
    );
  });

  it('is empty until bills are added, with zero totals', () => {
    // Given July has no bills and no income
    // When the screen renders
    renderBills(`/bills/${JULY}`);

    // Then the empty state and zero totals are shown
    expect(screen.getByText('As contas deste mês aparecerão aqui.')).toBeInTheDocument();
    expect(summary().getAllByText(/0,00/)).toHaveLength(3);
  });
});

describe('Month navigation', () => {
  it("shows each month's own bills when navigating months", async () => {
    // Given June has a bill and July is still empty
    renderBills(`/bills/${JUNE}`, [bill({ month: JUNE, name: 'Luz', amount: 150 })]);
    const user = userEvent.setup();
    expect(screen.getByText('Luz')).toBeInTheDocument();

    // When I go to the next month
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));

    // Then July shows its own (empty) bills
    expect(screen.getByRole('heading', { name: 'julho de 2026' })).toBeInTheDocument();
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();
    expect(summary().getAllByText(/0,00/)).toHaveLength(3);
  });

  it('adds a bill to the browsed month, not the calendar month', async () => {
    // Given the current month is empty and I navigate to the next one
    renderBills(`/bills/${CURRENT}`);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));

    // When I add a bill
    await user.type(screen.getByLabelText('Nome da conta'), 'Luz');
    await user.type(screen.getByLabelText('Valor da conta'), '150');
    await user.click(screen.getByRole('button', { name: 'Adicionar conta' }));

    // Then it lands in the month I am browsing
    await expectBillsWritten((written) =>
      written.some((entry) => entry.month === NEXT && entry.name === 'Luz' && entry.amount === 150)
    );
  });
});
