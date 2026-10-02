import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Outflow } from '../types';

interface OutflowsState {
  items: Outflow[];
}

const initialState: OutflowsState = {
  items: [],
};

const outflowsSlice = createSlice({
  name: 'outflows',
  initialState,
  reducers: {
    setOutflows: (state, action: PayloadAction<Outflow[]>) => {
      state.items = action.payload;
    },
    addOutflow: (state, action: PayloadAction<Outflow>) => {
      state.items.push(action.payload);
    },
    /** Bulk add for replicate-last-month, so a whole month's outflows sync as one action. */
    addOutflows: (state, action: PayloadAction<Outflow[]>) => {
      state.items.push(...action.payload);
    },
    updateOutflow: (state, action: PayloadAction<Outflow>) => {
      const index = state.items.findIndex((outflow) => outflow.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    deleteOutflow: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((outflow) => outflow.id !== action.payload);
    },
    toggleOutflowPaid: (state, action: PayloadAction<string>) => {
      const outflow = state.items.find((item) => item.id === action.payload);
      if (outflow) {
        outflow.isPaid = !outflow.isPaid;
      }
    },
  },
});

export const { setOutflows, addOutflow, addOutflows, updateOutflow, deleteOutflow, toggleOutflowPaid } =
  outflowsSlice.actions;

export default outflowsSlice.reducer;
