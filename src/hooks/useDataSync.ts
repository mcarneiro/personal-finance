import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useGoogleAuth } from '../contexts/GoogleAuthContext';
import { googleSheetsService } from '../services/GoogleSheetsService';
import { setCards } from '../store/cardsSlice';
import { setPlanItems, setCardSpending } from '../store/planSlice';
import { setBills } from '../store/billsSlice';
import { setIncomeEntries } from '../store/incomeSlice';
import { setDataLoading, setDataLoaded } from '../store/appSlice';

/**
 * Loads all data from the connected Google Sheet on start. Saving is handled
 * by the sync listener middleware (`syncListener.ts`); this hook only reads
 * (ported from Stayoo, ADR-0001).
 */
export function useDataSync() {
  const dispatch = useAppDispatch();
  const { isSignedIn, accessToken, signOut } = useGoogleAuth();
  const sheetId = useAppSelector((state) => state.settings.sheetId);

  const handleApiError = useCallback(
    (error: Error & { code?: string }) => {
      if (error?.code === 'TOKEN_EXPIRED') {
        console.error('Token expired, signing out user');
        signOut('expired');
      }
      console.error('API error:', error);
    },
    [signOut]
  );

  // Set access token when available
  useEffect(() => {
    if (accessToken) {
      googleSheetsService.setAccessToken(accessToken);
    }
  }, [accessToken]);

  /** Load all data from Google Sheets. */
  const loadData = useCallback(async () => {
    if (!isSignedIn || !sheetId) return;

    dispatch(setDataLoading(true));

    try {
      const [cards, planItems, cardSpending, bills, income] = await Promise.all([
        googleSheetsService.readCards(sheetId),
        googleSheetsService.readPlanItems(sheetId),
        googleSheetsService.readCardSpending(sheetId),
        googleSheetsService.readBills(sheetId),
        googleSheetsService.readIncome(sheetId),
      ]);

      dispatch(setCards(cards));
      dispatch(setPlanItems(planItems));
      dispatch(setCardSpending(cardSpending));
      dispatch(setBills(bills));
      dispatch(setIncomeEntries(income));

      console.log('Data loaded from Google Sheets');
      dispatch(setDataLoaded(true));
    } catch (error) {
      handleApiError(error as Error & { code?: string });
      // Clear the loading flag too, otherwise the startup gate would strand the
      // user on the loading screen after a failed load.
      dispatch(setDataLoading(false));
      dispatch(setDataLoaded(false));
    }
  }, [isSignedIn, sheetId, dispatch, handleApiError]);

  // Load data on mount (when signed in, sheet ID, and access token are available)
  useEffect(() => {
    if (isSignedIn && sheetId && accessToken) {
      loadData();
    }
  }, [isSignedIn, sheetId, accessToken, loadData]);

  return { loadData };
}
