import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../config/i18n';
import i18n from '../../config/i18n';
import { googleSheetsService } from '../../services/GoogleSheetsService';
import cardsReducer from '../../store/cardsSlice';
import { syncListenerMiddleware } from '../../store/middleware/syncListener';
import planReducer from '../../store/planSlice';
import settingsReducer from '../../store/settingsSlice';
import type { Card, CardSpending, Month, PlanItem } from '../../types';
import { getCurrentMonth, shiftMonth } from '../../utils/month';
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

// Months are relative to the real "now" so past/current/future headline tests
// stay deterministic whenever the suite runs.
const CURRENT = getCurrentMonth();
const NEXT = shiftMonth(CURRENT, 1);
const PREVIOUS = shiftMonth(CURRENT, -1);

function planItem(
  overrides: Partial<PlanItem> & Pick<PlanItem, 'month' | 'kind' | 'name' | 'amount'>
): PlanItem {
  return { id: `${overrides.month}-${overrides.name}`, remainingEstimate: 0, ...overrides };
}

function card(id: string, name: string): Card {
  return { id, name };
}

function cardSpendingRow(month: Month, cardId: string, total: number): CardSpending {
  return { id: `${month}-${cardId}`, month, cardId, total };
}

/** Re-scope a set of plan items onto another month, as copy-last-month would. */
function forMonth(items: PlanItem[], month: Month): PlanItem[] {
  return items.map((item) => ({ ...item, month, id: `${month}-${item.name}` }));
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

interface RenderOptions {
  cards?: Card[];
  cardSpending?: CardSpending[];
}

/**
 * Renders the Spending Plan screen with a real store and the real debounced
 * sync middleware: only the sheets service boundary is mocked, so composition
 * and check-in changes are verified all the way to the write-back call (Seam B).
 */
function renderPlan(
  initialPath = `/plan/${JUNE}`,
  items: PlanItem[] = [],
  { cards = [], cardSpending = [] }: RenderOptions = {}
) {
  const store = configureStore({
    reducer: {
      cards: cardsReducer,
      plan: planReducer,
      settings: settingsReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(syncListenerMiddleware.middleware),
    preloadedState: {
      cards: { items: cards },
      plan: { items, cardSpending },
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

const summary = () => within(screen.getByRole('region', { name: 'Resumo do plano' }));
const headline = (name: string) => within(screen.getByRole('region', { name }));
const checkIn = () => within(screen.getByRole('region', { name: 'Check-in dos cartões' }));

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('pt-BR');
});

describe('Spending Plan composition', () => {
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
    expect(summary().getByText(/10\.750,00/)).toBeInTheDocument();
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
    expect(summary().getByText(/0,00/)).toBeInTheDocument();
  });
});

describe('Card check-in', () => {
  it('offers one current-total input per registered card', () => {
    // Given two registered cards
    // When the plan renders
    renderPlan(`/plan/${CURRENT}`, [], {
      cards: [card('c1', 'cc guta'), card('c2', 'cc uv')],
    });

    // Then each card has its own check-in input, and unregistered cards have none
    expect(screen.getByLabelText('Gasto do cartão cc guta')).toBeInTheDocument();
    expect(screen.getByLabelText('Gasto do cartão cc uv')).toBeInTheDocument();
    expect(screen.queryByLabelText('Gasto do cartão cc ml')).not.toBeInTheDocument();
  });

  it('records a card total, shows Total Spent so far, and updates the projection live', async () => {
    // Given the current month's plan caps 10.750 and a registered card
    renderPlan(`/plan/${CURRENT}`, [planItem({ month: CURRENT, kind: 'fixed', name: 'Seguro', amount: 10750 })], {
      cards: [card('c1', 'cc guta')],
    });
    const user = userEvent.setup();

    // When I enter the card's current total at check-in
    await user.type(screen.getByLabelText('Gasto do cartão cc guta'), '2899');

    // Then Total Spent is shown as the sum, labeled as so far
    expect(checkIn().getByText('Total gasto até agora')).toBeInTheDocument();
    expect(checkIn().getByText(/2\.899,00/)).toBeInTheDocument();

    // And the Projected Result drops by the same amount in the same render
    expect(headline('Resultado projetado').getByText(/7\.851,00/)).toBeInTheDocument();
  });

  it('persists card spending to the card_spending tab through the sync path', async () => {
    // Given a registered card and no check-in yet
    renderPlan(`/plan/${CURRENT}`, [], { cards: [card('c1', 'cc guta')] });
    const user = userEvent.setup();

    // When I enter the card's current total
    await user.type(screen.getByLabelText('Gasto do cartão cc guta'), '2899');

    // Then the card_spending tab is written back with that single entry
    await waitFor(
      () =>
        expect(googleSheetsService.writeCardSpending).toHaveBeenCalledWith('sheet-1', [
          expect.objectContaining({ month: CURRENT, cardId: 'c1', total: 2899 }),
        ]),
      { timeout: 2500 }
    );
  });

  it('overwrites a card total at the next check-in without keeping history', async () => {
    // Given cc guta already checked in at 100 this month
    renderPlan(`/plan/${CURRENT}`, [], {
      cards: [card('c1', 'cc guta')],
      cardSpending: [cardSpendingRow(CURRENT, 'c1', 100)],
    });
    const user = userEvent.setup();

    // When I overwrite it with the latest total
    const input = screen.getByLabelText('Gasto do cartão cc guta');
    await user.clear(input);
    await user.type(input, '250');

    // Then only the latest total is written — one row, no snapshot history
    await waitFor(() => {
      const calls = vi.mocked(googleSheetsService.writeCardSpending).mock.calls;
      const written = calls[calls.length - 1]?.[1] ?? [];
      expect(written).toHaveLength(1);
      expect(written[0]).toMatchObject({ month: CURRENT, cardId: 'c1', total: 250 });
    }, { timeout: 2500 });
  });

  it('reproduces the June sobra trace on the live projection', () => {
    // Given June's real plan (10.750) and check-in totals (2.899 + 9.432 + 473)
    // with restaurante still estimated at 250
    renderPlan(`/plan/${NEXT}`, forMonth(junePlan, NEXT), {
      cardSpending: [
        cardSpendingRow(NEXT, 'guta', 2899),
        cardSpendingRow(NEXT, 'uv', 9432),
        cardSpendingRow(NEXT, 'ml', 473),
      ],
    });

    // Then Total Spent is labeled so far and sums to 12.804
    expect(checkIn().getByText('Total gasto até agora')).toBeInTheDocument();
    expect(checkIn().getByText(/12\.804,00/)).toBeInTheDocument();

    // And the sobra lands exactly at 10.750 − 12.804 − 250 = −2.304, shown red
    const value = headline('Resultado projetado').getByText(/2\.304,00/);
    expect(value).toHaveTextContent('-R$');
    expect(value).toHaveClass('text-red-600');
  });
});

describe('Remaining estimates', () => {
  it('offers a remaining-estimate input only for spending buckets', () => {
    // Given a bucket and a fixed charge
    renderPlan(`/plan/${NEXT}`, [
      planItem({ month: NEXT, kind: 'variable', name: 'Mercado', amount: 6000 }),
      planItem({ month: NEXT, kind: 'fixed', name: 'Internet', amount: 110 }),
    ]);

    // Then only the bucket can be re-estimated
    expect(screen.getByLabelText('Restante estimado — Mercado')).toBeInTheDocument();
    expect(screen.queryByLabelText('Restante estimado — Internet')).not.toBeInTheDocument();
  });

  it("edits a bucket's remaining estimate, updating the projection live and the plan tab", async () => {
    // Given a 1.500 plan with nothing spent and restaurante still to be estimated
    renderPlan(`/plan/${NEXT}`, [
      planItem({ month: NEXT, kind: 'variable', name: 'Restaurante', amount: 1000 }),
      planItem({ month: NEXT, kind: 'fixed', name: 'Internet', amount: 500 }),
    ]);
    const user = userEvent.setup();
    expect(headline('Resultado projetado').getByText(/1\.500,00/)).toBeInTheDocument();

    // When I enter what is still expected until month end
    await user.type(screen.getByLabelText('Restante estimado — Restaurante'), '250');

    // Then the projection drops by the estimate in the same render
    expect(headline('Resultado projetado').getByText(/1\.250,00/)).toBeInTheDocument();

    // And the plan tab carries the new estimate
    await waitFor(
      () =>
        expect(googleSheetsService.writePlanItems).toHaveBeenCalledWith('sheet-1', [
          expect.objectContaining({ name: 'Restaurante', remainingEstimate: 250 }),
          expect.objectContaining({ name: 'Internet' }),
        ]),
      { timeout: 2500 }
    );
  });
});

describe('Result headline', () => {
  it('shows the Projected Result for the current month, green when inside the plan', () => {
    // Given the current month is inside its plan
    renderPlan(`/plan/${CURRENT}`, [
      planItem({ month: CURRENT, kind: 'variable', name: 'Mercado', amount: 6000 }),
      planItem({ month: CURRENT, kind: 'fixed', name: 'Internet', amount: 500 }),
    ]);

    // When I look at the headline
    // Then it is the Projected Result, not the Plan Result, and it is green
    expect(screen.getByRole('region', { name: 'Resultado projetado' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Resultado do plano' })).not.toBeInTheDocument();
    expect(headline('Resultado projetado').getByText(/6\.500,00/)).toHaveClass('text-green-600');
  });

  it('shows the Projected Result red when the month is over plan', () => {
    // Given the current month has already spent past its plan
    renderPlan(`/plan/${CURRENT}`, [planItem({ month: CURRENT, kind: 'fixed', name: 'Seguro', amount: 1000 })], {
      cards: [card('c1', 'cc guta')],
      cardSpending: [cardSpendingRow(CURRENT, 'c1', 1300)],
    });

    // When I look at the headline
    // Then the over-plan sobra is red
    const value = headline('Resultado projetado').getByText(/300,00/);
    expect(value).toHaveTextContent('-R$');
    expect(value).toHaveClass('text-red-600');
  });

  it('shows the Plan Result as the headline for past months, not the projection', () => {
    // Given last month's plan (1.310) closed at 500 spent, with a stale 250 estimate left behind
    renderPlan(
      `/plan/${PREVIOUS}`,
      [
        planItem({
          month: PREVIOUS,
          kind: 'variable',
          name: 'Restaurante',
          amount: 1200,
          remainingEstimate: 250,
        }),
        planItem({ month: PREVIOUS, kind: 'fixed', name: 'Internet', amount: 110 }),
      ],
      { cardSpending: [cardSpendingRow(PREVIOUS, 'c1', 500)] }
    );

    // When I browse that past month
    // Then the headline is the Plan Result (1.310 − 500), never the stale projection
    expect(screen.getByRole('region', { name: 'Resultado do plano' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Resultado projetado' })).not.toBeInTheDocument();
    expect(headline('Resultado do plano').getByText(/810,00/)).toBeInTheDocument();
    expect(headline('Resultado do plano').queryByText(/560,00/)).not.toBeInTheDocument();
  });
});
