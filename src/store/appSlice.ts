import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AppState {
  authInitialized: boolean;
  dataLoading: boolean;
  dataLoaded: boolean;
  /** True while a background pull is in flight; never gates the UI. */
  syncing: boolean;
}

const initialState: AppState = {
  authInitialized: false,
  dataLoading: false,
  dataLoaded: false,
  syncing: false,
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
  },
});

export const { setAuthInitialized, setDataLoading, setDataLoaded, setSyncing } =
  appSlice.actions;

export default appSlice.reducer;
