import { useCallback, useEffect, useRef, useState } from 'react';
import { googleSheetsService } from '../services/GoogleSheetsService';
import { useAppSelector } from '../store/hooks';
import { monthHasRecords } from '../utils/copyGuard';
import type { Month } from '../types';

/** The list tabs that offer a copy-last-month action. */
export type CopyTab = 'plan' | 'bills' | 'income';

/**
 * Read one list tab's current rows straight from the sheet. The per-tab readers
 * are the same code the pull uses, so the guard sees exactly what a fresh pull
 * would; only the target month is inspected by the caller.
 */
const READERS: Record<CopyTab, (sheetId: string) => Promise<Array<{ month: Month }>>> = {
  plan: (sheetId: string) => googleSheetsService.readPlanItems(sheetId),
  bills: (sheetId: string) => googleSheetsService.readBills(sheetId),
  income: (sheetId: string) => googleSheetsService.readIncome(sheetId),
};

export interface CopyGuard {
  /** True when the last attempt found the target month already populated. */
  blocked: boolean;
  /** True when the last attempt could not check the sheet (auth/offline). */
  checkFailed: boolean;
  /**
   * Re-read the target month from the sheet immediately before replicating.
   * Returns true when the month is still empty and the copy may proceed; a
   * populated month (or a failed read) returns false so nothing is duplicated.
   */
  canCopy: () => Promise<boolean>;
}

/**
 * The copy-last-month duplicate guard (ADR-0008). Truly simultaneous taps can
 * still double-replicate (accepted residual); this closes the common case where
 * the first member's copy already reached the sheet before the second taps.
 */export function useCopyGuard(tab: CopyTab, month: Month | undefined): CopyGuard {
  const sheetId = useAppSelector((state) => state.settings.sheetId);
  const [blocked, setBlocked] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  // One in-flight attempt at a time. A second tap while the first re-read is
  // still outstanding is refused: re-reading the same (still empty) sheet would
  // append a second set of records — exactly the double-replicate this guard
  // exists to prevent. The first tap keeps ownership of the copy.
  const inFlight = useRef(false);

  // A notice explains the month it was raised for, so a month change starts clean.
  useEffect(() => {
    setBlocked(false);
    setCheckFailed(false);
  }, [month]);

  const canCopy = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBlocked(false);
    setCheckFailed(false);
    try {
      if (!sheetId || !month) {
        setCheckFailed(true);
        return false;
      }
      const fresh = await READERS[tab](sheetId);
      if (monthHasRecords(fresh, month)) {
        setBlocked(true);
        return false;
      }
      return true;
    } catch (error) {
      // Never copy when the sheet could not be checked: a duplicate is worse
      // than a copy the member can retry.
      console.error('Failed to check the target month before copying:', error);
      setCheckFailed(true);
      return false;
    } finally {
      inFlight.current = false;
    }
  }, [sheetId, month, tab]);

  return { blocked, checkFailed, canCopy };
}
