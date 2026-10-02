import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Payer } from '../types';

interface PayersState {
  items: Payer[];
}

const initialState: PayersState = {
  items: [],
};

const payersSlice = createSlice({
  name: 'payers',
  initialState,
  reducers: {
    setPayers: (state, action: PayloadAction<Payer[]>) => {
      state.items = action.payload;
    },
    addPayer: (state, action: PayloadAction<Payer>) => {
      state.items.push(action.payload);
    },
    updatePayer: (state, action: PayloadAction<Payer>) => {
      const index = state.items.findIndex((payer) => payer.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    /**
     * Removing a payer only drops it from the registry. Outflows that reference it
     * are deliberately left in place: they are the historical record of who paid
     * what, and removing the payer must not corrupt them (mirrors ADR-0002).
     */
    deletePayer: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((payer) => payer.id !== action.payload);
    },
  },
});

export const { setPayers, addPayer, updatePayer, deletePayer } = payersSlice.actions;

export default payersSlice.reducer;
