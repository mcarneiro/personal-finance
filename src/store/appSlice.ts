import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AppState {
  dataLoading: boolean;
  dataLoaded: boolean;
}

const initialState: AppState = {
  dataLoading: false,
  dataLoaded: false,
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
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
  },
});

export const { setDataLoading, setDataLoaded } = appSlice.actions;

export default appSlice.reducer;
