import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Card } from '../types';

interface CardsState {
  items: Card[];
}

const initialState: CardsState = {
  items: [],
};

const cardsSlice = createSlice({
  name: 'cards',
  initialState,
  reducers: {
    setCards: (state, action: PayloadAction<Card[]>) => {
      state.items = action.payload;
    },
    addCard: (state, action: PayloadAction<Card>) => {
      state.items.push(action.payload);
    },
    updateCard: (state, action: PayloadAction<Card>) => {
      const index = state.items.findIndex((card) => card.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    deleteCard: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((card) => card.id !== action.payload);
    },
  },
});

export const { setCards, addCard, updateCard, deleteCard } = cardsSlice.actions;

export default cardsSlice.reducer;
