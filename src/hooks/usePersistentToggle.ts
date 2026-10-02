import { useCallback, useState } from 'react';

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
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? fallback : stored === 'true';
    } catch {
      return fallback;
    }
  });

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      try {
        localStorage.setItem(key, String(next));
      } catch {
        // Nothing to do: a preference that cannot be stored still works in-session.
      }
      return next;
    });
  }, [key]);

  return [enabled, toggle];
}
