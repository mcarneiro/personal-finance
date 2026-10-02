import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Bank } from '../types';

interface BanksState {
  items: Bank[];
}

const initialState: BanksState = {
  items: [],
};

const banksSlice = createSlice({
  name: 'banks',
  initialState,
  reducers: {
    setBanks: (state, action: PayloadAction<Bank[]>) => {
      state.items = action.payload;
    },
    addBank: (state, action: PayloadAction<Bank>) => {
      state.items.push(action.payload);
    },
    updateBank: (state, action: PayloadAction<Bank>) => {
      const index = state.items.findIndex((bank) => bank.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    /**
     * Removing a bank only drops it from the registry. Outflows that reference it
     * are deliberately left in place: they are the historical record of who paid
     * what, and removing the bank must not corrupt them (mirrors ADR-0002).
     */
    deleteBank: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((bank) => bank.id !== action.payload);
    },
  },
});

export const { setBanks, addBank, updateBank, deleteBank } = banksSlice.actions;

export default banksSlice.reducer;
