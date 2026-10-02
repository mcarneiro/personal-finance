import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Turns the value parsed from storage into a usable one, or `null` when the
 * stored shape is not valid; a null result falls back to the default.
 */
export type PersistentParser<T> = (raw: unknown) => T | null;

/**
 * A view preference of any JSON-serialisable shape that outlives the session.
 * The value is read from `localStorage` once, on mount, and written back on
 * every change, so a choice like "only show Guta's outflows" survives a reload.
 *
 * This is presentation state only — never a derived number and never synced to
 * the sheet (ADR-0001). Storage failures (private mode, full quota) and a
 * corrupt, stale or hand-edited value are swallowed via `parse`, so an
 * unremembered preference can never break the screen.
 */
export function usePersistentState<T>(
  key: string,
  fallback: T,
  parse?: PersistentParser<T>
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return fallback;
      const parsed: unknown = JSON.parse(stored);
      const usable = parse ? parse(parsed) : (parsed as T);
      return usable === null ? fallback : usable;
    } catch {
      return fallback;
    }
  });

  const setPersistent = useCallback<Dispatch<SetStateAction<T>>>(
    (action) => {
      setValue((current) => {
        const next =
          typeof action === 'function' ? (action as (prev: T) => T)(current) : action;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Nothing to do: a preference that cannot be stored still works in-session.
        }
        return next;
      });
    },
    [key]
  );

  return [value, setPersistent];
}
