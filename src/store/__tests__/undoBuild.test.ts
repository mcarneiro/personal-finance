import { describe, expect, it } from 'vitest';
import type {
  Card,
  CardSpending,
  IncomeEntry,
  Outflow,
  PlanItem,
  SavingsBalance,
  SavingsPot,
} from '../../types';
import { deleteCard, updateCard } from '../cardsSlice';
import { addOutflow, addOutflows, deleteOutflow, toggleOutflowPaid, updateOutflow } from '../outflowsSlice';
import { addPlanItems, setCardSpendingTotal } from '../planSlice';
import { addIncomeEntries } from '../incomeSlice';
import { upsertSavingsBalance } from '../savingsSlice';
import { buildUndoEntry, type UndoSourceState } from '../undoBuild';

const CARD: Card = { id: 'card-1', name: 'Visa' };
const POT: SavingsPot = { id: 'pot-1', name: 'Emergência' };

const OUTFLOW: Outflow = {
  id: 'outflow-1',
  month: '2026-06',
  name: 'Luz',
  amount: 180,
  isPaid: false,
  isFinal: true,
  isInvestment: false,
  payerId: 'payer-1',
  bankId: 'bank-1',
};

const PLAN_ITEM: PlanItem = {
  id: 'plan-1',
  month: '2026-06',
  name: 'Mercado',
  amount: 900,
  remainingEstimate: 0,
};

const INCOME: IncomeEntry = {
  id: 'income-1',
  month: '2026-06',
  amount: 5000,
  source: 'Salário',
};

const BALANCE: SavingsBalance = {
  id: '2026-06-pot-1',
  month: '2026-06',
  potId: 'pot-1',
  balance: 10000,
};

/** A state with every undoable slice present, so a test only states its own data. */
function sourceState(overrides: Partial<UndoSourceState> = {}): UndoSourceState {
  return {
    cards: { items: [] },
    banks: { items: [] },
    payers: { items: [] },
    plan: { items: [], cardSpending: [] },
    outflows: { items: [] },
    income: { items: [] },
    savings: { items: [], balances: [] },
    ...overrides,
  };
}

describe('buildUndoEntry', () => {
  it('restores the prior record when an outflow is edited', () => {
    // Given a saved outflow
    const before = sourceState({ outflows: { items: [OUTFLOW] } });

    // When it is edited
    const entry = buildUndoEntry(updateOutflow({ ...OUTFLOW, amount: 999 }), before);

    // Then undo carries the old amount back
    expect(entry?.steps).toEqual([
      { tab: 'outflows', change: { kind: 'restore', record: OUTFLOW } },
    ]);
    expect(entry?.bulk).toBeNull();
  });

  it('removes the record when a new outflow is created', () => {
    // Given a month without the outflow
    const before = sourceState();

    // When the outflow is added
    const entry = buildUndoEntry(addOutflow(OUTFLOW), before);

    // Then undo removes the created record
    expect(entry?.steps).toEqual([
      { tab: 'outflows', change: { kind: 'remove', record: OUTFLOW } },
    ]);
  });

  it('restores a deleted outflow with the same id', () => {
    // Given a saved outflow
    const before = sourceState({ outflows: { items: [OUTFLOW] } });

    // When it is deleted
    const entry = buildUndoEntry(deleteOutflow(OUTFLOW.id), before);

    // Then undo restores the exact record
    expect(entry?.steps).toEqual([
      { tab: 'outflows', change: { kind: 'restore', record: OUTFLOW } },
    ]);
  });

  it('restores the prior paid flag when it is toggled', () => {
    // Given an open outflow
    const before = sourceState({ outflows: { items: [OUTFLOW] } });

    // When it is marked paid
    const entry = buildUndoEntry(toggleOutflowPaid(OUTFLOW.id), before);

    // Then undo restores the open state
    expect(entry?.steps).toEqual([
      { tab: 'outflows', change: { kind: 'restore', record: OUTFLOW } },
    ]);
  });

  it('treats replicate-last-month as one bulk step', () => {
    // Given an empty month and three replicated outflows
    const before = sourceState();
    const copies = [
      { ...OUTFLOW, id: 'copy-1' },
      { ...OUTFLOW, id: 'copy-2' },
      { ...OUTFLOW, id: 'copy-3' },
    ];

    // When they are added in one action
    const entry = buildUndoEntry(addOutflows(copies), before);

    // Then one entry removes all three
    expect(entry?.bulk).toBe('outflows');
    expect(entry?.count).toBe(3);
    expect(entry?.steps).toEqual(
      copies.map((record) => ({ tab: 'outflows', change: { kind: 'remove', record } }))
    );
  });

  it('treats both other bulk copies as one step with their own noun', () => {
    // Given empty months and copied plan buckets and income entries
    const before = sourceState();

    // When each copy action runs once
    const planEntry = buildUndoEntry(addPlanItems([PLAN_ITEM]), before);
    const incomeEntry = buildUndoEntry(addIncomeEntries([INCOME]), before);

    // Then each is one bulk step named after its screen
    expect(planEntry?.bulk).toBe('plan');
    expect(planEntry?.count).toBe(1);
    expect(incomeEntry?.bulk).toBe('income');
    expect(incomeEntry?.count).toBe(1);
  });

  it('does not offer undo when an edit changes nothing', () => {
    // Given a saved outflow and an edit that repeats its value
    const before = sourceState({ outflows: { items: [OUTFLOW] } });

    // When the identical record is saved again
    const entry = buildUndoEntry(updateOutflow({ ...OUTFLOW }), before);

    // Then there is nothing to undo
    expect(entry).toBeNull();
  });

  it('undoes a first card check-in by clearing the total', () => {
    // Given a card with no total recorded this month
    const before = sourceState({ cards: { items: [CARD] } });

    // When the first total is typed
    const entry = buildUndoEntry(
      setCardSpendingTotal({ month: '2026-06', cardId: CARD.id, total: 450 }),
      before
    );

    // Then undo clears that row rather than restoring a made-up value
    const created: CardSpending = {
      id: '2026-06-card-1',
      month: '2026-06',
      cardId: CARD.id,
      total: 450,
    };
    expect(entry?.steps).toEqual([
      { tab: 'card_spending', change: { kind: 'remove', record: created } },
    ]);
  });

  it('restores the prior savings balance when one is overwritten', () => {
    // Given a recorded balance
    const before = sourceState({ savings: { items: [POT], balances: [BALANCE] } });

    // When the balance is typed again
    const entry = buildUndoEntry(
      upsertSavingsBalance({ month: '2026-06', potId: POT.id, balance: 12000 }),
      before
    );

    // Then undo restores the observed value
    expect(entry?.steps).toEqual([
      { tab: 'savings_balances', change: { kind: 'restore', record: BALANCE } },
    ]);
  });

  it('ignores a delete of a record that is already gone', () => {
    // Given a registry without the card
    const before = sourceState();

    // When a stale delete arrives
    const entry = buildUndoEntry(deleteCard('missing'), before);

    // Then there is no undo entry to show
    expect(entry).toBeNull();
  });

  it('restores a renamed registry entry', () => {
    // Given a saved card
    const before = sourceState({ cards: { items: [CARD] } });

    // When it is renamed
    const entry = buildUndoEntry(updateCard({ ...CARD, name: 'Master' }), before);

    // Then undo restores the old name
    expect(entry?.steps).toEqual([
      { tab: 'cards', change: { kind: 'restore', record: CARD } },
    ]);
  });
});
