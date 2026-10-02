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
import pendingReducer from '../../store/pendingSlice';
import payersReducer from '../../store/payersSlice';
import settingsReducer from '../../store/settingsSlice';
import { writtenRecords } from '../../test/pendingWrites';
import type { Bank, Bill, IncomeEntry, Payer } from '../../types';
import { getCurrentMonth, shiftMonth } from '../../utils/month';
import BillsScreen from './BillsScreen';

vi.mock('../../services/GoogleSheetsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/GoogleSheetsService')>();
  return {
    ...actual,
    googleSheetsService: {
      ...actual.googleSheetsService,
      writePendingChanges: vi.fn(),
      readBills: vi.fn(),
      readPlanItems: vi.fn(),
      readIncome: vi.fn(),
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
    isFinal: true,
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
      pending: pendingReducer,
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

/** The expand/collapse toggle for the by-payer spending summary. */
const summaryToggle = () =>
  screen.getByRole('button', { name: 'Gastos por responsável' });

/** One payer's group inside the by-payer summary, addressed by its name. */
const payerGroup = (name: string) =>
  within(byPayer().getByText(name).closest('li') as HTMLElement);

/** The small icon that opens the filter drawer. */
const filterButton = () => screen.getByRole('button', { name: 'Filtrar contas' });

/** The filter drawer, addressed once it is open. */
const filterDrawer = () =>
  within(screen.getByRole('dialog', { name: 'Filtrar contas' }));

/** Open the drawer, tick the named boxes, and apply. */
async function applyFilter(
  user: ReturnType<typeof userEvent.setup>,
  ...names: string[]
) {
  await user.click(filterButton());
  for (const name of names) {
    await user.click(filterDrawer().getByRole('checkbox', { name }));
  }
  await user.click(filterDrawer().getByRole('button', { name: 'Aplicar filtros' }));
}

/** Whether `first` appears before `second` in document order. */
const appearsBefore = (first: HTMLElement, second: HTMLElement) =>
  Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

/** Wait out the debounced sync and assert the bills written satisfy `matches`. */
async function expectBillsWritten(matches: (written: Bill[]) => boolean) {
  await waitFor(() => {
    const written = writtenRecords(googleSheetsService, 'bills');
    expect(matches(written)).toBe(true);
  }, { timeout: 2500 });
}

beforeEach(async () => {
  vi.clearAllMocks();
  // The copy guard's re-read defaults to an empty sheet; the guard tests below
  // return rows to simulate another member's copy having landed.
  vi.mocked(googleSheetsService.readBills).mockResolvedValue([]);
  // `clearAllMocks` strips the implementation, so every test re-arms the write
  // boundary as a resolved stub; `writtenRecords` reads its call payloads.
  vi.mocked(googleSheetsService.writePendingChanges).mockResolvedValue(undefined);
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

  it('lists open bills before paid ones, alphabetically within each group', () => {
    // Given June has open and paid bills listed out of order
    renderBills(`/bills/${JUNE}`, [
      bill({ month: JUNE, name: 'Luz', amount: 150 }),
      bill({ month: JUNE, name: 'Internet', amount: 110, isPaid: true }),
      bill({ month: JUNE, name: 'Água', amount: 90 }),
      bill({ month: JUNE, name: 'Gym', amount: 50, isPaid: true }),
    ]);

    // When the list renders
    // Then the open bills lead in alphabetical order, then the paid ones
    const rows = screen
      .getAllByRole('checkbox')
      .map((box) => box.getAttribute('aria-label'));
    expect(rows).toEqual([
      'Marcar como paga: Água',
      'Marcar como paga: Luz',
      'Marcar como em aberto: Gym',
      'Marcar como em aberto: Internet',
    ]);
  });

  it('flags a bill whose value is not final with a warning before its name', () => {
    // Given one confirmed bill and one still awaiting its final value
    renderBills(`/bills/${JUNE}`, [
      bill({ month: JUNE, name: 'Luz', amount: 150, isFinal: true }),
      bill({ month: JUNE, name: 'Internet', amount: 110, isFinal: false }),
    ]);

    // When the list renders
    const unconfirmedRow = screen.getByText('Internet').closest('li') as HTMLElement;
    const confirmedRow = screen.getByText('Luz').closest('li') as HTMLElement;

    // Then only the unconfirmed bill carries the warning
    expect(within(unconfirmedRow).getByText('⚠️')).toBeInTheDocument();
    expect(within(confirmedRow).queryByText('⚠️')).not.toBeInTheDocument();
  });

  it('sinks bills still awaiting a final value below the confirmed ones', () => {
    // Given a confirmed paid bill and two unconfirmed open bills
    renderBills(`/bills/${JUNE}`, [
      bill({ month: JUNE, name: 'Água', amount: 90, isFinal: false }),
      bill({ month: JUNE, name: 'Internet', amount: 110, isPaid: true, isFinal: true }),
      bill({ month: JUNE, name: 'Luz', amount: 150, isFinal: false }),
    ]);

    // When the list renders
    const rows = screen
      .getAllByRole('checkbox')
      .map((box) => box.getAttribute('aria-label'));

    // Then the confirmed bill leads and the unconfirmed ones follow, alphabetical
    expect(rows).toEqual([
      'Marcar como em aberto: Internet',
      'Marcar como paga: Água',
      'Marcar como paga: Luz',
    ]);
  });

  it('shows the by-payer summary below the totals and above the bills list', () => {
    // Given June has a bill
    renderBills(`/bills/${JUNE}`, [bill({ month: JUNE, name: 'Luz', amount: 150 })]);

    // When the screen renders
    const summaryRegion = screen.getByRole('region', { name: 'Resumo do mês' });
    const byPayerRegion = screen.getByRole('region', { name: 'Gastos por responsável' });
    const billsRegion = screen.getByRole('region', { name: 'Contas' });

    // Then the totals lead, the by-payer summary follows, then the list
    expect(appearsBefore(summaryRegion, byPayerRegion)).toBe(true);
    expect(appearsBefore(byPayerRegion, billsRegion)).toBe(true);
  });

  it('keeps the by-payer summary collapsed until it is expanded', async () => {
    // Given June has a bill
    renderBills(`/bills/${JUNE}`, [bill({ month: JUNE, name: 'Luz', amount: 150 })]);
    const user = userEvent.setup();

    // When the screen first renders
    // Then the summary is collapsed and its content is hidden
    expect(summaryToggle()).toHaveAttribute('aria-expanded', 'false');
    expect(byPayer().queryByText('Marcelo')).not.toBeInTheDocument();

    // When I expand it
    await user.click(summaryToggle());

    // Then its content is shown and the toggle reads expanded
    expect(summaryToggle()).toHaveAttribute('aria-expanded', 'true');
    expect(byPayer().getByText('Marcelo')).toBeInTheDocument();

    // When I collapse it again
    await user.click(summaryToggle());

    // Then the content is hidden once more
    expect(summaryToggle()).toHaveAttribute('aria-expanded', 'false');
    expect(byPayer().queryByText('Marcelo')).not.toBeInTheDocument();
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

  it('groups the month spending by payer and then by bank', async () => {
    // Given June's bills split across two payers and two banks
    renderBills(`/bills/${JUNE}`, [
      bill({ month: JUNE, name: 'Luz', amount: 150 }),
      bill({ month: JUNE, name: 'Internet', amount: 110 }),
      bill({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
      bill({ month: JUNE, name: 'Gym', amount: 200, payerId: 'payer-guta', bankId: 'bank-nubank' }),
    ]);
    const user = userEvent.setup();

    // When I open the by-payer summary
    await user.click(summaryToggle());

    // Then Marcelo carries 260 on Nubank, and Guta carries 3.099 split across Itaú and Nubank
    expect(payerGroup('Marcelo').getAllByText(/260,00/)).toHaveLength(2); // group total + bank line
    expect(payerGroup('Marcelo').getByText('Nubank')).toBeInTheDocument();
    expect(payerGroup('Guta').getByText(/3\.099,00/)).toBeInTheDocument();
    expect(payerGroup('Guta').getByText(/2\.899,00/)).toBeInTheDocument();
    expect(payerGroup('Guta').getByText(/200,00/)).toBeInTheDocument();
  });

  it('still counts a bill whose payer and bank were removed from the registries', async () => {
    // Given a June bill referencing a payer and bank no longer registered
    renderBills(`/bills/${JUNE}`, [
      bill({ month: JUNE, name: 'Luz', amount: 150, payerId: 'payer-gone', bankId: 'bank-gone' }),
    ]);
    const user = userEvent.setup();

    // When I open the by-payer summary
    await user.click(summaryToggle());

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

  it('is empty until bills are added, with zero totals', async () => {
    // Given July has no bills and no income
    // When the screen renders
    renderBills(`/bills/${JULY}`);
    const user = userEvent.setup();

    // Then the empty state and zero totals are shown
    expect(screen.getByText('As contas deste mês aparecerão aqui.')).toBeInTheDocument();
    expect(summary().getAllByText(/0,00/)).toHaveLength(3);

    // And the by-payer summary reads empty once opened
    await user.click(summaryToggle());
    expect(byPayer().getByText('Adicione contas para ver o resumo por responsável.')).toBeInTheDocument();
  });
});

describe('Bill filter', () => {
  it('places the filter control between the by-payer summary and the bills list', () => {
    // Given June has a bill
    renderBills(`/bills/${JUNE}`, [bill({ month: JUNE, name: 'Luz', amount: 150 })]);

    // When the screen renders
    const byPayerRegion = screen.getByRole('region', { name: 'Gastos por responsável' });
    const billsRegion = screen.getByRole('region', { name: 'Contas' });

    // Then the filter icon sits between the summary and the list, closed
    expect(appearsBefore(byPayerRegion, filterButton())).toBe(true);
    expect(appearsBefore(filterButton(), billsRegion)).toBe(true);
    expect(filterButton()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog', { name: 'Filtrar contas' })).not.toBeInTheDocument();
  });

  it('opens a drawer with a checkbox per payer and bank used this month', async () => {
    // Given June's bills use both payers and both banks
    renderBills(`/bills/${JUNE}`, [
      bill({ month: JUNE, name: 'Luz', amount: 150 }),
      bill({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
    ]);
    const user = userEvent.setup();

    // When I open the filter
    await user.click(filterButton());

    // Then every payer and bank has a checkbox, all unchecked
    const drawer = filterDrawer();
    expect(drawer.getByRole('checkbox', { name: 'Marcelo' })).not.toBeChecked();
    expect(drawer.getByRole('checkbox', { name: 'Guta' })).not.toBeChecked();
    expect(drawer.getByRole('checkbox', { name: 'Itaú' })).not.toBeChecked();
    expect(drawer.getByRole('checkbox', { name: 'Nubank' })).not.toBeChecked();
  });

  it('offers only the payers and banks that have bills this month', async () => {
    // Given only Marcelo and Nubank appear in June
    renderBills(`/bills/${JUNE}`, [bill({ month: JUNE, name: 'Luz', amount: 150 })]);
    const user = userEvent.setup();

    // When I open the filter
    await user.click(filterButton());

    // Then entries with no bill this month are not offered
    const drawer = filterDrawer();
    expect(drawer.getByRole('checkbox', { name: 'Marcelo' })).toBeInTheDocument();
    expect(drawer.getByRole('checkbox', { name: 'Nubank' })).toBeInTheDocument();
    expect(drawer.queryByRole('checkbox', { name: 'Guta' })).not.toBeInTheDocument();
    expect(drawer.queryByRole('checkbox', { name: 'Itaú' })).not.toBeInTheDocument();
  });

  it('narrows the list to the selected payer when the filter is applied', async () => {
    // Given June has a Marcelo bill and a Guta bill
    renderBills(`/bills/${JUNE}`, [
      bill({ month: JUNE, name: 'Luz', amount: 150 }),
      bill({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
    ]);
    const user = userEvent.setup();

    // When I filter by Guta
    await applyFilter(user, 'Guta');

    // Then only Guta's bill is listed and the drawer has closed
    expect(screen.getByText('Cartão guta')).toBeInTheDocument();
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Filtrar contas' })).not.toBeInTheDocument();
  });

  it('matches any selected payer AND any selected bank together', async () => {
    // Given June's bills spread across both payers and both banks
    renderBills(`/bills/${JUNE}`, [
      bill({ month: JUNE, name: 'Luz', amount: 150 }),
      bill({ month: JUNE, name: 'Água', amount: 90, bankId: 'bank-itau' }),
      bill({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
      bill({ month: JUNE, name: 'Gym', amount: 200, payerId: 'payer-guta' }),
    ]);
    const user = userEvent.setup();

    // When I pick both payers but only Itaú
    await applyFilter(user, 'Marcelo', 'Guta', 'Itaú');

    // Then only the Itaú bills of the selected payers remain
    expect(screen.getByText('Água')).toBeInTheDocument();
    expect(screen.getByText('Cartão guta')).toBeInTheDocument();
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();
    expect(screen.queryByText('Gym')).not.toBeInTheDocument();
  });

  it('shows a filtered empty state and clears it back to the month', async () => {
    // Given no bill is both Marcelo's and from Itaú
    renderBills(`/bills/${JUNE}`, [
      bill({ month: JUNE, name: 'Luz', amount: 150 }),
      bill({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
    ]);
    const user = userEvent.setup();

    // When I filter by a combination no bill satisfies
    await applyFilter(user, 'Marcelo', 'Itaú');

    // Then the list is empty rather than blank
    expect(screen.getByText('Nenhuma conta corresponde aos filtros.')).toBeInTheDocument();
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();

    // When I clear the filters from the list
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    // Then the whole month is back
    expect(screen.getByText('Luz')).toBeInTheDocument();
    expect(screen.getByText('Cartão guta')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument();
  });

  it('leaves the month totals and the by-payer summary on the full month', async () => {
    // Given June has a 150 bill and a 2.899 bill on different payers
    renderBills(`/bills/${JUNE}`, [
      bill({ month: JUNE, name: 'Luz', amount: 150 }),
      bill({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
    ]);
    const user = userEvent.setup();

    // When I filter to Guta
    await applyFilter(user, 'Guta');

    // Then the list narrows, but the totals and summary keep the whole month
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();
    expect(summaryRow('Total das contas').getByText(/3\.049,00/)).toBeInTheDocument();
    await user.click(summaryToggle());
    expect(byPayer().getByText('Marcelo')).toBeInTheDocument();
    expect(byPayer().getByText('Guta')).toBeInTheDocument();
  });

  it('discards an unapplied selection when the drawer is closed', async () => {
    // Given June has a Marcelo bill and a Guta bill
    renderBills(`/bills/${JUNE}`, [
      bill({ month: JUNE, name: 'Luz', amount: 150 }),
      bill({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
    ]);
    const user = userEvent.setup();

    // When I open the filter, tick Guta, then press Escape without applying
    await user.click(filterButton());
    await user.click(filterDrawer().getByRole('checkbox', { name: 'Guta' }));
    await user.keyboard('{Escape}');

    // Then the drawer closes and nothing changed
    expect(screen.queryByRole('dialog', { name: 'Filtrar contas' })).not.toBeInTheDocument();
    expect(screen.getByText('Luz')).toBeInTheDocument();

    // And reopening shows an untouched drawer
    await user.click(filterButton());
    expect(filterDrawer().getByRole('checkbox', { name: 'Guta' })).not.toBeChecked();
  });

  it('offers unset payer and bank as labelled options', async () => {
    // Given a legacy June bill with no payer or bank recorded
    renderBills(`/bills/${JUNE}`, [
      bill({ month: JUNE, name: 'Luz', amount: 150, payerId: '', bankId: '' }),
    ]);
    const user = userEvent.setup();

    // When I open the filter
    await user.click(filterButton());

    // Then the unset references are offered under their fallback labels
    expect(filterDrawer().getByRole('checkbox', { name: 'Sem responsável' })).toBeInTheDocument();
    expect(filterDrawer().getByRole('checkbox', { name: 'Sem banco' })).toBeInTheDocument();
  });

  it('resets the filter when the browsed month changes', async () => {
    // Given the current month has a Marcelo bill and a Guta bill
    renderBills(`/bills/${CURRENT}`, [
      bill({ month: CURRENT, name: 'Luz', amount: 150 }),
      bill({ month: CURRENT, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
    ]);
    const user = userEvent.setup();

    // When I filter to Guta and then move away and back
    await applyFilter(user, 'Guta');
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }));

    // Then the new month starts unfiltered — a stale selection never hides it
    expect(screen.getByText('Luz')).toBeInTheDocument();
    expect(screen.getByText('Cartão guta')).toBeInTheDocument();
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

  it('re-reads the target month and blocks the copy when another member already replicated', async () => {
    // Given I see June as empty, but the sheet now holds a June bill (another
    // member copied while my Working Copy was stale)
    renderBills(`/bills/${JUNE}`, [bill({ month: MAY, name: 'Luz', amount: 150 })]);
    vi.mocked(googleSheetsService.readBills).mockResolvedValue([
      bill({ month: JUNE, name: 'Internet', amount: 110 }),
    ]);
    const user = userEvent.setup();

    // When I tap replicate
    await user.click(screen.getByRole('button', { name: 'Replicar contas do mês anterior' }));

    // Then the sheet was re-read for this month, nothing was copied, and a
    // message explains why
    expect(googleSheetsService.readBills).toHaveBeenCalledWith('sheet-1');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este mês já tem registros. Nada foi copiado para não duplicar.'
    );
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();
    expect(writtenRecords(googleSheetsService, 'bills')).toEqual([]);
  });

  it('blocks the copy and says so when the target month cannot be checked', async () => {
    // Given the re-read fails (offline or expired session)
    renderBills(`/bills/${JUNE}`, [bill({ month: MAY, name: 'Luz', amount: 150 })]);
    vi.mocked(googleSheetsService.readBills).mockRejectedValue(new Error('offline'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();

    // When I tap replicate
    await user.click(screen.getByRole('button', { name: 'Replicar contas do mês anterior' }));

    // Then nothing is copied and a message explains that the check failed
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível verificar o mês antes de copiar. Nada foi copiado.'
    );
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();
    expect(writtenRecords(googleSheetsService, 'bills')).toEqual([]);
    errorSpy.mockRestore();
  });

  it('cannot double-replicate when the copy button is tapped twice before the re-read settles', async () => {
    // Given an empty target month, a source bill that is a duplicate by name, and
    // a re-read slow enough for a second tap to land inside the first
    const store = renderBills(`/bills/${JUNE}`, [
      bill({ month: MAY, name: 'Luz', amount: 150 }),
      bill({ month: MAY, name: 'Luz', amount: 150 }),
    ]);
    let resolveRead: (value: Bill[]) => void = () => {};
    vi.mocked(googleSheetsService.readBills).mockReturnValue(
      new Promise<Bill[]>((resolve) => {
        resolveRead = resolve;
      })
    );
    const user = userEvent.setup();

    // When I tap replicate twice, both taps landing inside the same in-flight read
    const button = screen.getByRole('button', { name: 'Replicar contas do mês anterior' });
    await user.click(button);
    await user.click(button);
    resolveRead([]);

    // Then the month was read once and exactly one set of copies was added; the
    // list settles on the two copied bills (duplicates by name both survive)
    await waitFor(() => {
      expect(store.getState().bills.items.filter((entry) => entry.month === JUNE)).toHaveLength(2);
    }, { timeout: 2500 });
    expect(googleSheetsService.readBills).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Luz')).toHaveLength(2);
    // Drain the debounced write this copy scheduled so it cannot leak into the
    // next test's write assertions.
    await waitFor(() => {
      expect(writtenRecords(googleSheetsService, 'bills')).toHaveLength(2);
    }, { timeout: 2500 });
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
