import { configureStore } from '@reduxjs/toolkit';
import appReducer from './appSlice';
import cardsReducer from './cardsSlice';
import planReducer from './planSlice';
import billsReducer from './billsSlice';
import incomeReducer from './incomeSlice';
import settingsReducer from './settingsSlice';
import { syncListenerMiddleware } from './middleware/syncListener';

export const store = configureStore({
  reducer: {
    app: appReducer,
    cards: cardsReducer,
    plan: planReducer,
    bills: billsReducer,
    income: incomeReducer,
    settings: settingsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(syncListenerMiddleware.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
