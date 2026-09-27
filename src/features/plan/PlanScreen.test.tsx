import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../config/i18n';
import i18n from '../../config/i18n';
import { googleSheetsService } from '../../services/GoogleSheetsService';
import { syncListenerMiddleware } from '../../store/middleware/syncListener';
import planReducer from '../../store/planSlice';
import settingsReducer from '../../store/settingsSlice';
import type { PlanItem } from '../../types';
import PlanScreen from './PlanScreen';

vi.mock('../../services/GoogleSheetsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/GoogleSheetsService')>();
  return {
    ...actual,
    googleSheetsService: {
      ...actual.googleSheetsService,
      writePlanItems: vi.fn(),
      writeCardSpending: vi.fn(),
    },
  };
});

const JUNE = '2026-06';
const MAY = '2026-05';
const JULY = '2026-07';

function planItem(
  overrides: Partial<PlanItem> & Pick<PlanItem, 'month' | 'kind' | 'name' | 'amount'>
): PlanItem {
  return { id: `${overrides.month}-${overrides.name}`, remainingEstimate: 0, ...overrides };
}

/** The real June 2026 historical plan: buckets 9.000 + fixed charges 1.750 = 10.750. */
const junePlan: PlanItem[] = [
  planItem({ month: JUNE, kind: 'variable', name: 'Mercado/Farmácia', amount: 6000 }),
  planItem({ month: JUNE, kind: 'variable', name: 'Transporte', amount: 800 }),
  planItem({ month: JUNE, kind: 'variable', name: 'Restaurante', amount: 1200, remainingEstimate: 250 }),
  planItem({ month: JUNE, kind: 'variable', name: 'Compras', amount: 1000 }),
  planItem({ month: JUNE, kind: 'fixed', name: 'Internet', amount: 110 }),
  planItem({ month: JUNE, kind: 'fixed', name: 'Streaming', amount: 90 }),
  planItem({ month: JUNE, kind: 'fixed', name: 'Gym', amount: 200 }),
  planItem({ month: JUNE, kind: 'fixed', name: 'Seguro do carro', amount: 1350 }),
];

/**
 * Renders the Spending Plan screen with a real store and the real debounced
 * sync middleware: only the sheets service boundary is mocked, so composition
 * changes are verified all the way to the write-back call (Seam B).
 */
function renderPlan(initialPath = `/plan/${JUNE}`, items: PlanItem[] = []) {
  const store = configureStore({
    reducer: { plan: planReducer, settings: settingsReducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(syncListenerMiddleware.middleware),
    preloadedState: {
      plan: { items, cardSpending: [] },
      settings: { sheetId: 'sheet-1' },
    },
  });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/plan/:month" element={<PlanScreen />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

  return store;
}

describe('Spending Plan composition', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('pt-BR');
  });

  it("lists the month's fixed charges and spending buckets", () => {
    // Given June's plan holds fixed charges and spending buckets
    // When the plan renders
    renderPlan(`/plan/${JUNE}`, junePlan);

    // Then both kinds are listed under their own headings
    expect(screen.getByText('Cobranças fixas')).toBeInTheDocument();
    expect(screen.getByText('Tetos de gastos')).toBeInTheDocument();
    expect(screen.getByText('Internet')).toBeInTheDocument();
    expect(screen.getByText('Mercado/Farmácia')).toBeInTheDocument();
  });

  it('shows the plan total computed from the items', () => {
    // Given the real June plan summing 10.750
    renderPlan(`/plan/${JUNE}`, junePlan);

    // When I look at the total
    // Then it is the sum of every fixed charge and bucket cap
    expect(screen.getByText('Total do plano')).toBeInTheDocument();
    expect(screen.getByText(/10\.750,00/)).toBeInTheDocument();
  });

  it('adds a fixed charge and writes the plan back to the sheet', async () => {
    // Given June has no plan yet
    renderPlan(`/plan/${JUNE}`);
    const user = userEvent.setup();

    // When I add a fixed charge
    await user.type(screen.getByLabelText('Nome da cobrança'), 'Netflix');
    await user.type(screen.getByLabelText('Valor da cobrança'), '44.90');
    await user.click(screen.getByRole('button', { name: 'Adicionar cobrança fixa' }));

    // Then it is listed
    expect(screen.getByText('Netflix')).toBeInTheDocument();

    // And the plan tab is written back with the new item
    await waitFor(
      () =>
        expect(googleSheetsService.writePlanItems).toHaveBeenCalledWith('sheet-1', [
          expect.objectContaining({
            month: JUNE,
            kind: 'fixed',
            name: 'Netflix',
            amount: 44.9,
            remainingEstimate: 0,
          }),
        ]),
      { timeout: 2500 }
    );
  });

  it('adds a spending bucket and writes the plan back to the sheet', async () => {
    // Given June has no plan yet
    renderPlan(`/plan/${JUNE}`);
    const user = userEvent.setup();

    // When I add a spending bucket
    await user.type(screen.getByLabelText('Nome do teto'), 'Pets');
    await user.type(screen.getByLabelText('Limite do teto'), '300');
    await user.click(screen.getByRole('button', { name: 'Adicionar teto de gastos' }));

    // Then it is listed
    expect(screen.getByText('Pets')).toBeInTheDocument();

    // And the plan tab is written back with the new bucket at zero estimate
    await waitFor(
      () =>
        expect(googleSheetsService.writePlanItems).toHaveBeenCalledWith('sheet-1', [
          expect.objectContaining({
            month: JUNE,
            kind: 'variable',
            name: 'Pets',
            amount: 300,
            remainingEstimate: 0,
          }),
        ]),
      { timeout: 2500 }
    );
  });

  it('does not add an item without a name and a valid amount', async () => {
    // Given June has no plan yet
    renderPlan(`/plan/${JUNE}`);
    const user = userEvent.setup();
    const addButton = screen.getByRole('button', { name: 'Adicionar cobrança fixa' });

    // When the form is incomplete
    expect(addButton).toBeDisabled();

    await user.type(screen.getByLabelText('Nome da cobrança'), 'Netflix');
    expect(addButton).toBeDisabled();

    await user.type(screen.getByLabelText('Valor da cobrança'), 'abc');
    expect(addButton).toBeDisabled();

    // And only becomes submittable once both fields are valid
    await user.clear(screen.getByLabelText('Valor da cobrança'));
    await user.type(screen.getByLabelText('Valor da cobrança'), '44');
    expect(addButton).toBeEnabled();
  });

  it('edits an item and writes the plan back to the sheet', async () => {
    // Given June's plan has an Internet fixed charge
    renderPlan(`/plan/${JUNE}`, [
      planItem({ month: JUNE, kind: 'fixed', name: 'Internet', amount: 110 }),
    ]);
    const user = userEvent.setup();

    // When I edit its name and amount
    await user.click(screen.getByRole('button', { name: 'Editar Internet' }));
    const nameInput = screen.getByLabelText('Nome do item');
    await user.clear(nameInput);
    await user.type(nameInput, 'Internet fibra');
    const amountInput = screen.getByLabelText('Valor do item');
    await user.clear(amountInput);
    await user.type(amountInput, '120');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    // Then the updated item is shown
    expect(screen.getByText('Internet fibra')).toBeInTheDocument();
    expect(screen.queryByText('Internet')).not.toBeInTheDocument();

    // And the plan tab is written back with the edit
    await waitFor(
      () =>
        expect(googleSheetsService.writePlanItems).toHaveBeenCalledWith('sheet-1', [
          expect.objectContaining({ name: 'Internet fibra', amount: 120 }),
        ]),
      { timeout: 2500 }
    );
  });

  it('removes an item and writes the plan back to the sheet', async () => {
    // Given June's plan has an Internet and a Gym fixed charge
    renderPlan(`/plan/${JUNE}`, [
      planItem({ month: JUNE, kind: 'fixed', name: 'Internet', amount: 110 }),
      planItem({ month: JUNE, kind: 'fixed', name: 'Gym', amount: 200 }),
    ]);
    const user = userEvent.setup();

    // When I remove the Internet charge
    await user.click(screen.getByRole('button', { name: 'Remover Internet' }));

    // Then it is gone from the plan
    expect(screen.queryByText('Internet')).not.toBeInTheDocument();
    expect(screen.getByText('Gym')).toBeInTheDocument();

    // And the plan tab is written back without it
    await waitFor(
      () =>
        expect(googleSheetsService.writePlanItems).toHaveBeenCalledWith('sheet-1', [
          expect.objectContaining({ name: 'Gym' }),
        ]),
      { timeout: 2500 }
    );
  });

  it("copies last month's composition into an empty month, zeroing the estimates", async () => {
    // Given May's plan carries a remaining estimate and June is still empty
    renderPlan(`/plan/${JUNE}`, [
      planItem({
        month: MAY,
        kind: 'variable',
        name: 'Restaurante',
        amount: 1200,
        remainingEstimate: 250,
      }),
      planItem({ month: MAY, kind: 'fixed', name: 'Internet', amount: 110 }),
    ]);
    const user = userEvent.setup();

    // When I tap copy last month
    await user.click(screen.getByRole('button', { name: 'Copiar plano do mês anterior' }));

    // Then June shows May's buckets and fixed charges
    expect(screen.getByText('Restaurante')).toBeInTheDocument();
    expect(screen.getByText('Internet')).toBeInTheDocument();

    // And the plan tab is written back with June's copies at zero estimate —
    // never the card totals, which belong to a different tab
    await waitFor(() => {
      const calls = vi.mocked(googleSheetsService.writePlanItems).mock.calls;
      const written = calls[calls.length - 1]?.[1] ?? [];
      const juneItems = written.filter((item) => item.month === JUNE);
      expect(juneItems.map((item) => item.name).sort()).toEqual(['Internet', 'Restaurante']);
      expect(juneItems.every((item) => item.remainingEstimate === 0)).toBe(true);
    }, { timeout: 2500 });
    expect(googleSheetsService.writeCardSpending).not.toHaveBeenCalled();
  });

  it('hides the copy button when last month has no plan', () => {
    // Given May had no plan at all
    // When June renders
    renderPlan(`/plan/${JUNE}`);

    // Then there is nothing to copy
    expect(
      screen.queryByRole('button', { name: 'Copiar plano do mês anterior' })
    ).not.toBeInTheDocument();
  });

  it('hides the copy button once the month already has a plan, so it can never duplicate', () => {
    // Given June already has a plan and May has one too
    renderPlan(`/plan/${JUNE}`, [
      planItem({ month: MAY, kind: 'fixed', name: 'Internet', amount: 110 }),
      planItem({ month: JUNE, kind: 'fixed', name: 'Gym', amount: 200 }),
    ]);

    // When June renders
    // Then there is no copy affordance that could duplicate its composition
    expect(
      screen.queryByRole('button', { name: 'Copiar plano do mês anterior' })
    ).not.toBeInTheDocument();
  });

  it("shows each month's own composition when navigating months", async () => {
    // Given June has a plan and July is still empty
    renderPlan(`/plan/${JUNE}`, [
      planItem({ month: JUNE, kind: 'fixed', name: 'Internet', amount: 110 }),
    ]);
    const user = userEvent.setup();
    expect(screen.getByText('Internet')).toBeInTheDocument();

    // When I go to the next month
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));

    // Then July shows its own (empty) composition
    expect(screen.getByRole('heading', { name: 'julho de 2026' })).toBeInTheDocument();
    expect(screen.queryByText('Internet')).not.toBeInTheDocument();

    // When I go back to June
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }));

    // Then June's composition is back
    expect(screen.getByRole('heading', { name: 'junho de 2026' })).toBeInTheDocument();
    expect(screen.getByText('Internet')).toBeInTheDocument();

    // And the other month key is not shown on this screen
    expect(screen.queryByText('julho de 2026')).not.toBeInTheDocument();
  });

  it('is empty until items are added, with a zero plan total', () => {
    // Given June has no plan
    // When the plan renders
    renderPlan(`/plan/${JULY}`);

    // Then the empty state and a zero total are shown
    expect(screen.getByText('Os itens do plano deste mês aparecerão aqui.')).toBeInTheDocument();
    expect(screen.getByText(/0,00/)).toBeInTheDocument();
  });
});
