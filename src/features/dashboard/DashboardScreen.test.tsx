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
import cardsReducer from '../../store/cardsSlice';
import incomeReducer from '../../store/incomeSlice';
import { syncListenerMiddleware } from '../../store/middleware/syncListener';
import payersReducer from '../../store/payersSlice';
import pendingReducer from '../../store/pendingSlice';
import planReducer from '../../store/planSlice';
import settingsReducer from '../../store/settingsSlice';
import { writtenRecords } from '../../test/pendingWrites';
import type { Outflow, CardSpending, IncomeEntry, PlanItem } from '../../types';
import DashboardScreen from './DashboardScreen';

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
// Mid-June: the month reads 50% elapsed.
const NOW = new Date(2026, 5, 15, 12, 0, 0);

function planItem(name: string, amount: number, month = JUNE): PlanItem {
  return { id: `${month}-${name}`, month, name, amount, remainingEstimate: 0 };
}

function cardTotal(cardId: string, total: number, month = JUNE): CardSpending {
  return { id: `${month}-${cardId}`, month, cardId, total };
}

function outflow(overrides: Partial<Outflow> & Pick<Outflow, 'id' | 'name' | 'amount'>): Outflow {
  return { month: JUNE, isPaid: false, isFinal: true, payerId: '', bankId: '', ...overrides };
}

function incomeEntry(amount: number, source?: string, month = JUNE): IncomeEntry {
  return { id: `${month}-${source ?? amount}`, month, amount, source };
}

interface DashboardData {
  planItems?: PlanItem[];
  cardSpending?: CardSpending[];
  outflows?: Outflow[];
  income?: IncomeEntry[];
}

/**
 * Renders the Dashboard with a real store and the real debounced sync
 * middleware; only the Sheets boundary is mocked, so toggling a outflow paid is
 * verified all the way to the write-back (as on the Outflows screen).
 */
function renderDashboard(data: DashboardData = {}) {
  const store = configureStore({
    reducer: {
      cards: cardsReducer,
      banks: banksReducer,
      payers: payersReducer,
      plan: planReducer,
      outflows: outflowsReducer,
      income: incomeReducer,
      settings: settingsReducer,
      pending: pendingReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(syncListenerMiddleware.middleware),
    preloadedState: {
      plan: { items: data.planItems ?? [], cardSpending: data.cardSpending ?? [] },
      outflows: { items: data.outflows ?? [] },
      income: { items: data.income ?? [] },
      settings: { sheetId: 'sheet-1' },
    },
  });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<DashboardScreen now={NOW} />} />
          <Route path="/income/:month" element={<p>Tela da renda</p>} />
          <Route path="/outflows/:month" element={<p>Tela de saídas</p>} />
          <Route path="/plan/:month" element={<p>Tela do plano</p>} />
          <Route path="/outflows/edit/:id" element={<p>Editor da saída</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

  return store;
}

/** The plan bar's coloured fill, for asserting the pace colour binding. */
function planFill(): HTMLElement {
  const bar = screen.getByRole('progressbar', { name: 'Total gasto até agora' });
  return bar.firstElementChild as HTMLElement;
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('pt-BR');
});

describe('Dashboard — month', () => {
  it('labels the current month', () => {
    // Given the Dashboard opens in June 2026
    renderDashboard();

    // Then the month is named so "current month only" is unambiguous
    expect(screen.getByText('junho de 2026')).toBeInTheDocument();
  });
});

describe('Dashboard — income / outcome', () => {
  it('hides the block when the month has neither income nor outflows', () => {
    // Given an empty month
    renderDashboard();

    // Then there is no cash-flow picture to show, only the good-news outflows block
    expect(screen.queryByRole('region', { name: 'Renda e saídas' })).not.toBeInTheDocument();
  });

  it('shows income and outflows as bars on a shared scale with the account net', () => {
    // Given 12.000 of income and 3.000 of outflows
    renderDashboard({
      income: [incomeEntry(12000, 'Salário')],
      outflows: [outflow({ id: 'b1', name: 'Luz', amount: 3000 })],
    });

    // Then both bars, their amounts and the net are shown, income filling the scale
    expect(screen.getByRole('region', { name: 'Renda e saídas' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Total da renda' })).toHaveAttribute(
      'aria-valuenow',
      '100'
    );
    expect(screen.getByRole('progressbar', { name: 'Total das saídas' })).toHaveAttribute(
      'aria-valuenow',
      '25'
    );
    expect(screen.getByText('Saldo da conta')).toBeInTheDocument();
    expect(screen.getByText(/9\.000,00/)).toBeInTheDocument();
  });

  it('opens the income and outflows screens from their bars', async () => {
    // Given a month with income and outflows
    const user = userEvent.setup();
    renderDashboard({
      income: [incomeEntry(12000, 'Salário')],
      outflows: [outflow({ id: 'b1', name: 'Luz', amount: 3000 })],
    });

    // When I tap the income bar
    await user.click(screen.getByRole('button', { name: 'Ver renda do mês' }));
    // Then the income screen opens
    expect(screen.getByText('Tela da renda')).toBeInTheDocument();
  });
});

describe('Dashboard — Spending Plan', () => {
  it('hides the block when the month has no plan', () => {
    // Given a month with no Spending Plan
    renderDashboard({ income: [incomeEntry(12000, 'Salário')] });

    // Then there is nothing to pace against
    expect(screen.queryByRole('progressbar', { name: 'Total gasto até agora' })).not.toBeInTheDocument();
  });

  it('shows the plan total and spend without a callout when under pace', () => {
    // Given a 1.000 plan and 100 spent by mid-June
    renderDashboard({
      planItems: [planItem('Mercado', 1000)],
      cardSpending: [cardTotal('card-1', 100)],
    });

    // Then the totals show and the bar is a tenth full, green, with no callout
    expect(screen.getByText('Total do plano')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Total gasto até agora' })).toHaveAttribute(
      'aria-valuenow',
      '10'
    );
    expect(planFill()).toHaveClass('bg-green-500');
    expect(screen.queryByText(/acima do plano/)).not.toBeInTheDocument();
    expect(screen.queryByText(/antes do teto do plano/)).not.toBeInTheDocument();
  });

  it('warns with the headroom when spend runs ahead of the month', () => {
    // Given a 1.000 plan and 800 spent by mid-June (80% spent, 50% through)
    renderDashboard({
      planItems: [planItem('Mercado', 1000)],
      cardSpending: [cardTotal('card-1', 800)],
    });

    // Then the yellow callout names the money still left before the ceiling
    expect(planFill()).toHaveClass('bg-amber-500');
    expect(screen.getByText(/200,00 restantes antes do teto do plano/)).toBeInTheDocument();
  });

  it('caps the bar and names the overage once spend passes the plan', () => {
    // Given a 1.000 plan and 1.100 spent
    renderDashboard({
      planItems: [planItem('Mercado', 1000)],
      cardSpending: [cardTotal('card-1', 1100)],
    });

    // Then the bar is full and red, and the callout names the 100 over
    expect(screen.getByRole('progressbar', { name: 'Total gasto até agora' })).toHaveAttribute(
      'aria-valuenow',
      '100'
    );
    expect(planFill()).toHaveClass('bg-red-600');
    expect(screen.getByText(/100,00 acima do plano/)).toBeInTheDocument();
  });

  it('opens the plan from the over-plan callout', async () => {
    // Given a month over plan
    const user = userEvent.setup();
    renderDashboard({
      planItems: [planItem('Mercado', 1000)],
      cardSpending: [cardTotal('card-1', 1100)],
    });

    // When I tap the callout
    await user.click(screen.getByText(/acima do plano/));
    // Then the plan screen opens
    expect(screen.getByText('Tela do plano')).toBeInTheDocument();
  });
});

describe('Dashboard — open outflows', () => {
  it('lists only the current month\'s open outflows, final first then alphabetical', () => {
    // Given a paid outflow, a not-final outflow, two final outflows and an open outflow last month
    renderDashboard({
      outflows: [
        outflow({ id: 'paid', name: 'Internet', amount: 100, isPaid: true }),
        outflow({ id: 'nofinal', name: 'Zulu', amount: 10, isFinal: false }),
        outflow({ id: 'agua', name: 'Água', amount: 90 }),
        outflow({ id: 'luz', name: 'Luz', amount: 100 }),
        outflow({ id: 'may', name: 'Conta de maio', amount: 50, month: MAY }),
      ],
    });

    // Then only the open June outflows remain, final ones first and alphabetical
    const rows = screen
      .getAllByRole('button', { name: /^Editar / })
      .map((row) => row.getAttribute('aria-label'));
    expect(rows).toEqual(['Editar Água', 'Editar Luz', 'Editar Zulu']);
    expect(screen.queryByText('Internet')).not.toBeInTheDocument();
    expect(screen.queryByText('Conta de maio')).not.toBeInTheDocument();
  });

  it('marks a outflow paid and removes it from the Dashboard', async () => {
    // Given June has one open outflow
    const user = userEvent.setup();
    renderDashboard({ outflows: [outflow({ id: 'luz', name: 'Luz', amount: 100 })] });

    // When I tick it as paid
    await user.click(screen.getByRole('checkbox', { name: 'Marcar como paga: Luz' }));

    // Then the row leaves the Dashboard immediately
    expect(screen.queryByText('Luz')).not.toBeInTheDocument();

    // And the change is written back to the outflows tab
    await waitFor(
      () => {
        const toggled = writtenRecords(googleSheetsService, 'outflows').find(
          (record) => record.id === 'luz'
        );
        expect(toggled?.isPaid).toBe(true);
      },
      { timeout: 2500 }
    );
  });

  it('opens the outflow editor when a row is tapped', async () => {
    // Given June has an open outflow
    const user = userEvent.setup();
    renderDashboard({ outflows: [outflow({ id: 'luz', name: 'Luz', amount: 100 })] });

    // When I tap the row
    await user.click(screen.getByRole('button', { name: 'Editar Luz' }));

    // Then its full-screen editor opens
    expect(screen.getByText('Editor da saída')).toBeInTheDocument();
  });

  it('always shows the block, celebrating when nothing is left to pay', () => {
    // Given June has no open outflows (a paid one only)
    renderDashboard({
      outflows: [outflow({ id: 'paid', name: 'Internet', amount: 100, isPaid: true })],
    });

    // Then the block is present with the good-news message
    expect(screen.getByRole('region', { name: 'Saídas em aberto' })).toBeInTheDocument();
    expect(screen.getByText('Uau! Nada mais para pagar! 🎉')).toBeInTheDocument();
  });

  it('opens the full outflows screen from the block header', async () => {
    // Given June has an open outflow
    const user = userEvent.setup();
    renderDashboard({ outflows: [outflow({ id: 'luz', name: 'Luz', amount: 100 })] });

    // When I tap the block header
    await user.click(screen.getByRole('button', { name: 'Saídas em aberto' }));

    // Then the Outflows screen opens
    expect(screen.getByText('Tela de saídas')).toBeInTheDocument();
  });

  it('shows payer and bank with fallbacks for unset references', () => {
    // Given an open outflow with no payer or bank
    renderDashboard({ outflows: [outflow({ id: 'luz', name: 'Luz', amount: 100 })] });

    // Then the reference line reads the unassigned fallbacks
    expect(screen.getByText('Sem responsável · Sem banco')).toBeInTheDocument();
  });
});

describe('Dashboard — full picture', () => {
  it('shows the month with all three blocks together', () => {
    // Given a month with income, a plan, card spending and open outflows
    renderDashboard({
      income: [incomeEntry(12000, 'Salário')],
      planItems: [planItem('Mercado', 1000)],
      cardSpending: [cardTotal('card-1', 800)],
      outflows: [outflow({ id: 'luz', name: 'Luz', amount: 300 })],
    });

    // Then each block's region is present
    expect(screen.getByRole('region', { name: 'Renda e saídas' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Plano de Gastos' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Saídas em aberto' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Saídas em aberto' })).getByText('Luz')).toBeInTheDocument();
  });
});
