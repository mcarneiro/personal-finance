import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../config/i18n';
import i18n from '../../config/i18n';
import { googleSheetsService } from '../../services/GoogleSheetsService';
import banksReducer from '../../store/banksSlice';
import billsReducer from '../../store/billsSlice';
import incomeReducer from '../../store/incomeSlice';
import { syncListenerMiddleware } from '../../store/middleware/syncListener';
import payersReducer from '../../store/payersSlice';
import settingsReducer from '../../store/settingsSlice';
import type { Bank, Bill, IncomeEntry, Payer } from '../../types';
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

const PAYERS: Payer[] = [
  { id: 'payer-marcelo', name: 'Marcelo' },
  { id: 'payer-guta', name: 'Guta' },
];
const BANKS: Bank[] = [
  { id: 'bank-itau', name: 'Itaú' },
  { id: 'bank-nubank', name: 'Nubank' },
];

function bill(
  overrides: Partial<Bill> & Pick<Bill, 'month' | 'name' | 'amount'>
): Bill {
  return {
    id: `${overrides.month}-${overrides.name}`,
    isPaid: false,
    payerId: 'payer-marcelo',
    bankId: 'bank-nubank',
    ...overrides,
  };
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
  income: IncomeEntry[] = [],
  payers: Payer[] = PAYERS,
  banks: Bank[] = BANKS
) {
  const store = configureStore({
    reducer: {
      bills: billsReducer,
      income: incomeReducer,
      payers: payersReducer,
      banks: banksReducer,
      settings: settingsReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(syncListenerMiddleware.middleware),
    preloadedState: {
      bills: { items: bills },
      income: { items: income },
      payers: { items: payers },
      banks: { items: banks },
      settings: { sheetId: 'sheet-1' },
    },
  });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/bills/:month" element={<BillsScreen />} />
          <Route path="/bills/edit/:id" element={<p>Editor da conta</p>} />
          <Route path="/bills/new/:month" element={<p>Nova conta</p>} />
          <Route path="/settings" element={<p>Ajustes</p>} />
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

/** The by-payer spending summary region. */
const byPayer = () => within(screen.getByRole('region', { name: 'Gastos por responsável' }));

/** One payer's group inside the by-payer summary, addressed by its name. */
const payerGroup = (name: string) =>
  within(byPayer().getByText(name).closest('li') as HTMLElement);

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

  it('shows the payer and bank each bill was assigned', () => {
    // Given June has a bill paid by Guta from Itaú
    renderBills(`/bills/${JUNE}`, [
      bill({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
    ]);

    // When the screen renders
    // Then the row reads who pays it and from which bank
    expect(screen.getByText('Guta · Itaú')).toBeInTheDocument();
  });

  it('shows a fallback label for a bill whose payer or bank is unset', () => {
    // Given a legacy June bill with no payer or bank recorded
    renderBills(`/bills/${JUNE}`, [
      bill({ month: JUNE, name: 'Luz', amount: 150, payerId: '', bankId: '' }),
    ]);

    // When the screen renders
    // Then it is labelled rather than blank
    expect(screen.getByText('Sem responsável · Sem banco')).toBeInTheDocument();
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

  it('groups the month spending by payer and then by bank', () => {
    // Given June's bills split across two payers and two banks
    renderBills(`/bills/${JUNE}`, [
      bill({ month: JUNE, name: 'Luz', amount: 150 }),
      bill({ month: JUNE, name: 'Internet', amount: 110 }),
      bill({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
      bill({ month: JUNE, name: 'Gym', amount: 200, payerId: 'payer-guta', bankId: 'bank-nubank' }),
    ]);

    // When I look at the by-payer summary
    // Then Marcelo carries 260 on Nubank, and Guta carries 3.099 split across Itaú and Nubank
    expect(payerGroup('Marcelo').getAllByText(/260,00/)).toHaveLength(2); // group total + bank line
    expect(payerGroup('Marcelo').getByText('Nubank')).toBeInTheDocument();
    expect(payerGroup('Guta').getByText(/3\.099,00/)).toBeInTheDocument();
    expect(payerGroup('Guta').getByText(/2\.899,00/)).toBeInTheDocument();
    expect(payerGroup('Guta').getByText(/200,00/)).toBeInTheDocument();
  });

  it('still counts a bill whose payer and bank were removed from the registries', () => {
    // Given a June bill referencing a payer and bank no longer registered
    renderBills(`/bills/${JUNE}`, [
      bill({ month: JUNE, name: 'Luz', amount: 150, payerId: 'payer-gone', bankId: 'bank-gone' }),
    ]);

    // When I look at the by-payer summary
    // Then the amount survives under removal fallbacks — removing a registry
    // entry never loses money
    expect(byPayer().getByText('Responsável removido')).toBeInTheDocument();
    expect(byPayer().getByText('Banco removido')).toBeInTheDocument();
    expect(payerGroup('Responsável removido').getAllByText(/150,00/)).toHaveLength(2);
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

  it('opens the full-screen editor when a row is tapped', async () => {
    // Given June has a bill
    renderBills(`/bills/${JUNE}`, [bill({ month: JUNE, name: 'Luz', amount: 150 })]);
    const user = userEvent.setup();

    // When I tap the bill's row
    await user.click(screen.getByRole('button', { name: 'Editar Luz' }));

    // Then the full-screen editor for that bill is shown
    expect(screen.getByText('Editor da conta')).toBeInTheDocument();
  });

  it('no longer offers inline add or remove affordances', () => {
    // Given June has a bill
    renderBills(`/bills/${JUNE}`, [bill({ month: JUNE, name: 'Luz', amount: 150 })]);

    // When the list renders
    // Then adding and removing happen on the editor page, not inline
    expect(screen.queryByLabelText('Nome da conta')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Remover Luz' })
    ).not.toBeInTheDocument();
  });

  it('highlights the registry guidance and shortcuts to Settings when there are no payers or banks', async () => {
    // Given no payers and no banks are registered
    renderBills(`/bills/${JUNE}`, [], [], [], []);
    const user = userEvent.setup();

    // When the screen renders
    // Then the guidance sits in a highlighted callout instead of an unusable add flow
    expect(
      screen.getByText('Cadastre ao menos um responsável e um banco em Ajustes para adicionar contas.')
    ).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveClass('bg-amber-50');
    expect(screen.queryByRole('button', { name: 'Adicionar conta' })).not.toBeInTheDocument();

    // When I tap the callout's shortcut
    await user.click(screen.getByRole('button', { name: 'Ir para Ajustes' }));

    // Then the Settings page opens
    expect(screen.getByText('Ajustes')).toBeInTheDocument();
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
    expect(byPayer().getByText('Adicione contas para ver o resumo por responsável.')).toBeInTheDocument();
  });
});

describe('Replicate last month', () => {
  it("copies last month's bills into an empty month, unpaid, and persists them", async () => {
    // Given May has an open bill and a paid one, and June is still empty
    renderBills(`/bills/${JUNE}`, [
      bill({ month: MAY, name: 'Luz', amount: 150 }),
      bill({
        month: MAY,
        name: 'Cartão guta',
        amount: 2899,
        isPaid: true,
        payerId: 'payer-guta',
        bankId: 'bank-itau',
      }),
    ]);
    const user = userEvent.setup();

    // When I tap replicate
    await user.click(screen.getByRole('button', { name: 'Replicar contas do mês anterior' }));

    // Then June shows copies of both and the total
    expect(screen.getByText('Luz')).toBeInTheDocument();
    expect(screen.getByText('Cartão guta')).toBeInTheDocument();
    expect(screen.getByText('Guta · Itaú')).toBeInTheDocument();
    expect(summaryRow('Total das contas').getByText(/3\.049,00/)).toBeInTheDocument();

    // And last month's paid status never leaks: every copy arrives open
    expect(screen.getAllByText('Em aberto')).toHaveLength(2);
    expect(screen.queryByText('Pago')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Marcar como paga: Cartão guta' })).not.toBeChecked();

    // And the bills tab is written back with June's copies and their references
    await expectBillsWritten((written) => {
      const juneBills = written.filter((entry) => entry.month === JUNE);
      return (
        juneBills.map((entry) => entry.name).sort().join(',') === 'Cartão guta,Luz' &&
        juneBills.every((entry) => !entry.isPaid) &&
        juneBills.some((entry) => entry.payerId === 'payer-guta' && entry.bankId === 'bank-itau')
      );
    });
  });

  it('hides the replicate button when last month has no bills', () => {
    // Given May had no bills at all
    // When June renders
    renderBills(`/bills/${JUNE}`);

    // Then there is nothing to replicate
    expect(
      screen.queryByRole('button', { name: 'Replicar contas do mês anterior' })
    ).not.toBeInTheDocument();
  });

  it('hides the replicate button once the month already has bills, so it can never duplicate', () => {
    // Given June already has a bill and May has one too
    renderBills(`/bills/${JUNE}`, [
      bill({ month: MAY, name: 'Luz', amount: 150 }),
      bill({ month: JUNE, name: 'Internet', amount: 110 }),
    ]);

    // When June renders
    // Then there is no replicate affordance that could duplicate the list
    expect(
      screen.queryByRole('button', { name: 'Replicar contas do mês anterior' })
    ).not.toBeInTheDocument();
  });

  it('replicates from the currently browsed month, not the calendar month', async () => {
    // Given the current month has a bill and the next month is empty
    renderBills(`/bills/${CURRENT}`, [bill({ month: CURRENT, name: 'Luz', amount: 150 })]);
    const user = userEvent.setup();

    // When I move to the next month and tap replicate
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Replicar contas do mês anterior' }));

    // Then the copy lands in the month I am browsing
    expect(screen.getByText('Luz')).toBeInTheDocument();
    await expectBillsWritten((written) =>
      written.some(
        (entry) => entry.month === NEXT && entry.name === 'Luz' && entry.amount === 150 && !entry.isPaid
      )
    );
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

});
