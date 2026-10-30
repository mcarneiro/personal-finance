import type { Dispatch, UnknownAction } from '@reduxjs/toolkit';
import { addCard, deleteCard, updateCard } from './cardsSlice';
import { addBank, deleteBank, updateBank } from './banksSlice';
import { addPayer, deletePayer, updatePayer } from './payersSlice';
import { addPlanItem, deletePlanItem, setCardSpendingTotal, updatePlanItem } from './planSlice';
import {
  addOutflow,
  deleteOutflow,
  updateOutflow,
} from './outflowsSlice';
import {
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
import type { UndoSourceState } from './undoBuild';
import type { UndoStep } from './undoSlice';

function exists<T extends { id: string }>(items: T[], id: string): boolean {
  return items.some((item) => item.id === id);
}

/**
 * Dispatch the compensating writes for an Undo Entry through the normal slice
 * actions, so each one becomes a Pending Change and reaches the sheet exactly
 * like a save the household made on purpose (ADR-0008, ADR-0014). A restore
 * updates the record when it is still present and adds it back when it is not,
 * which covers both an edit and a delete with one rule.
 */
export function applyUndoSteps(
  dispatch: Dispatch<UnknownAction>,
  state: UndoSourceState,
  steps: UndoStep[]
): void {
  for (const step of steps) {
    switch (step.tab) {
      case 'cards': {
        const { change } = step;
        if (change.kind === 'remove') dispatch(deleteCard(change.record.id));
        else if (exists(state.cards.items, change.record.id)) dispatch(updateCard(change.record));
        else dispatch(addCard(change.record));
        break;
      }
      case 'banks': {
        const { change } = step;
        if (change.kind === 'remove') dispatch(deleteBank(change.record.id));
        else if (exists(state.banks.items, change.record.id)) dispatch(updateBank(change.record));
        else dispatch(addBank(change.record));
        break;
      }
      case 'payers': {
        const { change } = step;
        if (change.kind === 'remove') dispatch(deletePayer(change.record.id));
        else if (exists(state.payers.items, change.record.id)) dispatch(updatePayer(change.record));
        else dispatch(addPayer(change.record));
        break;
      }
      case 'plan': {
        const { change } = step;
        if (change.kind === 'remove') dispatch(deletePlanItem(change.record.id));
        else if (exists(state.plan.items, change.record.id)) dispatch(updatePlanItem(change.record));
        else dispatch(addPlanItem(change.record));
        break;
      }
      case 'card_spending': {
        const { change } = step;
        // Card spending has no add/delete action: a first check-in is cleared by
        // writing 0, which reads and totals the same as an untouched field.
        dispatch(
          setCardSpendingTotal({
            month: change.record.month,
            cardId: change.record.cardId,
            total: change.kind === 'remove' ? 0 : change.record.total,
          })
        );
        break;
      }
      case 'outflows': {
        const { change } = step;
        if (change.kind === 'remove') dispatch(deleteOutflow(change.record.id));
        else if (exists(state.outflows.items, change.record.id)) dispatch(updateOutflow(change.record));
        else dispatch(addOutflow(change.record));
        break;
      }
      case 'income': {
        const { change } = step;
        if (change.kind === 'remove') dispatch(deleteIncomeEntry(change.record.id));
        else if (exists(state.income.items, change.record.id)) dispatch(updateIncomeEntry(change.record));
        else dispatch(addIncomeEntry(change.record));
        break;
      }
      case 'savings_pots': {
        const { change } = step;
        if (change.kind === 'remove') dispatch(deleteSavingsPot(change.record.id));
        else if (exists(state.savings.items, change.record.id)) dispatch(updateSavingsPot(change.record));
        else dispatch(addSavingsPot(change.record));
        break;
      }
      case 'savings_balances': {
        const { change } = step;
        if (change.kind === 'remove') dispatch(deleteSavingsBalance(change.record.id));
        else
          dispatch(
            upsertSavingsBalance({
              month: change.record.month,
              potId: change.record.potId,
              balance: change.record.balance,
            })
          );
        break;
      }
    }
  }
}
