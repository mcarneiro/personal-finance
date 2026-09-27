import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * Settings state is connection-level only (not month-scoped): the ID of the
 * connected Google Sheet, persisted to localStorage so the connection survives
 * reloads. The card registry lives in `cardsSlice`.
 */
interface SettingsState {
  sheetId: string | null;
}

const initialState: SettingsState = {
  sheetId: localStorage.getItem('sheetId') || null,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setSheetId: (state, action: PayloadAction<string>) => {
      state.sheetId = action.payload;
      localStorage.setItem('sheetId', action.payload);
    },
    clearSheetId: (state) => {
      state.sheetId = null;
      localStorage.removeItem('sheetId');
    },
  },
});

export const { setSheetId, clearSheetId } = settingsSlice.actions;

export default settingsSlice.reducer;
