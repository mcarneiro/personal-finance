import { createAction, createSlice, type PayloadAction } from '@reduxjs/toolkit';
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

/**
 * How long an Undo Entry stays available. Short on purpose: this app saves
 * without asking, so undo is a reflex net for the change just made, not a
 * history browser (ADR-0014).
 */
export const UNDO_TTL_MS = 6000;

/** The bulk action an Undo Entry reverses, used to name it in the toast. */
export type UndoNoun = 'outflows' | 'plan' | 'income';

/**
 * One record's compensation. `restore` puts a prior record back (an edit or a
 * delete); `remove` takes away a record the action created. Both carry the
 * record so every tab can find what it needs — card spending, for instance,
 * needs the month and card id to clear a first check-in.
 */
export type UndoChange<T extends { id: string }> =
  | { kind: 'restore'; record: T }
  | { kind: 'remove'; record: T };

/** The tab-scoped compensation for one record the last action touched. */
export type UndoStep =
  | { tab: 'cards'; change: UndoChange<Card> }
  | { tab: 'banks'; change: UndoChange<Bank> }
  | { tab: 'payers'; change: UndoChange<Payer> }
  | { tab: 'plan'; change: UndoChange<PlanItem> }
  | { tab: 'card_spending'; change: UndoChange<CardSpending> }
  | { tab: 'outflows'; change: UndoChange<Outflow> }
  | { tab: 'income'; change: UndoChange<IncomeEntry> }
  | { tab: 'savings_pots'; change: UndoChange<SavingsPot> }
  | { tab: 'savings_balances'; change: UndoChange<SavingsBalance> };

/**
 * The prior state of the last change, held only in memory on this device. A bulk
 * action (replicate-last-month, copy-plan) is one entry covering the whole
 * batch. Device-local, single-use, never synced — see CONTEXT.md and ADR-0014.
 */
export interface UndoEntry {
  id: string;
  createdAt: number;
  bulk: UndoNoun | null;
  count: number;
  steps: UndoStep[];
}

export interface UndoState {
  entry: UndoEntry | null;
  /** True only while compensating actions are being dispatched for an undo. */
  applying: boolean;
}

const initialState: UndoState = { entry: null, applying: false };

const undoSlice = createSlice({
  name: 'undo',
  initialState,
  reducers: {
    /** A newer change replaces the previous entry: undo only ever targets the newest. */
    showUndo(state, action: PayloadAction<UndoEntry>) {
      state.entry = action.payload;
    },
    clearUndoEntry(state) {
      state.entry = null;
    },
    setApplyingUndo(state, action: PayloadAction<boolean>) {
      state.applying = action.payload;
    },
  },
});

/** The household tapped Undo (or the expiry timer fired and cleared the entry). */
export const undoRequested = createAction('undo/requested');

export const { showUndo, clearUndoEntry, setApplyingUndo } = undoSlice.actions;

export default undoSlice.reducer;
