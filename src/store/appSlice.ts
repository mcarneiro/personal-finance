import { createSlice, PayloadAction } from '@reduxjs/toolkit';

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
}

const initialState: AppState = {
  authInitialized: false,
  dataLoading: false,
  dataLoaded: false,
  syncing: false,
  offline: false,
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
  },
});

export const { setAuthInitialized, setDataLoading, setDataLoaded, setSyncing, setOffline } =
  appSlice.actions;

export default appSlice.reducer;
