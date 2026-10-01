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
import { saveWorkingCopy } from '../../services/workingCopyCache';
import { selectSheetData } from '../sheetData';
import type { SheetKey } from '../../config/google';
import type { PendingChanges } from '../../types';
import type { RootState } from '../index';
/**
 * Persist the merged Working Copy after a successful write, so the next startup
 * paints it instantly (ADR-0007). Best effort: a storage failure never fails a
 * successful sync.
 */
function persistWorkingCopy(state: RootState): void {
  if (!state.settings.sheetId) return;
  saveWorkingCopy(state.settings.sheetId, selectSheetData(state));
}

/** The slice of the listener API the debounced flush below needs. */
interface FlusherContext {
  getState: () => RootState;
  dispatch: (action: ReturnType<typeof dropPendingChanges>) => unknown;
}

/**
 * Write one tab's Pending Changes to the sheet row-scoped (ADR-0008) and, on
 * success, drop the changes it carried and refresh the cached Working Copy. A
 * failed write keeps them, so the next save or pull retries and no edit is lost.
 */
async function flushPendingTab(
  context: FlusherContext,
  tab: SheetKey,
  sheetId: string
): Promise<void> {
  const pendingBefore = context.getState().pending?.changes?.[tab] ?? {};
  try {
    await googleSheetsService.writePendingChanges(sheetId, { [tab]: pendingBefore } as PendingChanges);
    context.dispatch(dropPendingChanges({ tab, changes: pendingBefore }));
    persistWorkingCopy(context.getState());
  } catch (error) {
    console.error(`Failed to sync ${tab}:`, error);
  }
}

/**
 * Debounced write-back to the connected sheet (ported from Stayoo, ADR-0001).
 * Only user mutations trigger a write — bulk `set*` actions dispatched by a pull
 * are deliberately excluded so loading never echoes back.
 *
 * Each mutation also records a Pending Change (CONTEXT.md) before the debounce,
 * so a pull that races the write replays the local edit instead of dropping it.
 * The save itself is row-scoped: it re-reads the tab's id column and writes only
 * the changed rows (ADR-0008). On success the changes it carried are dropped; a
 * failed write keeps them for the next save or pull.
 */
export const syncListenerMiddleware = createListenerMiddleware();

const startAppListening = syncListenerMiddleware.startListening.withTypes<RootState>();

const DEBOUNCE_MS = 1000;

startAppListening({
  matcher: isAnyOf(addCard, updateCard, deleteCard),
  effect: async (action, listenerApi) => {
    const sheetIdAtChange = listenerApi.getState().settings.sheetId;
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

    const settings = listenerApi.getState().settings;
    // Abort a write that raced a Settings sheet change: the store was cleared
    // for the new sheet, so proceeding would push empty (or the wrong) data.
    if (!settings.sheetId || settings.sheetId !== sheetIdAtChange) return;

    await flushPendingTab(listenerApi, 'cards', settings.sheetId);
  },
});

startAppListening({
  matcher: isAnyOf(addBank, updateBank, deleteBank),
  effect: async (action, listenerApi) => {
    const sheetIdAtChange = listenerApi.getState().settings.sheetId;
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

    const settings = listenerApi.getState().settings;
    // Abort a write that raced a Settings sheet change: the store was cleared
    // for the new sheet, so proceeding would push empty (or the wrong) data.
    if (!settings.sheetId || settings.sheetId !== sheetIdAtChange) return;

    await flushPendingTab(listenerApi, 'banks', settings.sheetId);
  },
});

startAppListening({
  matcher: isAnyOf(addPayer, updatePayer, deletePayer),
  effect: async (action, listenerApi) => {
    const sheetIdAtChange = listenerApi.getState().settings.sheetId;
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

    const settings = listenerApi.getState().settings;
    // Abort a write that raced a Settings sheet change: the store was cleared
    // for the new sheet, so proceeding would push empty (or the wrong) data.
    if (!settings.sheetId || settings.sheetId !== sheetIdAtChange) return;

    await flushPendingTab(listenerApi, 'payers', settings.sheetId);
  },
});

startAppListening({
  matcher: isAnyOf(addPlanItem, addPlanItems, updatePlanItem, deletePlanItem),
  effect: async (action, listenerApi) => {
    const sheetIdAtChange = listenerApi.getState().settings.sheetId;
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

    const settings = listenerApi.getState().settings;
    // Abort a write that raced a Settings sheet change: the store was cleared
    // for the new sheet, so proceeding would push empty (or the wrong) data.
    if (!settings.sheetId || settings.sheetId !== sheetIdAtChange) return;

    await flushPendingTab(listenerApi, 'plan', settings.sheetId);
  },
});

startAppListening({
  actionCreator: setCardSpendingTotal,
  effect: async (action, listenerApi) => {
    const sheetIdAtChange = listenerApi.getState().settings.sheetId;
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

    const settings = listenerApi.getState().settings;
    // Abort a write that raced a Settings sheet change: the store was cleared
    // for the new sheet, so proceeding would push empty (or the wrong) data.
    if (!settings.sheetId || settings.sheetId !== sheetIdAtChange) return;

    await flushPendingTab(listenerApi, 'card_spending', settings.sheetId);
  },
});

startAppListening({
  matcher: isAnyOf(addBill, addBills, updateBill, deleteBill, toggleBillPaid),
  effect: async (action, listenerApi) => {
    const sheetIdAtChange = listenerApi.getState().settings.sheetId;
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

    const settings = listenerApi.getState().settings;
    // Abort a write that raced a Settings sheet change: the store was cleared
    // for the new sheet, so proceeding would push empty (or the wrong) data.
    if (!settings.sheetId || settings.sheetId !== sheetIdAtChange) return;

    await flushPendingTab(listenerApi, 'bills', settings.sheetId);
  },
});

startAppListening({
  matcher: isAnyOf(addIncomeEntry, addIncomeEntries, updateIncomeEntry, deleteIncomeEntry),
  effect: async (action, listenerApi) => {
    const sheetIdAtChange = listenerApi.getState().settings.sheetId;
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

    const settings = listenerApi.getState().settings;
    // Abort a write that raced a Settings sheet change: the store was cleared
    // for the new sheet, so proceeding would push empty (or the wrong) data.
    if (!settings.sheetId || settings.sheetId !== sheetIdAtChange) return;

    await flushPendingTab(listenerApi, 'income', settings.sheetId);
  },
});
