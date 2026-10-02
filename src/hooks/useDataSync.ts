import { useEffect, useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useGoogleAuth } from '../contexts/GoogleAuthContext';
import { googleSheetsService } from '../services/GoogleSheetsService';
import { loadWorkingCopy, saveWorkingCopy } from '../services/workingCopyCache';
import { mergeSheetData } from '../utils/mergePendingChanges';
import { setCards } from '../store/cardsSlice';
import { setBanks } from '../store/banksSlice';
import { setPayers } from '../store/payersSlice';
import { setPlanItems, setCardSpending } from '../store/planSlice';
import { setOutflows } from '../store/outflowsSlice';
import { setIncomeEntries } from '../store/incomeSlice';
import { setDataLoading, setDataLoaded, setSyncing, setOffline } from '../store/appSlice';
import { clearPendingChanges, dropPendingChanges } from '../store/pendingSlice';
import { SHEET_KEYS } from '../config/google';
import type { SheetData } from '../types';

/**
 * A pull runs on app open and on focus, but no more often than this: the
 * household edits together, so a fresh enough Working Copy is cheap while a
 * pull on every focus would burn Sheets quota (ADR-0007).
 */
const MIN_PULL_INTERVAL_MS = 30_000;

const EMPTY_SHEET: SheetData = {
  cards: [],
  banks: [],
  payers: [],
  planItems: [],
  cardSpending: [],
  outflows: [],
  income: [],
  savingsPots: [],
  savingsBalances: [],
};

/**
 * The pull side of the sync cycle (ADR-0007). Reads every tab in a single
 * Sheets request, replays this device's Pending Changes over the fresh rows
 * (local always wins, ADR-0008), swaps the merged snapshot into the store, and
 * then pushes any Pending Changes still unwritten — so an edit whose earlier
 * write failed retries on the next pull. A successful push drops them.
 *
 * Startup no longer gates behind the network: a cached Working Copy is painted
 * synchronously, and the pull swaps in fresh data seconds later. A cold cache
 * (first-ever connect, or a different sheet) still owns the loading gate. A
 * failed pull keeps its last-saved data and raises the offline hint; a cold
 * cache that cannot load stays gated rather than opening an editable empty app.
 *
 * Saving is handled by the sync listener middleware (`syncListener.ts`), which
 * persists the Working Copy after every successful write.
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
  // Only the first pull attempt of a session owns the startup loading gate.
  const hasAttempted = useRef(false);
  const lastPullAt = useRef(0);
  // The sheet whose session is active. Switching sheets in Settings resets the
  // session so the previous sheet's data is never shown and the new sheet's
  // schema is verified from scratch.
  const activeSheet = useRef<string | null>(null);
  // The sheet whose schema has been verified against the contract — from a
  // stamped cache or a completed pull. Later pulls skip the header checks.
  const schemaVerifiedFor = useRef<string | null>(null);
  // Whether there is data to paint if the next pull fails. Only then does the
  // offline hint apply; a cold cache has nothing saved to show.
  const hasWorkingCopy = useRef(false);
  // Bumped whenever the active sheet changes, so a pull that was in flight for
  // the previous sheet can be discarded instead of painting stale data over the
  // new one.
  const generation = useRef(0);

  const applySnapshot = useCallback(
    (data: SheetData) => {
      dispatch(setCards(data.cards));
      dispatch(setBanks(data.banks));
      dispatch(setPayers(data.payers));
      dispatch(setPlanItems(data.planItems));
      dispatch(setCardSpending(data.cardSpending));
      dispatch(setOutflows(data.outflows));
      dispatch(setIncomeEntries(data.income));
    },
    [dispatch]
  );

  /**
   * Start (or detect a change of) the active sheet. A stamped cache is painted
   * immediately — before any Sheets request settles — and marks the session as
   * already warmed, so the pull that follows is a background swap, not the
   * startup gate. Without a cache the store is cleared so a previous sheet's
   * data is never shown while the fresh read is in flight.
   */
  const beginSession = useCallback(
    (connectedSheetId: string) => {
      if (activeSheet.current === connectedSheetId) return;
      const isSheetSwitch = activeSheet.current !== null;
      activeSheet.current = connectedSheetId;
      generation.current += 1;
      hasAttempted.current = false;
      lastPullAt.current = 0;
      schemaVerifiedFor.current = null;
      hasWorkingCopy.current = false;
      // Edits recorded against a previous sheet must not replay over — or be
      // pushed to — this one. Nothing is cleared on the first session: any
      // pending state already belongs to the sheet being connected.
      if (isSheetSwitch) dispatch(clearPendingChanges());

      const cached = loadWorkingCopy(connectedSheetId);
      if (cached) {
        applySnapshot(cached);
        hasAttempted.current = true; // the pull below is a background swap
        schemaVerifiedFor.current = connectedSheetId;
        hasWorkingCopy.current = true;
        dispatch(setDataLoaded(true));
        dispatch(setOffline(false));
      } else {
        applySnapshot(EMPTY_SHEET);
      }
    },
    [applySnapshot, dispatch]
  );

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

  /** Pull every tab, merge the Pending Changes, swap the snapshot in, cache it. */
  const loadData = useCallback(async () => {
    if (!isSignedIn || !sheetId) return;

    // Paint a warm cache (or clear for a cold one) before any request settles.
    // Done before the in-flight guard so a sheet change mid-pull is never
    // ignored: the new sheet is set up now and pulled when the slot frees.
    beginSession(sheetId);
    if (inFlight.current) return;

    const session = generation.current;
    inFlight.current = true;
    const isStartup = !hasAttempted.current;
    // Stamp the attempt up front so the throttle counts failed pulls too: a
    // focus storm after an offline pull waits for the next window.
    lastPullAt.current = Date.now();
    dispatch(setSyncing(true));
    if (isStartup) dispatch(setDataLoading(true));

    try {
      // With a cache stamped for this sheet and contract, the schema is known
      // good and the header checks are skipped (ADR-0007).
      const fresh = await googleSheetsService.pullAll(sheetId, {
        verifySchema: schemaVerifiedFor.current !== sheetId,
      });
      if (generation.current !== session) return; // the sheet changed mid-pull
      schemaVerifiedFor.current = sheetId;
      const merged = mergeSheetData(fresh, pendingRef.current);

      applySnapshot(merged);
      hasWorkingCopy.current = true;
      dispatch(setDataLoaded(true));
      dispatch(setOffline(false));

      // Retry any Pending Change whose earlier write failed: with fresh rows in
      // hand, push the local edits (local wins, ADR-0008) and drop the ones the
      // write carried. A failed push keeps them for the next pull or save.
      const pendingNow = pendingRef.current;
      try {
        await googleSheetsService.writePendingChanges(sheetId, pendingNow);
        for (const tab of SHEET_KEYS) {
          const tabChanges = pendingNow[tab];
          if (tabChanges) dispatch(dropPendingChanges({ tab, changes: tabChanges }));
        }
      } catch (error) {
        handleApiError(error as Error & { code?: string });
      }
      if (generation.current !== session) return;

      saveWorkingCopy(sheetId, merged);
    } catch (error) {
      if (generation.current !== session) return;
      handleApiError(error as Error & { code?: string });
      if (isStartup) {
        // Nothing has been saved for this sheet yet, so there is no last-saved
        // data to paint: leave the gate up rather than open an editable empty
        // app whose first edit could overwrite the sheet (ADR-0007). A later
        // pull (on focus) is background and reveals the app on success.
        dispatch(setOffline(false));
      } else {
        // Keep last-saved data visible and say so instead of showing nothing.
        dispatch(setOffline(hasWorkingCopy.current));
      }
    } finally {
      inFlight.current = false;
      if (generation.current === session) {
        hasAttempted.current = true;
        dispatch(setSyncing(false));
      } else {
        // The sheet changed while this pull was in flight: drop its result and
        // start the new sheet's pull now that the slot is free.
        loadDataRef.current();
      }
    }
  }, [isSignedIn, sheetId, dispatch, handleApiError, beginSession, applySnapshot]);

  // Referenced from `loadData`'s restart path; kept current by an effect so it
  // always points at the latest closure (newest sheetId).
  const loadDataRef = useRef<() => void>(() => {});
  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

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
