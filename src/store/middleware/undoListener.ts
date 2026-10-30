import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { addCard, deleteCard, updateCard } from '../cardsSlice';
import { addBank, deleteBank, updateBank } from '../banksSlice';
import { addPayer, deletePayer, updatePayer } from '../payersSlice';
import {
  addPlanItem,
  addPlanItems,
  deletePlanItem,
  setCardSpendingTotal,
  updatePlanItem,
} from '../planSlice';
import {
  addOutflow,
  addOutflows,
  deleteOutflow,
  toggleOutflowPaid,
  updateOutflow,
} from '../outflowsSlice';
import {
  addIncomeEntries,
  addIncomeEntry,
  deleteIncomeEntry,
  updateIncomeEntry,
} from '../incomeSlice';
import {
  addSavingsPot,
  deleteSavingsBalance,
  deleteSavingsPot,
  upsertSavingsBalance,
  updateSavingsPot,
} from '../savingsSlice';
import type { RootState } from '../index';
import { buildUndoEntry } from '../undoBuild';
import { applyUndoSteps } from '../undoApply';
import {
  clearUndoEntry,
  setApplyingUndo,
  showUndo,
  undoRequested,
  UNDO_TTL_MS,
} from '../undoSlice';

/**
 * The undo side of the save loop (ADR-0014). Every record mutation is mirrored
 * into a single in-memory Undo Entry, and `undoRequested` replays its
 * compensating writes through the normal slice actions — so an undo is a save
 * like any other: a Pending Change, row-scoped, local wins.
 */
export const undoListenerMiddleware = createListenerMiddleware();

const startAppListening = undoListenerMiddleware.startListening.withTypes<RootState>();

/** Every action that writes a sheet record, and therefore can be undone. */
const UNDOABLE_ACTIONS = isAnyOf(
  addCard,
  updateCard,
  deleteCard,
  addBank,
  updateBank,
  deleteBank,
  addPayer,
  updatePayer,
  deletePayer,
  addPlanItem,
  addPlanItems,
  updatePlanItem,
  deletePlanItem,
  setCardSpendingTotal,
  addOutflow,
  addOutflows,
  updateOutflow,
  deleteOutflow,
  toggleOutflowPaid,
  addIncomeEntry,
  addIncomeEntries,
  updateIncomeEntry,
  deleteIncomeEntry,
  addSavingsPot,
  updateSavingsPot,
  deleteSavingsPot,
  upsertSavingsBalance,
  deleteSavingsBalance
);

startAppListening({
  matcher: UNDOABLE_ACTIONS,
  effect: (action, listenerApi) => {
    // Test stores and any embedder that does not mount the undo slice simply
    // get no toast; the app store always mounts it.
    const undo = listenerApi.getState().undo;
    if (!undo || undo.applying) return;
    const entry = buildUndoEntry(action, listenerApi.getOriginalState());
    if (entry) listenerApi.dispatch(showUndo(entry));
  },
});

startAppListening({
  actionCreator: undoRequested,
  effect: (_action, listenerApi) => {
    const { entry } = listenerApi.getState().undo;
    if (!entry) return;
    // Hide the toast first, so a second tap (or a stale tab) cannot undo twice.
    listenerApi.dispatch(clearUndoEntry());
    if (Date.now() - entry.createdAt > UNDO_TTL_MS) return;

    // The compensating actions must not raise a toast of their own: undo is
    // one-way, there is no redo (ADR-0014).
    listenerApi.dispatch(setApplyingUndo(true));
    try {
      applyUndoSteps(listenerApi.dispatch, listenerApi.getState(), entry.steps);
    } finally {
      listenerApi.dispatch(setApplyingUndo(false));
    }
  },
});
