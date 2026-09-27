import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CardSpending, Month, PlanItem } from '../types';

interface PlanState {
  items: PlanItem[];
  cardSpending: CardSpending[];
}

const initialState: PlanState = {
  items: [],
  cardSpending: [],
};

interface SetCardSpendingTotalPayload {
  month: Month;
  cardId: string;
  total: number;
}

const planSlice = createSlice({
  name: 'plan',
  initialState,
  reducers: {
    setPlanItems: (state, action: PayloadAction<PlanItem[]>) => {
      state.items = action.payload;
    },
    addPlanItem: (state, action: PayloadAction<PlanItem>) => {
      state.items.push(action.payload);
    },
    updatePlanItem: (state, action: PayloadAction<PlanItem>) => {
      const index = state.items.findIndex((item) => item.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    deletePlanItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
    setCardSpending: (state, action: PayloadAction<CardSpending[]>) => {
      state.cardSpending = action.payload;
    },
    /**
     * Check-in: one current total per card per month, overwritten in place —
     * there is deliberately no snapshot history (ADR-0002).
     */
    setCardSpendingTotal: (state, action: PayloadAction<SetCardSpendingTotalPayload>) => {
      const { month, cardId, total } = action.payload;
      const existing = state.cardSpending.find(
        (entry) => entry.month === month && entry.cardId === cardId
      );
      if (existing) {
        existing.total = total;
      } else {
        state.cardSpending.push({ id: `${month}-${cardId}`, month, cardId, total });
      }
    },
  },
});

export const {
  setPlanItems,
  addPlanItem,
  updatePlanItem,
  deletePlanItem,
  setCardSpending,
  setCardSpendingTotal,
} = planSlice.actions;

export default planSlice.reducer;
