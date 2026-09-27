import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { addCard, deleteCard, updateCard } from '../cardsSlice';
import { addBill, deleteBill, toggleBillPaid, updateBill } from '../billsSlice';
import { addIncomeEntries, addIncomeEntry, deleteIncomeEntry, updateIncomeEntry } from '../incomeSlice';
import {
  addPlanItem,
  addPlanItems,
  deletePlanItem,
  setCardSpendingTotal,
  updatePlanItem,
} from '../planSlice';
import { googleSheetsService } from '../../services/GoogleSheetsService';
import type { RootState } from '../index';

/**
 * Debounced write-back to the connected sheet (ported from Stayoo, ADR-0001).
 * Only user mutations trigger a write — bulk `set*` actions dispatched by the
 * initial load are deliberately excluded so loading never echoes back.
 */
export const syncListenerMiddleware = createListenerMiddleware();

const startAppListening = syncListenerMiddleware.startListening.withTypes<RootState>();

const DEBOUNCE_MS = 1000;

startAppListening({
  matcher: isAnyOf(addCard, updateCard, deleteCard),
  effect: async (_action, listenerApi) => {
    await listenerApi.delay(DEBOUNCE_MS);
    listenerApi.cancelActiveListeners(); // Cancel any pending saves

    const { cards, settings } = listenerApi.getState();
    if (!settings.sheetId) return;

    try {
      await googleSheetsService.writeCards(settings.sheetId, cards.items);
    } catch (error) {
      console.error('Failed to sync cards:', error);
    }
  },
});

startAppListening({
  matcher: isAnyOf(addPlanItem, addPlanItems, updatePlanItem, deletePlanItem),
  effect: async (_action, listenerApi) => {
    await listenerApi.delay(DEBOUNCE_MS);
    listenerApi.cancelActiveListeners();

    const { plan, settings } = listenerApi.getState();
    if (!settings.sheetId) return;

    try {
      await googleSheetsService.writePlanItems(settings.sheetId, plan.items);
    } catch (error) {
      console.error('Failed to sync plan items:', error);
    }
  },
});

startAppListening({
  actionCreator: setCardSpendingTotal,
  effect: async (_action, listenerApi) => {
    await listenerApi.delay(DEBOUNCE_MS);
    listenerApi.cancelActiveListeners();

    const { plan, settings } = listenerApi.getState();
    if (!settings.sheetId) return;

    try {
      await googleSheetsService.writeCardSpending(settings.sheetId, plan.cardSpending);
    } catch (error) {
      console.error('Failed to sync card spending:', error);
    }
  },
});

startAppListening({
  matcher: isAnyOf(addBill, updateBill, deleteBill, toggleBillPaid),
  effect: async (_action, listenerApi) => {
    await listenerApi.delay(DEBOUNCE_MS);
    listenerApi.cancelActiveListeners();

    const { bills, settings } = listenerApi.getState();
    if (!settings.sheetId) return;

    try {
      await googleSheetsService.writeBills(settings.sheetId, bills.items);
    } catch (error) {
      console.error('Failed to sync bills:', error);
    }
  },
});

startAppListening({
  matcher: isAnyOf(addIncomeEntry, addIncomeEntries, updateIncomeEntry, deleteIncomeEntry),
  effect: async (_action, listenerApi) => {
    await listenerApi.delay(DEBOUNCE_MS);
    listenerApi.cancelActiveListeners();

    const { income, settings } = listenerApi.getState();
    if (!settings.sheetId) return;

    try {
      await googleSheetsService.writeIncome(settings.sheetId, income.items);
    } catch (error) {
      console.error('Failed to sync income:', error);
    }
  },
});
