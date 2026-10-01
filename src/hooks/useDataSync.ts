import { useEffect, useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useGoogleAuth } from '../contexts/GoogleAuthContext';
import { googleSheetsService } from '../services/GoogleSheetsService';
import { mergeSheetData } from '../utils/mergePendingChanges';
import { setCards } from '../store/cardsSlice';
import { setBanks } from '../store/banksSlice';
import { setPayers } from '../store/payersSlice';
import { setPlanItems, setCardSpending } from '../store/planSlice';
import { setBills } from '../store/billsSlice';
import { setIncomeEntries } from '../store/incomeSlice';
import { setDataLoading, setDataLoaded, setSyncing } from '../store/appSlice';

/**
 * A pull runs on app open and on focus, but no more often than this: the
 * household edits together, so a fresh enough Working Copy is cheap while a
 * pull on every focus would burn Sheets quota (ADR-0007).
 */
const MIN_PULL_INTERVAL_MS = 30_000;

/**
 * The pull side of the sync cycle (ADR-0007). Reads every tab in a single
 * Sheets request, replays this device's Pending Changes over the fresh rows
 * (local always wins, ADR-0008), and swaps the merged snapshot into the store.
 *
 * The first pull of a session owns the startup loading gate; every later pull is
 * a silent background swap that only toggles the subtle syncing indicator.
 * Saving is handled by the sync listener middleware (`syncListener.ts`).
 */
export function useDataSync() {
  const dispatch = useAppDispatch();
  const { isSignedIn, accessToken, signOut } = useGoogleAuth();
  const sheetId = useAppSelector((state) => state.settings.sheetId);
  const pending = useAppSelector((state) => state.pending.changes);
  // Read the freshest Pending Changes without making `pull` change identity on
  // every edit — that would re-subscribe the focus listener on each keystroke.
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const inFlight = useRef(false);
  // Only the first pull attempt of a session owns the startup loading gate. A
  // failed first attempt must not re-gate the UI when a later focus pull retries.
  const hasAttempted = useRef(false);
  const lastPullAt = useRef(0);

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

  /** Pull every tab, merge the Pending Changes, and swap the snapshot in. */
  const loadData = useCallback(async () => {
    if (!isSignedIn || !sheetId || inFlight.current) return;

    inFlight.current = true;
    const isStartup = !hasAttempted.current;
    // Stamp the attempt up front so the throttle counts failed pulls too: a
    // focus storm after an offline pull waits for the next window, and the
    // startup attempt can never re-open the loading gate.
    lastPullAt.current = Date.now();
    dispatch(setSyncing(true));
    if (isStartup) dispatch(setDataLoading(true));

    try {
      // One Sheets request for headers and data alike; the service creates any
      // missing tab, re-heads a drifted header and migrates the legacy plan.
      const fresh = await googleSheetsService.pullAll(sheetId);
      const merged = mergeSheetData(fresh, pendingRef.current);

      dispatch(setCards(merged.cards));
      dispatch(setBanks(merged.banks));
      dispatch(setPayers(merged.payers));
      dispatch(setPlanItems(merged.planItems));
      dispatch(setCardSpending(merged.cardSpending));
      dispatch(setBills(merged.bills));
      dispatch(setIncomeEntries(merged.income));

      dispatch(setDataLoaded(true));
    } catch (error) {
      handleApiError(error as Error & { code?: string });
      // Clear the startup gate so a failed first pull does not strand the user
      // on the loading screen (ADR-0007's offline hint arrives with the cache).
      if (isStartup) {
        dispatch(setDataLoading(false));
        dispatch(setDataLoaded(false));
      }
    } finally {
      hasAttempted.current = true;
      inFlight.current = false;
      dispatch(setSyncing(false));
    }
  }, [isSignedIn, sheetId, dispatch, handleApiError]);

  // Pull on open, and again whenever the connection becomes ready.
  useEffect(() => {
    if (isSignedIn && sheetId && accessToken) {
      loadData();
    }
  }, [isSignedIn, sheetId, accessToken, loadData]);

  // Pull on window/app focus, throttled, and ignored while one is in flight.
  useEffect(() => {
    const maybePull = () => {
      if (inFlight.current) return;
      if (Date.now() - lastPullAt.current < MIN_PULL_INTERVAL_MS) return;
      loadData();
    };
    const onFocus = () => maybePull();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') maybePull();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [loadData]);

  return { loadData };
}
