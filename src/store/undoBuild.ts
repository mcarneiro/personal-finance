import type { UnknownAction } from '@reduxjs/toolkit';
import type {
  Bank,
  Card,
  CardSpending,
  IncomeEntry,
  Outflow,
  Payer,
  PlanItem,
  SavingsBalance,
  SavingsPot,
} from '../types';
import { addCard, deleteCard, updateCard } from './cardsSlice';
import { addBank, deleteBank, updateBank } from './banksSlice';
import { addPayer, deletePayer, updatePayer } from './payersSlice';
import {
  addPlanItem,
  addPlanItems,
  deletePlanItem,
  setCardSpendingTotal,
  updatePlanItem,
} from './planSlice';
import {
  addOutflow,
  addOutflows,
  deleteOutflow,
  toggleOutflowPaid,
  updateOutflow,
} from './outflowsSlice';
import {
  addIncomeEntries,
  addIncomeEntry,
  deleteIncomeEntry,
  updateIncomeEntry,
} from './incomeSlice';
import {
  addSavingsPot,
  deleteSavingsBalance,
  deleteSavingsPot,
  upsertSavingsBalance,
  updateSavingsPot,
} from './savingsSlice';
import { generateId } from '../utils/id';
import type { UndoEntry, UndoNoun, UndoStep } from './undoSlice';

/**
 * The parts of the store an Undo Entry is built and applied from. The real
 * `RootState` satisfies it; tests can hand in only the slices they populate.
 */
export interface UndoSourceState {
  cards: { items: Card[] };
  banks: { items: Bank[] };
  payers: { items: Payer[] };
  plan: { items: PlanItem[]; cardSpending: CardSpending[] };
  outflows: { items: Outflow[] };
  income: { items: IncomeEntry[] };
  savings: { items: SavingsPot[]; balances: SavingsBalance[] };
}

interface DraftEntry {
  steps: UndoStep[];
  bulk: UndoNoun | null;
}

function one(step: UndoStep): DraftEntry {
  return { steps: [step], bulk: null };
}

function many(noun: UndoNoun, steps: UndoStep[]): DraftEntry | null {
  return steps.length > 0 ? { steps, bulk: noun } : null;
}

function findById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find((item) => item.id === id);
}

/** Shallow equality is enough: every record field is a primitive. */
function sameRecord<T extends { id: string }>(a: T, b: T): boolean {
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  if (aKeys.length !== Object.keys(bRecord).length) return false;
  return aKeys.every((key) => aRecord[key] === bRecord[key]);
}

/**
 * Translate the action that just landed into the compensation that reverses it,
 * using the state from *before* the reducer ran. Returns null when the action
 * changed nothing observable (an identical edit, a stale delete, an empty bulk
 * copy), so no toast is raised for a save that did not save anything.
 */
function buildDraft(action: UnknownAction, before: UndoSourceState): DraftEntry | null {
  if (addCard.match(action)) {
    return one({ tab: 'cards', change: { kind: 'remove', record: action.payload } });
  }
  if (updateCard.match(action)) {
    const prior = findById(before.cards.items, action.payload.id);
    if (!prior || sameRecord(prior, action.payload)) return null;
    return one({ tab: 'cards', change: { kind: 'restore', record: prior } });
  }
  if (deleteCard.match(action)) {
    const prior = findById(before.cards.items, action.payload);
    return prior ? one({ tab: 'cards', change: { kind: 'restore', record: prior } }) : null;
  }

  if (addBank.match(action)) {
    return one({ tab: 'banks', change: { kind: 'remove', record: action.payload } });
  }
  if (updateBank.match(action)) {
    const prior = findById(before.banks.items, action.payload.id);
    if (!prior || sameRecord(prior, action.payload)) return null;
    return one({ tab: 'banks', change: { kind: 'restore', record: prior } });
  }
  if (deleteBank.match(action)) {
    const prior = findById(before.banks.items, action.payload);
    return prior ? one({ tab: 'banks', change: { kind: 'restore', record: prior } }) : null;
  }

  if (addPayer.match(action)) {
    return one({ tab: 'payers', change: { kind: 'remove', record: action.payload } });
  }
  if (updatePayer.match(action)) {
    const prior = findById(before.payers.items, action.payload.id);
    if (!prior || sameRecord(prior, action.payload)) return null;
    return one({ tab: 'payers', change: { kind: 'restore', record: prior } });
  }
  if (deletePayer.match(action)) {
    const prior = findById(before.payers.items, action.payload);
    return prior ? one({ tab: 'payers', change: { kind: 'restore', record: prior } }) : null;
  }

  if (addPlanItem.match(action)) {
    return one({ tab: 'plan', change: { kind: 'remove', record: action.payload } });
  }
  if (addPlanItems.match(action)) {
    return many(
      'plan',
      action.payload.map((record): UndoStep => ({
        tab: 'plan',
        change: { kind: 'remove', record },
      }))
    );
  }
  if (updatePlanItem.match(action)) {
    const prior = findById(before.plan.items, action.payload.id);
    if (!prior || sameRecord(prior, action.payload)) return null;
    return one({ tab: 'plan', change: { kind: 'restore', record: prior } });
  }
  if (deletePlanItem.match(action)) {
    const prior = findById(before.plan.items, action.payload);
    return prior ? one({ tab: 'plan', change: { kind: 'restore', record: prior } }) : null;
  }

  if (setCardSpendingTotal.match(action)) {
    const { month, cardId, total } = action.payload;
    const existing = before.plan.cardSpending.find(
      (entry) => entry.month === month && entry.cardId === cardId
    );
    if (existing) {
      if (existing.total === total) return null;
      return one({ tab: 'card_spending', change: { kind: 'restore', record: existing } });
    }
    // A first check-in starts from an empty field; clearing it back to 0 looks
    // and totals exactly the same, so there is nothing to undo for a typed 0.
    if (total === 0) return null;
    const created: CardSpending = { id: `${month}-${cardId}`, month, cardId, total };
    return one({ tab: 'card_spending', change: { kind: 'remove', record: created } });
  }

  if (addOutflow.match(action)) {
    return one({ tab: 'outflows', change: { kind: 'remove', record: action.payload } });
  }
  if (addOutflows.match(action)) {
    return many(
      'outflows',
      action.payload.map((record): UndoStep => ({
        tab: 'outflows',
        change: { kind: 'remove', record },
      }))
    );
  }
  if (updateOutflow.match(action)) {
    const prior = findById(before.outflows.items, action.payload.id);
    if (!prior || sameRecord(prior, action.payload)) return null;
    return one({ tab: 'outflows', change: { kind: 'restore', record: prior } });
  }
  if (deleteOutflow.match(action)) {
    const prior = findById(before.outflows.items, action.payload);
    return prior ? one({ tab: 'outflows', change: { kind: 'restore', record: prior } }) : null;
  }
  if (toggleOutflowPaid.match(action)) {
    const prior = findById(before.outflows.items, action.payload);
    return prior ? one({ tab: 'outflows', change: { kind: 'restore', record: prior } }) : null;
  }

  if (addIncomeEntry.match(action)) {
    return one({ tab: 'income', change: { kind: 'remove', record: action.payload } });
  }
  if (addIncomeEntries.match(action)) {
    return many(
      'income',
      action.payload.map((record): UndoStep => ({
        tab: 'income',
        change: { kind: 'remove', record },
      }))
    );
  }
  if (updateIncomeEntry.match(action)) {
    const prior = findById(before.income.items, action.payload.id);
    if (!prior || sameRecord(prior, action.payload)) return null;
    return one({ tab: 'income', change: { kind: 'restore', record: prior } });
  }
  if (deleteIncomeEntry.match(action)) {
    const prior = findById(before.income.items, action.payload);
    return prior ? one({ tab: 'income', change: { kind: 'restore', record: prior } }) : null;
  }

  if (addSavingsPot.match(action)) {
    return one({ tab: 'savings_pots', change: { kind: 'remove', record: action.payload } });
  }
  if (updateSavingsPot.match(action)) {
    const prior = findById(before.savings.items, action.payload.id);
    if (!prior || sameRecord(prior, action.payload)) return null;
    return one({ tab: 'savings_pots', change: { kind: 'restore', record: prior } });
  }
  if (deleteSavingsPot.match(action)) {
    const prior = findById(before.savings.items, action.payload);
    return prior ? one({ tab: 'savings_pots', change: { kind: 'restore', record: prior } }) : null;
  }

  if (upsertSavingsBalance.match(action)) {
    const { month, potId, balance } = action.payload;
    const existing = before.savings.balances.find(
      (entry) => entry.month === month && entry.potId === potId
    );
    if (existing) {
      if (existing.balance === balance) return null;
      return one({ tab: 'savings_balances', change: { kind: 'restore', record: existing } });
    }
    const created: SavingsBalance = { id: `${month}-${potId}`, month, potId, balance };
    return one({ tab: 'savings_balances', change: { kind: 'remove', record: created } });
  }
  if (deleteSavingsBalance.match(action)) {
    const prior = findById(before.savings.balances, action.payload);
    return prior ? one({ tab: 'savings_balances', change: { kind: 'restore', record: prior } }) : null;
  }

  return null;
}

/** Build the single-use Undo Entry for an action, or null when it changed nothing. */
export function buildUndoEntry(action: UnknownAction, before: UndoSourceState): UndoEntry | null {
  const draft = buildDraft(action, before);
  if (!draft || draft.steps.length === 0) return null;
  return {
    id: generateId(),
    createdAt: Date.now(),
    bulk: draft.bulk,
    count: draft.steps.length,
    steps: draft.steps,
  };
}
