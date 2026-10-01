import { configureStore } from '@reduxjs/toolkit';
import appReducer from './appSlice';
import cardsReducer from './cardsSlice';
import banksReducer from './banksSlice';
import payersReducer from './payersSlice';
import planReducer from './planSlice';
import billsReducer from './billsSlice';
import incomeReducer from './incomeSlice';
import settingsReducer from './settingsSlice';
import pendingReducer from './pendingSlice';
import { syncListenerMiddleware } from './middleware/syncListener';

export const store = configureStore({
  reducer: {
    app: appReducer,
    cards: cardsReducer,
    banks: banksReducer,
    payers: payersReducer,
    plan: planReducer,
    bills: billsReducer,
    income: incomeReducer,
    settings: settingsReducer,
    pending: pendingReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(syncListenerMiddleware.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
