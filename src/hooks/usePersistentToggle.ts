import { useCallback } from 'react';
import { usePersistentState } from './usePersistentState';

/**
 * A boolean view preference that outlives the session. The value is read from
 * `localStorage` once, on mount, and written back on every change, so a choice
 * like "also show the amount still to pay" survives a reload.
 *
 * This is presentation state only — never a derived number and never synced to
 * the sheet (ADR-0001). Storage failures (private mode, full quota) are
 * swallowed: an unremembered toggle must never break the screen.
 */
export function usePersistentToggle(key: string, fallback = false): [boolean, () => void] {
  const [enabled, setEnabled] = usePersistentState<boolean>(key, fallback);

  const toggle = useCallback(() => {
    setEnabled((current) => !current);
  }, [setEnabled]);

  return [enabled, toggle];
}
