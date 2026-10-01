import { SHEET_CONTRACT_VERSION } from '../config/google';
import type { SheetData } from '../types';

/**
 * Local persistence of the Working Copy (CONTEXT.md, ADR-0007). The last merged
 * snapshot of every tab is written here after a successful pull or push and
 * painted on the next startup while the fresh pull is still in flight, so the
 * app no longer gates behind the network. The sheet remains the only source of
 * truth; this is only ever a cache.
 *
 * A cache is keyed by spreadsheet id and stamped with the sheet contract
 * version, so switching sheets in Settings — or shipping a new column contract
 * — never reuses another shape's data.
 */
const CACHE_KEY_PREFIX = 'planoo:workingCopy:';

/** Bump when the cached payload's shape changes, not the sheet contract. */
const CACHE_FORMAT_VERSION = 1;

interface CachedWorkingCopy {
  formatVersion: number;
  spreadsheetId: string;
  contractVersion: string;
  data: SheetData;
}

const SHEET_DATA_KEYS = [
  'cards',
  'banks',
  'payers',
  'planItems',
  'cardSpending',
  'bills',
  'income',
] as const;

/** A stored payload is only a Working Copy when every tab is present as an array. */
function isSheetData(value: unknown): value is SheetData {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return SHEET_DATA_KEYS.every((key) => Array.isArray(record[key]));
}

function cacheKey(spreadsheetId: string): string {
  return `${CACHE_KEY_PREFIX}${spreadsheetId}`;
}

/**
 * The cached snapshot for a connected sheet, or null when there is none, when
 * it belongs to a different sheet, or when it was stamped against a different
 * sheet contract or cache format. A stale entry is discarded on read.
 */
export function loadWorkingCopy(spreadsheetId: string): SheetData | null {
  try {
    const raw = localStorage.getItem(cacheKey(spreadsheetId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CachedWorkingCopy>;
    if (
      parsed.formatVersion !== CACHE_FORMAT_VERSION ||
      parsed.spreadsheetId !== spreadsheetId ||
      parsed.contractVersion !== SHEET_CONTRACT_VERSION ||
      !isSheetData(parsed.data)
    ) {
      clearWorkingCopy(spreadsheetId);
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.error('Failed to read the cached Working Copy:', error);
    clearWorkingCopy(spreadsheetId);
    return null;
  }
}

/** Persist the merged snapshot for a connected sheet (best effort). */
export function saveWorkingCopy(spreadsheetId: string, data: SheetData): void {
  const entry: CachedWorkingCopy = {
    formatVersion: CACHE_FORMAT_VERSION,
    spreadsheetId,
    contractVersion: SHEET_CONTRACT_VERSION,
    data,
  };

  try {
    localStorage.setItem(cacheKey(spreadsheetId), JSON.stringify(entry));
  } catch (error) {
    // A full or unavailable storage must never break a successful sync.
    console.error('Failed to cache the Working Copy:', error);
  }
}

/** Drop a connected sheet's cached snapshot (a stale or discarded cache). */
export function clearWorkingCopy(spreadsheetId: string): void {
  try {
    localStorage.removeItem(cacheKey(spreadsheetId));
  } catch {
    // Nothing to do: a cache that cannot be removed is still only a cache.
  }
}
