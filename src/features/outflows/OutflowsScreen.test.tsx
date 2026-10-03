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
import outflowsReducer from '../../store/outflowsSlice';
import incomeReducer from '../../store/incomeSlice';
import { syncListenerMiddleware } from '../../store/middleware/syncListener';
import pendingReducer from '../../store/pendingSlice';
import payersReducer from '../../store/payersSlice';
import settingsReducer from '../../store/settingsSlice';
import { writtenRecords } from '../../test/pendingWrites';
import type { Bank, Outflow, IncomeEntry, Payer } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { getCurrentMonth, shiftMonth } from '../../utils/month';
import OutflowsScreen from './OutflowsScreen';

vi.mock('../../services/GoogleSheetsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/GoogleSheetsService')>();
  return {
    ...actual,
    googleSheetsService: {
      ...actual.googleSheetsService,
      writePendingChanges: vi.fn(),
      readOutflows: vi.fn(),
      readPlanItems: vi.fn(),
      readIncome: vi.fn(),
    },
  };
});

const JUNE = '2026-06';
const MAY = '2026-05';
const JULY = '2026-07';

/**
 * pt-BR currency with a plain space. `Intl` inserts a non-breaking space after
 * `R$`, which an exact text matcher does not normalize, so tests build expected
 * money strings through this helper.
 */
const money = (amount: number) => formatCurrency(amount, 'pt-BR').replace(/\u00A0/g, ' ');

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

function outflow(
  overrides: Partial<Outflow> & Pick<Outflow, 'month' | 'name' | 'amount'>
): Outflow {
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
 * Renders the Outflows screen with a real store and the real debounced sync
 * middleware: only the sheets service boundary is mocked, so every mutation is
 * verified all the way to the write-back call (Seam B).
 */
function renderOutflows(
  initialPath = `/outflows/${JUNE}`,
  outflows: Outflow[] = [],
  income: IncomeEntry[] = [],
  payers: Payer[] = PAYERS,
  banks: Bank[] = BANKS
) {
  const store = configureStore({
    reducer: {
      outflows: outflowsReducer,
      income: incomeReducer,
      payers: payersReducer,
      banks: banksReducer,
      settings: settingsReducer,
      pending: pendingReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(syncListenerMiddleware.middleware),
    preloadedState: {
      outflows: { items: outflows },
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
          <Route path="/outflows/:month" element={<OutflowsScreen />} />
          <Route path="/outflows/edit/:id" element={<p>Editor da saída</p>} />
          <Route path="/outflows/new/:month" element={<p>Nova saída</p>} />
          <Route path="/income/:month" element={<p>Página de renda</p>} />
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
const byPayer = () => within(screen.getByRole('region', { name: 'Saídas por responsável' }));

/** The expand/collapse toggle for the by-payer spending summary. */
const summaryToggle = () =>
  screen.getByRole('button', { name: 'Saídas por responsável' });

/** One payer's group inside the by-payer summary, addressed by its name. */
const payerGroup = (name: string) =>
  within(byPayer().getByText(name).closest('li') as HTMLElement);

/** The small icon that opens the filter drawer. */
const filterButton = () => screen.getByRole('button', { name: 'Filtrar saídas' });

/** The filter drawer, addressed once it is open. */
const filterDrawer = () =>
  within(screen.getByRole('dialog', { name: 'Filtrar saídas' }));

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

/** Wait out the debounced sync and assert the outflows written satisfy `matches`. */
async function expectOutflowsWritten(matches: (written: Outflow[]) => boolean) {
  await waitFor(() => {
    const written = writtenRecords(googleSheetsService, 'outflows');
    expect(matches(written)).toBe(true);
  }, { timeout: 2500 });
}

beforeEach(async () => {
  vi.clearAllMocks();
  // The remaining-to-pay toggle persists in local storage; clear it so one
  // test's preference can never leak into the next.
  localStorage.clear();
  // The copy guard's re-read defaults to an empty sheet; the guard tests below
  // return rows to simulate another member's copy having landed.
  vi.mocked(googleSheetsService.readOutflows).mockResolvedValue([]);
  // `clearAllMocks` strips the implementation, so every test re-arms the write
  // boundary as a resolved stub; `writtenRecords` reads its call payloads.
  vi.mocked(googleSheetsService.writePendingChanges).mockResolvedValue(undefined);
  await i18n.changeLanguage('pt-BR');
});

describe('Outflows', () => {
  it("lists the month's outflows with amounts and open/paid status", () => {
    // Given June has an open outflow and a paid one
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150 }),
      outflow({ month: JUNE, name: 'Internet', amount: 110, isPaid: true }),
    ]);

    // When the screen renders
    // Then both outflows and their status are visible
    expect(screen.getByText('Luz')).toBeInTheDocument();
    expect(screen.getByText('Internet')).toBeInTheDocument();
    expect(screen.getByText(/150,00/)).toBeInTheDocument();
    expect(screen.getByText(/110,00/)).toBeInTheDocument();
    expect(screen.getByText('Em aberto')).toBeInTheDocument();
    expect(screen.getByText('Pago')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Marcar como paga: Luz' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Marcar como em aberto: Internet' })).toBeChecked();
  });

  it('lists open outflows before paid ones, alphabetically within each group', () => {
    // Given June has open and paid outflows listed out of order
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150 }),
      outflow({ month: JUNE, name: 'Internet', amount: 110, isPaid: true }),
      outflow({ month: JUNE, name: 'Água', amount: 90 }),
      outflow({ month: JUNE, name: 'Gym', amount: 50, isPaid: true }),
    ]);

    // When the list renders
    // Then the open outflows lead in alphabetical order, then the paid ones
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

  it('flags a outflow whose value is not final with a warning before its name', () => {
    // Given one confirmed outflow and one still awaiting its final value
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150, isFinal: true }),
      outflow({ month: JUNE, name: 'Internet', amount: 110, isFinal: false }),
    ]);

    // When the list renders
    const unconfirmedRow = screen.getByText('Internet').closest('li') as HTMLElement;
    const confirmedRow = screen.getByText('Luz').closest('li') as HTMLElement;

    // Then only the unconfirmed outflow carries the warning
    expect(within(unconfirmedRow).getByText('⚠️')).toBeInTheDocument();
    expect(within(confirmedRow).queryByText('⚠️')).not.toBeInTheDocument();
  });

  it('sinks paid outflows below the open ones, whatever their final status', () => {
    // Given a confirmed open outflow, an unconfirmed open one and a confirmed paid one
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Água', amount: 90, isFinal: false }),
      outflow({ month: JUNE, name: 'Internet', amount: 110, isPaid: true, isFinal: true }),
      outflow({ month: JUNE, name: 'Luz', amount: 150, isFinal: true }),
    ]);

    // When the list renders
    const rows = screen
      .getAllByRole('checkbox')
      .map((box) => box.getAttribute('aria-label'));

    // Then the open confirmed outflow leads, the open unconfirmed one follows,
    // and the paid outflow sinks to the end
    expect(rows).toEqual([
      'Marcar como paga: Luz',
      'Marcar como paga: Água',
      'Marcar como em aberto: Internet',
    ]);
  });

  it('shows the by-payer summary below the totals and above the outflows list', () => {
    // Given June has a outflow
    renderOutflows(`/outflows/${JUNE}`, [outflow({ month: JUNE, name: 'Luz', amount: 150 })]);

    // When the screen renders
    const summaryRegion = screen.getByRole('region', { name: 'Resumo do mês' });
    const byPayerRegion = screen.getByRole('region', { name: 'Saídas por responsável' });
    const outflowsRegion = screen.getByRole('region', { name: 'Saídas' });

    // Then the totals lead, the by-payer summary follows, then the list
    expect(appearsBefore(summaryRegion, byPayerRegion)).toBe(true);
    expect(appearsBefore(byPayerRegion, outflowsRegion)).toBe(true);
  });

  it('keeps the by-payer summary collapsed until it is expanded', async () => {
    // Given June has a outflow
    renderOutflows(`/outflows/${JUNE}`, [outflow({ month: JUNE, name: 'Luz', amount: 150 })]);
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

  it('shows the payer and bank each outflow was assigned', () => {
    // Given June has a outflow paid by Guta from Itaú
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
    ]);

    // When the screen renders
    // Then the row reads who pays it and from which bank
    expect(screen.getByText('Guta · Itaú')).toBeInTheDocument();
  });

  it('shows a fallback label for a outflow whose payer or bank is unset', () => {
    // Given a legacy June outflow with no payer or bank recorded
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150, payerId: '', bankId: '' }),
    ]);

    // When the screen renders
    // Then it is labelled rather than blank
    expect(screen.getByText('Sem responsável · Sem banco')).toBeInTheDocument();
  });

  it('shows the outflows total, income total and account net for the month', () => {
    // Given June has 150 + 2.899 in outflows and 12.000 of income
    renderOutflows(
      `/outflows/${JUNE}`,
      [outflow({ month: JUNE, name: 'Luz', amount: 150 }), outflow({ month: JUNE, name: 'Cartão guta', amount: 2899 })],
      [incomeEntry(JUNE, 12000, 'Salário')]
    );

    // When I look at the month summary
    // Then Account Net is income − outflows = 8.951, and each total is its own sum
    expect(screen.getByText('Total das saídas')).toBeInTheDocument();
    expect(screen.getByText('Total da renda')).toBeInTheDocument();
    expect(screen.getByText('Saldo da conta')).toBeInTheDocument();
    expect(summaryRow('Total das saídas').getByText(/3\.049,00/)).toBeInTheDocument();
    expect(summaryRow('Total da renda').getByText(/12\.000,00/)).toBeInTheDocument();
    expect(summaryRow('Saldo da conta').getByText(/8\.951,00/)).toBeInTheDocument();
  });

  it('opens the same month on the Income screen from the income total', async () => {
    // Given June has income and I am browsing June
    renderOutflows(`/outflows/${JUNE}`, [], [incomeEntry(JUNE, 12000, 'Salário')]);
    const user = userEvent.setup();

    // When I tap the income total
    await user.click(screen.getByRole('button', { name: 'Ver renda do mês' }));

    // Then the Income screen for the same month opens
    expect(screen.getByText('Página de renda')).toBeInTheDocument();
  });

  it('groups the month spending by payer and then by bank', async () => {
    // Given June's outflows split across two payers and two banks
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150 }),
      outflow({ month: JUNE, name: 'Internet', amount: 110 }),
      outflow({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
      outflow({ month: JUNE, name: 'Gym', amount: 200, payerId: 'payer-guta', bankId: 'bank-nubank' }),
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

  it('swaps the by-payer and per-bank values to the amount still to pay on request', async () => {
    // Given Guta has one paid Itaú outflow and one open Nubank outflow
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Cartão guta', amount: 150, isPaid: true, payerId: 'payer-guta', bankId: 'bank-itau' }),
      outflow({ month: JUNE, name: 'Gym', amount: 200, payerId: 'payer-guta', bankId: 'bank-nubank' }),
    ]);
    const user = userEvent.setup();
    await user.click(summaryToggle());
    const group = payerGroup('Guta');

    // Then the values start as the full totals (350) including the paid outflow
    expect(group.getByText(money(350))).toBeInTheDocument();
    expect(group.getByText(money(150))).toBeInTheDocument();

    // When I turn on the remaining toggle
    await user.click(byPayer().getByRole('checkbox', { name: 'Mostrar valor a pagar' }));

    // Then each value becomes what is still to pay — the paid Itaú outflow drops
    // to zero and the group total drops to the open Nubank outflow
    expect(group.queryByText(money(350))).not.toBeInTheDocument();
    expect(group.queryByText(money(150))).not.toBeInTheDocument();
    expect(group.getAllByText(money(200))).toHaveLength(2);
    expect(group.getByText(money(0))).toBeInTheDocument();
  });

  it('remembers the remaining toggle in local storage', async () => {
    // Given June has a outflow with the by-payer summary open
    renderOutflows(`/outflows/${JUNE}`, [outflow({ month: JUNE, name: 'Luz', amount: 150 })]);
    const user = userEvent.setup();
    await user.click(summaryToggle());

    // When I turn the remaining toggle on
    await user.click(byPayer().getByRole('checkbox', { name: 'Mostrar valor a pagar' }));

    // Then the preference is persisted for the next visit
    expect(localStorage.getItem('planyoo:outflows:showRemaining')).toBe('true');
  });

  it('remembers whether the by-payer summary is expanded', async () => {
    // Given June has a outflow and the summary starts collapsed
    renderOutflows(`/outflows/${JUNE}`, [outflow({ month: JUNE, name: 'Luz', amount: 150 })]);
    const user = userEvent.setup();

    // When I expand the summary
    await user.click(summaryToggle());

    // Then the open state is persisted for the next visit
    expect(localStorage.getItem('planyoo:outflows:summaryOpen')).toBe('true');
  });

  it('still counts a outflow whose payer and bank were removed from the registries', async () => {
    // Given a June outflow referencing a payer and bank no longer registered
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150, payerId: 'payer-gone', bankId: 'bank-gone' }),
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
    // Given June holds 150 in outflows and May holds another 900
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150 }),
      outflow({ month: MAY, name: 'Água', amount: 900 }),
    ]);

    // When I look at June's summary
    // Then only June's outflows are counted
    expect(summaryRow('Total das saídas').getByText(/150,00/)).toBeInTheDocument();
    expect(summary().queryByText(/1\.050,00/)).not.toBeInTheDocument();
  });

  it('opens the full-screen editor when a row is tapped', async () => {
    // Given June has a outflow
    renderOutflows(`/outflows/${JUNE}`, [outflow({ month: JUNE, name: 'Luz', amount: 150 })]);
    const user = userEvent.setup();

    // When I tap the outflow's row
    await user.click(screen.getByRole('button', { name: 'Editar Luz' }));

    // Then the full-screen editor for that outflow is shown
    expect(screen.getByText('Editor da saída')).toBeInTheDocument();
  });

  it('no longer offers inline add or remove affordances', () => {
    // Given June has a outflow
    renderOutflows(`/outflows/${JUNE}`, [outflow({ month: JUNE, name: 'Luz', amount: 150 })]);

    // When the list renders
    // Then adding and removing happen on the editor page, not inline
    expect(screen.queryByLabelText('Nome da saída')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Remover Luz' })
    ).not.toBeInTheDocument();
  });

  it('highlights the registry guidance and shortcuts to Settings when there are no payers or banks', async () => {
    // Given no payers and no banks are registered
    renderOutflows(`/outflows/${JUNE}`, [], [], [], []);
    const user = userEvent.setup();

    // When the screen renders
    // Then the guidance sits in a highlighted callout instead of an unusable add flow
    expect(
      screen.getByText('Cadastre ao menos um responsável e um banco em Ajustes para adicionar saídas.')
    ).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveClass('bg-amber-50');
    expect(screen.queryByRole('button', { name: 'Adicionar saída' })).not.toBeInTheDocument();

    // When I tap the callout's shortcut
    await user.click(screen.getByRole('button', { name: 'Ir para Ajustes' }));

    // Then the Settings page opens
    expect(screen.getByText('Ajustes')).toBeInTheDocument();
  });

  it('toggles a outflow paid and writes the outflows tab back', async () => {
    // Given June has an open outflow
    renderOutflows(`/outflows/${JUNE}`, [outflow({ month: JUNE, name: 'Luz', amount: 150 })]);
    const user = userEvent.setup();

    // When I mark it paid
    await user.click(screen.getByRole('checkbox', { name: 'Marcar como paga: Luz' }));

    // Then it reads as paid
    expect(screen.getByRole('checkbox', { name: 'Marcar como em aberto: Luz' })).toBeChecked();
    expect(screen.getByText('Pago')).toBeInTheDocument();

    // And the outflows tab carries the paid status
    await expectOutflowsWritten((written) =>
      written.some((entry) => entry.name === 'Luz' && entry.isPaid)
    );
  });

  it('keeps the account net unchanged when a outflow is marked paid', async () => {
    // Given June has 12.000 of income and a 2.899 card bill still open
    renderOutflows(
      `/outflows/${JUNE}`,
      [outflow({ month: JUNE, name: 'Cartão guta', amount: 2899 })],
      [incomeEntry(JUNE, 12000, 'Salário')]
    );
    const user = userEvent.setup();
    expect(summaryRow('Saldo da conta').getByText(/9\.101,00/)).toBeInTheDocument();

    // When I mark the card bill paid
    await user.click(screen.getByRole('checkbox', { name: 'Marcar como paga: Cartão guta' }));

    // Then the net is unchanged — the outflow is an obligation either way
    expect(summaryRow('Saldo da conta').getByText(/9\.101,00/)).toBeInTheDocument();

    // And the toggle still reaches the sheet
    await expectOutflowsWritten((written) =>
      written.some((entry) => entry.name === 'Cartão guta' && entry.isPaid)
    );
  });

  it('is empty until outflows are added, with zero totals', async () => {
    // Given July has no outflows and no income
    // When the screen renders
    renderOutflows(`/outflows/${JULY}`);
    const user = userEvent.setup();

    // Then the empty state and zero totals are shown
    expect(screen.getByText('As saídas deste mês aparecerão aqui.')).toBeInTheDocument();
    expect(summary().getAllByText(/0,00/)).toHaveLength(3);

    // And the by-payer summary reads empty once opened
    await user.click(summaryToggle());
    expect(byPayer().getByText('Adicione saídas para ver o resumo por responsável.')).toBeInTheDocument();
  });
});

describe('Outflow filter', () => {
  it('places the filter control between the by-payer summary and the outflows list', () => {
    // Given June has a outflow
    renderOutflows(`/outflows/${JUNE}`, [outflow({ month: JUNE, name: 'Luz', amount: 150 })]);

    // When the screen renders
    const byPayerRegion = screen.getByRole('region', { name: 'Saídas por responsável' });
    const outflowsRegion = screen.getByRole('region', { name: 'Saídas' });

    // Then the filter icon sits between the summary and the list, closed
    expect(appearsBefore(byPayerRegion, filterButton())).toBe(true);
    expect(appearsBefore(filterButton(), outflowsRegion)).toBe(true);
    expect(filterButton()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog', { name: 'Filtrar saídas' })).not.toBeInTheDocument();
  });

  it('opens a drawer with a checkbox per payer and bank used this month', async () => {
    // Given June's outflows use both payers and both banks
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150 }),
      outflow({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
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

  it('offers only the payers and banks that have outflows this month', async () => {
    // Given only Marcelo and Nubank appear in June
    renderOutflows(`/outflows/${JUNE}`, [outflow({ month: JUNE, name: 'Luz', amount: 150 })]);
    const user = userEvent.setup();

    // When I open the filter
    await user.click(filterButton());

    // Then entries with no outflow this month are not offered
    const drawer = filterDrawer();
    expect(drawer.getByRole('checkbox', { name: 'Marcelo' })).toBeInTheDocument();
    expect(drawer.getByRole('checkbox', { name: 'Nubank' })).toBeInTheDocument();
    expect(drawer.queryByRole('checkbox', { name: 'Guta' })).not.toBeInTheDocument();
    expect(drawer.queryByRole('checkbox', { name: 'Itaú' })).not.toBeInTheDocument();
  });

  it('narrows the list to the selected payer when the filter is applied', async () => {
    // Given June has a Marcelo outflow and a Guta outflow
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150 }),
      outflow({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
    ]);
    const user = userEvent.setup();

    // When I filter by Guta
    await applyFilter(user, 'Guta');

    // Then only Guta's outflow is listed and the drawer has closed
    expect(screen.getByText('Cartão guta')).toBeInTheDocument();
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Filtrar saídas' })).not.toBeInTheDocument();
  });

  it('matches any selected payer AND any selected bank together', async () => {
    // Given June's outflows spread across both payers and both banks
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150 }),
      outflow({ month: JUNE, name: 'Água', amount: 90, bankId: 'bank-itau' }),
      outflow({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
      outflow({ month: JUNE, name: 'Gym', amount: 200, payerId: 'payer-guta' }),
    ]);
    const user = userEvent.setup();

    // When I pick both payers but only Itaú
    await applyFilter(user, 'Marcelo', 'Guta', 'Itaú');

    // Then only the Itaú outflows of the selected payers remain
    expect(screen.getByText('Água')).toBeInTheDocument();
    expect(screen.getByText('Cartão guta')).toBeInTheDocument();
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();
    expect(screen.queryByText('Gym')).not.toBeInTheDocument();
  });

  it('shows a filtered empty state and clears it back to the month', async () => {
    // Given no outflow is both Marcelo's and from Itaú
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150 }),
      outflow({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
    ]);
    const user = userEvent.setup();

    // When I filter by a combination no outflow satisfies
    await applyFilter(user, 'Marcelo', 'Itaú');

    // Then the list is empty rather than blank
    expect(screen.getByText('Nenhuma saída corresponde aos filtros.')).toBeInTheDocument();
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();

    // When I clear the filters from the list
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    // Then the whole month is back
    expect(screen.getByText('Luz')).toBeInTheDocument();
    expect(screen.getByText('Cartão guta')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument();
  });

  it('leaves the month totals and the by-payer summary on the full month', async () => {
    // Given June has a 150 outflow and a 2.899 outflow on different payers
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150 }),
      outflow({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
    ]);
    const user = userEvent.setup();

    // When I filter to Guta
    await applyFilter(user, 'Guta');

    // Then the list narrows, but the totals and summary keep the whole month
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();
    expect(summaryRow('Total das saídas').getByText(/3\.049,00/)).toBeInTheDocument();
    await user.click(summaryToggle());
    expect(byPayer().getByText('Marcelo')).toBeInTheDocument();
    expect(byPayer().getByText('Guta')).toBeInTheDocument();
  });

  it('discards an unapplied selection when the drawer is closed', async () => {
    // Given June has a Marcelo outflow and a Guta outflow
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150 }),
      outflow({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
    ]);
    const user = userEvent.setup();

    // When I open the filter, tick Guta, then press Escape without applying
    await user.click(filterButton());
    await user.click(filterDrawer().getByRole('checkbox', { name: 'Guta' }));
    await user.keyboard('{Escape}');

    // Then the drawer closes and nothing changed
    expect(screen.queryByRole('dialog', { name: 'Filtrar saídas' })).not.toBeInTheDocument();
    expect(screen.getByText('Luz')).toBeInTheDocument();

    // And reopening shows an untouched drawer
    await user.click(filterButton());
    expect(filterDrawer().getByRole('checkbox', { name: 'Guta' })).not.toBeChecked();
  });

  it('offers unset payer and bank as labelled options', async () => {
    // Given a legacy June outflow with no payer or bank recorded
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150, payerId: '', bankId: '' }),
    ]);
    const user = userEvent.setup();

    // When I open the filter
    await user.click(filterButton());

    // Then the unset references are offered under their fallback labels
    expect(filterDrawer().getByRole('checkbox', { name: 'Sem responsável' })).toBeInTheDocument();
    expect(filterDrawer().getByRole('checkbox', { name: 'Sem banco' })).toBeInTheDocument();
  });

  it('keeps the filter when the browsed month changes', async () => {
    // Given the current month has a Marcelo outflow and a Guta outflow
    renderOutflows(`/outflows/${CURRENT}`, [
      outflow({ month: CURRENT, name: 'Luz', amount: 150 }),
      outflow({ month: CURRENT, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
    ]);
    const user = userEvent.setup();

    // When I filter to Guta and then move away and back
    await applyFilter(user, 'Guta');
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }));

    // Then the selection is a remembered preference and still narrows the list
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();
    expect(screen.getByText('Cartão guta')).toBeInTheDocument();
    expect(screen.getByText('Responsável: Guta')).toBeInTheDocument();
  });

  it('remembers the filter in local storage', async () => {
    // Given June has a Marcelo outflow and a Guta outflow
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150 }),
      outflow({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
    ]);
    const user = userEvent.setup();

    // When I filter by Guta and Itaú
    await applyFilter(user, 'Guta', 'Itaú');

    // Then the selection is persisted for the next visit
    expect(localStorage.getItem('planyoo:outflows:filter')).toBe(
      JSON.stringify({ payerIds: ['payer-guta'], bankIds: ['bank-itau'] })
    );
  });

  it('spells out the active filters to the left of the filter control', async () => {
    // Given June has a Marcelo outflow and a Guta/Itaú outflow
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150 }),
      outflow({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
    ]);
    const user = userEvent.setup();

    // When I filter by Guta and Itaú
    await applyFilter(user, 'Guta', 'Itaú');

    // Then each facet is named to the left of the filter icon
    const payerFilter = screen.getByText('Responsável: Guta');
    const bankFilter = screen.getByText('Banco: Itaú');
    expect(appearsBefore(payerFilter, filterButton())).toBe(true);
    expect(appearsBefore(bankFilter, filterButton())).toBe(true);

    // And clearing the filters removes the labels
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.queryByText('Responsável: Guta')).not.toBeInTheDocument();
    expect(screen.queryByText('Banco: Itaú')).not.toBeInTheDocument();
  });

  it('lists several selected payers in one label', async () => {
    // Given June has a outflow for each payer
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: JUNE, name: 'Luz', amount: 150 }),
      outflow({ month: JUNE, name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
    ]);
    const user = userEvent.setup();

    // When I select both payers
    await applyFilter(user, 'Marcelo', 'Guta');

    // Then a single label names them both
    expect(screen.getByText('Responsável: Marcelo, Guta')).toBeInTheDocument();
  });
});

describe('Replicate last month', () => {
  it("copies last month's outflows into an empty month, unpaid, and persists them", async () => {
    // Given May has an open outflow and a paid one, and June is still empty
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: MAY, name: 'Luz', amount: 150 }),
      outflow({
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
    await user.click(screen.getByRole('button', { name: 'Replicar saídas do mês anterior' }));

    // Then June shows copies of both and the total
    expect(screen.getByText('Luz')).toBeInTheDocument();
    expect(screen.getByText('Cartão guta')).toBeInTheDocument();
    expect(screen.getByText('Guta · Itaú')).toBeInTheDocument();
    expect(summaryRow('Total das saídas').getByText(/3\.049,00/)).toBeInTheDocument();

    // And last month's paid status never leaks: every copy arrives open
    expect(screen.getAllByText('Em aberto')).toHaveLength(2);
    expect(screen.queryByText('Pago')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Marcar como paga: Cartão guta' })).not.toBeChecked();

    // And the outflows tab is written back with June's copies and their references
    await expectOutflowsWritten((written) => {
      const juneOutflows = written.filter((entry) => entry.month === JUNE);
      return (
        juneOutflows.map((entry) => entry.name).sort().join(',') === 'Cartão guta,Luz' &&
        juneOutflows.every((entry) => !entry.isPaid) &&
        juneOutflows.some((entry) => entry.payerId === 'payer-guta' && entry.bankId === 'bank-itau')
      );
    });
  });

  it('hides the replicate button when last month has no outflows', () => {
    // Given May had no outflows at all
    // When June renders
    renderOutflows(`/outflows/${JUNE}`);

    // Then there is nothing to replicate
    expect(
      screen.queryByRole('button', { name: 'Replicar saídas do mês anterior' })
    ).not.toBeInTheDocument();
  });

  it('hides the replicate button once the month already has outflows, so it can never duplicate', () => {
    // Given June already has a outflow and May has one too
    renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: MAY, name: 'Luz', amount: 150 }),
      outflow({ month: JUNE, name: 'Internet', amount: 110 }),
    ]);

    // When June renders
    // Then there is no replicate affordance that could duplicate the list
    expect(
      screen.queryByRole('button', { name: 'Replicar saídas do mês anterior' })
    ).not.toBeInTheDocument();
  });

  it('re-reads the target month and blocks the copy when another member already replicated', async () => {
    // Given I see June as empty, but the sheet now holds a June outflow (another
    // member copied while my Working Copy was stale)
    renderOutflows(`/outflows/${JUNE}`, [outflow({ month: MAY, name: 'Luz', amount: 150 })]);
    vi.mocked(googleSheetsService.readOutflows).mockResolvedValue([
      outflow({ month: JUNE, name: 'Internet', amount: 110 }),
    ]);
    const user = userEvent.setup();

    // When I tap replicate
    await user.click(screen.getByRole('button', { name: 'Replicar saídas do mês anterior' }));

    // Then the sheet was re-read for this month, nothing was copied, and a
    // message explains why
    expect(googleSheetsService.readOutflows).toHaveBeenCalledWith('sheet-1');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este mês já tem registros. Nada foi copiado para não duplicar.'
    );
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();
    expect(writtenRecords(googleSheetsService, 'outflows')).toEqual([]);
  });

  it('blocks the copy and says so when the target month cannot be checked', async () => {
    // Given the re-read fails (offline or expired session)
    renderOutflows(`/outflows/${JUNE}`, [outflow({ month: MAY, name: 'Luz', amount: 150 })]);
    vi.mocked(googleSheetsService.readOutflows).mockRejectedValue(new Error('offline'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();

    // When I tap replicate
    await user.click(screen.getByRole('button', { name: 'Replicar saídas do mês anterior' }));

    // Then nothing is copied and a message explains that the check failed
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível verificar o mês antes de copiar. Nada foi copiado.'
    );
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();
    expect(writtenRecords(googleSheetsService, 'outflows')).toEqual([]);
    errorSpy.mockRestore();
  });

  it('cannot double-replicate when the copy button is tapped twice before the re-read settles', async () => {
    // Given an empty target month, a source outflow that is a duplicate by name, and
    // a re-read slow enough for a second tap to land inside the first
    const store = renderOutflows(`/outflows/${JUNE}`, [
      outflow({ month: MAY, name: 'Luz', amount: 150 }),
      outflow({ month: MAY, name: 'Luz', amount: 150 }),
    ]);
    let resolveRead: (value: Outflow[]) => void = () => {};
    vi.mocked(googleSheetsService.readOutflows).mockReturnValue(
      new Promise<Outflow[]>((resolve) => {
        resolveRead = resolve;
      })
    );
    const user = userEvent.setup();

    // When I tap replicate twice, both taps landing inside the same in-flight read
    const button = screen.getByRole('button', { name: 'Replicar saídas do mês anterior' });
    await user.click(button);
    await user.click(button);
    resolveRead([]);

    // Then the month was read once and exactly one set of copies was added; the
    // list settles on the two copied outflows (duplicates by name both survive)
    await waitFor(() => {
      expect(store.getState().outflows.items.filter((entry) => entry.month === JUNE)).toHaveLength(2);
    }, { timeout: 2500 });
    expect(googleSheetsService.readOutflows).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Luz')).toHaveLength(2);
    // Drain the debounced write this copy scheduled so it cannot leak into the
    // next test's write assertions.
    await waitFor(() => {
      expect(writtenRecords(googleSheetsService, 'outflows')).toHaveLength(2);
    }, { timeout: 2500 });
  });

  it('replicates from the currently browsed month, not the calendar month', async () => {
    // Given the current month has a outflow and the next month is empty
    renderOutflows(`/outflows/${CURRENT}`, [outflow({ month: CURRENT, name: 'Luz', amount: 150 })]);
    const user = userEvent.setup();

    // When I move to the next month and tap replicate
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Replicar saídas do mês anterior' }));

    // Then the copy lands in the month I am browsing
    expect(screen.getByText('Luz')).toBeInTheDocument();
    await expectOutflowsWritten((written) =>
      written.some(
        (entry) => entry.month === NEXT && entry.name === 'Luz' && entry.amount === 150 && !entry.isPaid
      )
    );
  });
});

describe('Month navigation', () => {
  it("shows each month's own outflows when navigating months", async () => {
    // Given June has a outflow and July is still empty
    renderOutflows(`/outflows/${JUNE}`, [outflow({ month: JUNE, name: 'Luz', amount: 150 })]);
    const user = userEvent.setup();
    expect(screen.getByText('Luz')).toBeInTheDocument();

    // When I go to the next month
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));

    // Then July shows its own (empty) outflows
    expect(screen.getByRole('heading', { name: 'julho de 2026' })).toBeInTheDocument();
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();
    expect(summary().getAllByText(/0,00/)).toHaveLength(3);
  });

});
