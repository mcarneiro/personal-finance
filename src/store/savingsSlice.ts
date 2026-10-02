import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Month, SavingsBalance, SavingsPot } from '../types';

export interface SavingsState {
  /** The active pot registry (Settings, ADR-0011). Balances reference a pot by id. */
  items: SavingsPot[];
  /** Every recorded balance row, one per pot per month; history is kept. */
  balances: SavingsBalance[];
}

const initialState: SavingsState = {
  items: [],
  balances: [],
};

/** Record (or overwrite) one pot's balance in one month. */
export interface UpsertSavingsBalancePayload {
  month: Month;
  potId: string;
  balance: number;
}

const savingsSlice = createSlice({
  name: 'savings',
  initialState,
  reducers: {
    setSavingsPots: (state, action: PayloadAction<SavingsPot[]>) => {
      state.items = action.payload;
    },
    addSavingsPot: (state, action: PayloadAction<SavingsPot>) => {
      state.items.push(action.payload);
    },
    updateSavingsPot: (state, action: PayloadAction<SavingsPot>) => {
      const index = state.items.findIndex((pot) => pot.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    /**
     * Removing a pot retires it: it drops out of the registry and stops
     * counting in every month, unlike a removed Payer or Bank (ADR-0011). Its
     * balance rows are deliberately left in `balances` (and in the sheet): the
     * rows are the pot's history, and re-adding a pot of the same name gets a
     * fresh id that does not reconnect them.
     */
    deleteSavingsPot: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((pot) => pot.id !== action.payload);
    },
    setSavingsBalances: (state, action: PayloadAction<SavingsBalance[]>) => {
      state.balances = action.payload;
    },
    /**
     * Check-in: record or overwrite one pot's balance in one month. One row per
     * pot per month (ADR-0011), so committing the browsed month's value updates
     * the existing row rather than adding a second; the id is deterministic
     * (`month-potId`) so the row is stable across saves.
     */
    upsertSavingsBalance: (state, action: PayloadAction<UpsertSavingsBalancePayload>) => {
      const { month, potId, balance } = action.payload;
      const existing = state.balances.find((row) => row.month === month && row.potId === potId);
      if (existing) {
        existing.balance = balance;
      } else {
        state.balances.push({ id: `${month}-${potId}`, month, potId, balance });
      }
    },
    /**
     * Clear the browsed month's recorded balance for a pot, so carry-forward
     * resumes (ADR-0011). Only this row is dropped; the pot's other months are
     * its history and stay. Identified by row id, so a zero is cleared just
     * like any other value.
     */
    deleteSavingsBalance: (state, action: PayloadAction<string>) => {
      state.balances = state.balances.filter((row) => row.id !== action.payload);
    },
  },
});

export const {
  setSavingsPots,
  addSavingsPot,
  updateSavingsPot,
  deleteSavingsPot,
  setSavingsBalances,
  upsertSavingsBalance,
  deleteSavingsBalance,
} = savingsSlice.actions;

export default savingsSlice.reducer;
