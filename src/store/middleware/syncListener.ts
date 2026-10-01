import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { addCard, deleteCard, updateCard } from '../cardsSlice';
import { addBank, deleteBank, updateBank } from '../banksSlice';
import { addPayer, deletePayer, updatePayer } from '../payersSlice';
import { addBill, addBills, deleteBill, toggleBillPaid, updateBill } from '../billsSlice';
import { addIncomeEntries, addIncomeEntry, deleteIncomeEntry, updateIncomeEntry } from '../incomeSlice';
import {
  addPlanItem,
  addPlanItems,
  deletePlanItem,
  setCardSpendingTotal,
  updatePlanItem,
} from '../planSlice';
import { dropPendingChanges, recordPendingChange } from '../pendingSlice';
import { googleSheetsService } from '../../services/GoogleSheetsService';
import type { RootState } from '../index';

/**
 * Debounced write-back to the connected sheet (ported from Stayoo, ADR-0001).
 * Only user mutations trigger a write — bulk `set*` actions dispatched by a pull
 * are deliberately excluded so loading never echoes back.
 *
 * Each mutation also records a Pending Change (CONTEXT.md) before the debounce,
 * so a pull that races the write replays the local edit instead of dropping it.
 * On a successful write the changes it carried are dropped; a failed write
 * keeps them for the next save or pull (ADR-0008).
 */
export const syncListenerMiddleware = createListenerMiddleware();

const startAppListening = syncListenerMiddleware.startListening.withTypes<RootState>();

const DEBOUNCE_MS = 1000;

startAppListening({
  matcher: isAnyOf(addCard, updateCard, deleteCard),
  effect: async (action, listenerApi) => {
    if (addCard.match(action)) {
      listenerApi.dispatch(
        recordPendingChange({
          tab: 'cards',
          change: { type: 'create', id: action.payload.id, record: action.payload },
        })
      );
    } else if (updateCard.match(action)) {
      listenerApi.dispatch(
        recordPendingChange({
          tab: 'cards',
          change: { type: 'update', id: action.payload.id, record: action.payload },
        })
      );
    } else if (deleteCard.match(action)) {
      listenerApi.dispatch(
        recordPendingChange({ tab: 'cards', change: { type: 'delete', id: action.payload } })
      );
    }

    await listenerApi.delay(DEBOUNCE_MS);
    listenerApi.cancelActiveListeners(); // Cancel any pending saves

    const { cards, settings } = listenerApi.getState();
    if (!settings.sheetId) return;

    const pendingBefore = listenerApi.getState().pending?.changes?.cards ?? {};
    try {
      await googleSheetsService.writeCards(settings.sheetId, cards.items);
      listenerApi.dispatch(dropPendingChanges({ tab: 'cards', changes: pendingBefore }));
    } catch (error) {
      console.error('Failed to sync cards:', error);
    }
  },
});

startAppListening({
  matcher: isAnyOf(addBank, updateBank, deleteBank),
  effect: async (action, listenerApi) => {
    if (addBank.match(action)) {
      listenerApi.dispatch(
        recordPendingChange({
          tab: 'banks',
          change: { type: 'create', id: action.payload.id, record: action.payload },
        })
      );
    } else if (updateBank.match(action)) {
      listenerApi.dispatch(
        recordPendingChange({
          tab: 'banks',
          change: { type: 'update', id: action.payload.id, record: action.payload },
        })
      );
    } else if (deleteBank.match(action)) {
      listenerApi.dispatch(
        recordPendingChange({ tab: 'banks', change: { type: 'delete', id: action.payload } })
      );
    }

    await listenerApi.delay(DEBOUNCE_MS);
    listenerApi.cancelActiveListeners(); // Cancel any pending saves

    const { banks, settings } = listenerApi.getState();
    if (!settings.sheetId) return;

    const pendingBefore = listenerApi.getState().pending?.changes?.banks ?? {};
    try {
      await googleSheetsService.writeBanks(settings.sheetId, banks.items);
      listenerApi.dispatch(dropPendingChanges({ tab: 'banks', changes: pendingBefore }));
    } catch (error) {
      console.error('Failed to sync banks:', error);
    }
  },
});

startAppListening({
  matcher: isAnyOf(addPayer, updatePayer, deletePayer),
  effect: async (action, listenerApi) => {
    if (addPayer.match(action)) {
      listenerApi.dispatch(
        recordPendingChange({
          tab: 'payers',
          change: { type: 'create', id: action.payload.id, record: action.payload },
        })
      );
    } else if (updatePayer.match(action)) {
      listenerApi.dispatch(
        recordPendingChange({
          tab: 'payers',
          change: { type: 'update', id: action.payload.id, record: action.payload },
        })
      );
    } else if (deletePayer.match(action)) {
      listenerApi.dispatch(
        recordPendingChange({ tab: 'payers', change: { type: 'delete', id: action.payload } })
      );
    }

    await listenerApi.delay(DEBOUNCE_MS);
    listenerApi.cancelActiveListeners(); // Cancel any pending saves

    const { payers, settings } = listenerApi.getState();
    if (!settings.sheetId) return;

    const pendingBefore = listenerApi.getState().pending?.changes?.payers ?? {};
    try {
      await googleSheetsService.writePayers(settings.sheetId, payers.items);
      listenerApi.dispatch(dropPendingChanges({ tab: 'payers', changes: pendingBefore }));
    } catch (error) {
      console.error('Failed to sync payers:', error);
    }
  },
});

startAppListening({
  matcher: isAnyOf(addPlanItem, addPlanItems, updatePlanItem, deletePlanItem),
  effect: async (action, listenerApi) => {
    if (addPlanItem.match(action)) {
      listenerApi.dispatch(
        recordPendingChange({
          tab: 'plan',
          change: { type: 'create', id: action.payload.id, record: action.payload },
        })
      );
    } else if (addPlanItems.match(action)) {
      for (const item of action.payload) {
        listenerApi.dispatch(
          recordPendingChange({ tab: 'plan', change: { type: 'create', id: item.id, record: item } })
        );
      }
    } else if (updatePlanItem.match(action)) {
      listenerApi.dispatch(
        recordPendingChange({
          tab: 'plan',
          change: { type: 'update', id: action.payload.id, record: action.payload },
        })
      );
    } else if (deletePlanItem.match(action)) {
      listenerApi.dispatch(
        recordPendingChange({ tab: 'plan', change: { type: 'delete', id: action.payload } })
      );
    }

    await listenerApi.delay(DEBOUNCE_MS);
    listenerApi.cancelActiveListeners();

    const { plan, settings } = listenerApi.getState();
    if (!settings.sheetId) return;

    const pendingBefore = listenerApi.getState().pending?.changes?.plan ?? {};
    try {
      await googleSheetsService.writePlanItems(settings.sheetId, plan.items);
      listenerApi.dispatch(dropPendingChanges({ tab: 'plan', changes: pendingBefore }));
    } catch (error) {
      console.error('Failed to sync plan items:', error);
    }
  },
});

startAppListening({
  actionCreator: setCardSpendingTotal,
  effect: async (action, listenerApi) => {
    const { month, cardId } = action.payload;
    const entry = listenerApi
      .getState()
      .plan.cardSpending.find((item) => item.month === month && item.cardId === cardId);
    if (entry) {
      listenerApi.dispatch(
        recordPendingChange({
          tab: 'card_spending',
          change: { type: 'update', id: entry.id, record: entry },
        })
      );
    }

    await listenerApi.delay(DEBOUNCE_MS);
    listenerApi.cancelActiveListeners();

    const { plan, settings } = listenerApi.getState();
    if (!settings.sheetId) return;

    const pendingBefore = listenerApi.getState().pending?.changes?.card_spending ?? {};
    try {
      await googleSheetsService.writeCardSpending(settings.sheetId, plan.cardSpending);
      listenerApi.dispatch(dropPendingChanges({ tab: 'card_spending', changes: pendingBefore }));
    } catch (error) {
      console.error('Failed to sync card spending:', error);
    }
  },
});

startAppListening({
  matcher: isAnyOf(addBill, addBills, updateBill, deleteBill, toggleBillPaid),
  effect: async (action, listenerApi) => {
    if (addBill.match(action)) {
      listenerApi.dispatch(
        recordPendingChange({
          tab: 'bills',
          change: { type: 'create', id: action.payload.id, record: action.payload },
        })
      );
    } else if (addBills.match(action)) {
      for (const bill of action.payload) {
        listenerApi.dispatch(
          recordPendingChange({ tab: 'bills', change: { type: 'create', id: bill.id, record: bill } })
        );
      }
    } else if (updateBill.match(action)) {
      listenerApi.dispatch(
        recordPendingChange({
          tab: 'bills',
          change: { type: 'update', id: action.payload.id, record: action.payload },
        })
      );
    } else if (deleteBill.match(action)) {
      listenerApi.dispatch(
        recordPendingChange({ tab: 'bills', change: { type: 'delete', id: action.payload } })
      );
    } else if (toggleBillPaid.match(action)) {
      const bill = listenerApi.getState().bills.items.find((item) => item.id === action.payload);
      if (bill) {
        listenerApi.dispatch(
          recordPendingChange({
            tab: 'bills',
            change: { type: 'update', id: bill.id, record: bill },
          })
        );
      }
    }

    await listenerApi.delay(DEBOUNCE_MS);
    listenerApi.cancelActiveListeners();

    const { bills, settings } = listenerApi.getState();
    if (!settings.sheetId) return;

    const pendingBefore = listenerApi.getState().pending?.changes?.bills ?? {};
    try {
      await googleSheetsService.writeBills(settings.sheetId, bills.items);
      listenerApi.dispatch(dropPendingChanges({ tab: 'bills', changes: pendingBefore }));
    } catch (error) {
      console.error('Failed to sync bills:', error);
    }
  },
});

startAppListening({
  matcher: isAnyOf(addIncomeEntry, addIncomeEntries, updateIncomeEntry, deleteIncomeEntry),
  effect: async (action, listenerApi) => {
    if (addIncomeEntry.match(action)) {
      listenerApi.dispatch(
        recordPendingChange({
          tab: 'income',
          change: { type: 'create', id: action.payload.id, record: action.payload },
        })
      );
    } else if (addIncomeEntries.match(action)) {
      for (const entry of action.payload) {
        listenerApi.dispatch(
          recordPendingChange({
            tab: 'income',
            change: { type: 'create', id: entry.id, record: entry },
          })
        );
      }
    } else if (updateIncomeEntry.match(action)) {
      listenerApi.dispatch(
        recordPendingChange({
          tab: 'income',
          change: { type: 'update', id: action.payload.id, record: action.payload },
        })
      );
    } else if (deleteIncomeEntry.match(action)) {
      listenerApi.dispatch(
        recordPendingChange({ tab: 'income', change: { type: 'delete', id: action.payload } })
      );
    }

    await listenerApi.delay(DEBOUNCE_MS);
    listenerApi.cancelActiveListeners();

    const { income, settings } = listenerApi.getState();
    if (!settings.sheetId) return;

    const pendingBefore = listenerApi.getState().pending?.changes?.income ?? {};
    try {
      await googleSheetsService.writeIncome(settings.sheetId, income.items);
      listenerApi.dispatch(dropPendingChanges({ tab: 'income', changes: pendingBefore }));
    } catch (error) {
      console.error('Failed to sync income:', error);
    }
  },
});
