import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Month } from '../types';
import { getCurrentMonth } from '../utils/month';

interface AppState {
  authInitialized: boolean;
  dataLoading: boolean;
  dataLoaded: boolean;
  /** True while a background pull is in flight; never gates the UI. */
  syncing: boolean;
  /**
   * True when the last pull failed but there is last-saved data to show, so the
   * UI surfaces "offline — showing last saved data" instead of hiding it.
   */
  offline: boolean;
  /**
   * The month the month-scoped screens are browsing. It is shared across the
   * Plan, Outflows, Income and Savings tabs, so switching tabs keeps the month
   * you were on instead of jumping back to the calendar month. It resets to the
   * current month on a fresh load. This is navigation state only — never synced
   * to the sheet (ADR-0001).
   */
  selectedMonth: Month;
}

const initialState: AppState = {
  authInitialized: false,
  dataLoading: false,
  dataLoaded: false,
  syncing: false,
  offline: false,
  selectedMonth: getCurrentMonth(),
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setAuthInitialized: (state, action: PayloadAction<boolean>) => {
      state.authInitialized = action.payload;
    },
    setDataLoading: (state, action: PayloadAction<boolean>) => {
      state.dataLoading = action.payload;
      if (action.payload) {
        state.dataLoaded = false;
      }
    },
    setDataLoaded: (state, action: PayloadAction<boolean>) => {
      state.dataLoaded = action.payload;
      if (action.payload) {
        state.dataLoading = false;
      }
    },
    setSyncing: (state, action: PayloadAction<boolean>) => {
      state.syncing = action.payload;
    },
    setOffline: (state, action: PayloadAction<boolean>) => {
      state.offline = action.payload;
    },
    setSelectedMonth: (state, action: PayloadAction<Month>) => {
      state.selectedMonth = action.payload;
    },
  },
});

export const {
  setAuthInitialized,
  setDataLoading,
  setDataLoaded,
  setSyncing,
  setOffline,
  setSelectedMonth,
} = appSlice.actions;

export default appSlice.reducer;
