import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Bill } from '../types';

interface BillsState {
  items: Bill[];
}

const initialState: BillsState = {
  items: [],
};

const billsSlice = createSlice({
  name: 'bills',
  initialState,
  reducers: {
    setBills: (state, action: PayloadAction<Bill[]>) => {
      state.items = action.payload;
    },
    addBill: (state, action: PayloadAction<Bill>) => {
      state.items.push(action.payload);
    },
    /** Bulk add for replicate-last-month, so a whole month's bills sync as one action. */
    addBills: (state, action: PayloadAction<Bill[]>) => {
      state.items.push(...action.payload);
    },
    updateBill: (state, action: PayloadAction<Bill>) => {
      const index = state.items.findIndex((bill) => bill.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    deleteBill: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((bill) => bill.id !== action.payload);
    },
    toggleBillPaid: (state, action: PayloadAction<string>) => {
      const bill = state.items.find((item) => item.id === action.payload);
      if (bill) {
        bill.isPaid = !bill.isPaid;
      }
    },
  },
});

export const { setBills, addBill, addBills, updateBill, deleteBill, toggleBillPaid } =
  billsSlice.actions;

export default billsSlice.reducer;
