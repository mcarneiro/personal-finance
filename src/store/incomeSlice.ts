import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IncomeEntry } from '../types';

interface IncomeState {
  items: IncomeEntry[];
}

const initialState: IncomeState = {
  items: [],
};

const incomeSlice = createSlice({
  name: 'income',
  initialState,
  reducers: {
    setIncomeEntries: (state, action: PayloadAction<IncomeEntry[]>) => {
      state.items = action.payload;
    },
    addIncomeEntry: (state, action: PayloadAction<IncomeEntry>) => {
      state.items.push(action.payload);
    },
    updateIncomeEntry: (state, action: PayloadAction<IncomeEntry>) => {
      const index = state.items.findIndex((entry) => entry.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    deleteIncomeEntry: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((entry) => entry.id !== action.payload);
    },
  },
});

export const { setIncomeEntries, addIncomeEntry, updateIncomeEntry, deleteIncomeEntry } =
  incomeSlice.actions;

export default incomeSlice.reducer;
