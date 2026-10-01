import type { TabPendingChanges } from '../types';

/** A row is blank when it carries no id — a blank hole left by a delete. */
function isBlankRow(row: { id: string }): boolean {
  return row.id === undefined || row.id === null || String(row.id).trim() === '';
}

/**
 * Replay a device's Pending Changes over the fresh rows of one tab. Pure: no
 * timeouts, dispatch, or Sheets calls — the same kind of derived operation as
 * the control-loop utilities.
 *
 * A Pending Change always wins over a fresh row with the same id, so a Lost
 * Update cannot survive the merge:
 *
 * - `create`/`update` replace the fresh row with the same id with the local
 *   value; an id absent from the fresh rows is appended (upsert), so a record
 *   created locally — or deleted remotely then edited locally — comes back.
 * - `delete` removes the fresh row with that id and does nothing if it is
 *   already absent.
 * - Blank rows (no id) are skipped, either as a fresh row or as a change.
 * - Fresh rows with no Pending Change pass through undisturbed and in order.
 *
 * A caller with no Pending Changes gets the fresh rows back unchanged.
 */
export function mergePendingChanges<T extends { id: string }>(
  freshRows: readonly T[],
  changes: TabPendingChanges<T> | undefined
): T[] {
  const merged = new Map<string, T>();

  for (const row of freshRows) {
    if (isBlankRow(row)) continue;
    if (!merged.has(row.id)) merged.set(row.id, row);
  }

  for (const change of Object.values(changes ?? {})) {
    if (isBlankRow(change)) continue;
    if (change.type === 'delete') {
      merged.delete(change.id);
      continue;
    }
    // Replacing an existing key keeps its position; an absent key is appended,
    // so a local create (or an upserted edit) lands at the tab's tail.
    merged.set(change.id, change.record);
  }

  return [...merged.values()];
}
