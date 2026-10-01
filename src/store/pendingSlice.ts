import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SheetKey } from '../config/google';
import type { PendingChange, PendingChanges } from '../types';

/** The record shape every Pending Change is structurally keyed by. */
type AnyPendingChange = PendingChange<{ id: string }>;
type AnyTabPendingChanges = Record<string, AnyPendingChange>;

export interface PendingState {
  changes: PendingChanges;
}

const initialState: PendingState = { changes: {} };

function recordsEqual(a: { id: string }, b: { id: string }): boolean {
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  const bKeys = Object.keys(bRecord);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => aRecord[key] === bRecord[key]);
}

/**
 * The two edits are the same when their kind, id and (for create/update) record
 * agree. Used to drop a written Pending Change without dropping a newer edit for
 * the same record that landed while the write was in flight.
 */
export function pendingChangesEqual(a: AnyPendingChange, b: AnyPendingChange): boolean {
  if (a.type !== b.type || a.id !== b.id) return false;
  if (a.type === 'delete' || b.type === 'delete') return true;
  return recordsEqual(a.record, b.record);
}

interface RecordPendingPayload {
  tab: SheetKey;
  change: AnyPendingChange;
}

interface DropPendingPayload {
  tab: SheetKey;
  changes: AnyTabPendingChanges;
}

/**
 * The device's Pending Changes (CONTEXT.md): edits made locally but not yet
 * written to the sheet. They are replayed over every fresh pull so a local edit
 * always wins, and dropped once the write that carried them succeeds.
 */
const pendingSlice = createSlice({
  name: 'pending',
  initialState,
  reducers: {
    recordPendingChange(state, action: PayloadAction<RecordPendingPayload>) {
      const target = state.changes as Record<SheetKey, AnyTabPendingChanges>;
      const tabChanges = target[action.payload.tab] ?? {};
      tabChanges[action.payload.change.id] = action.payload.change;
      target[action.payload.tab] = tabChanges;
    },
    /**
     * Drop the edited Pending Changes a successful write carried. Only changes
     * still identical to the written snapshot are dropped, so an edit that
     * arrived during the write is kept and retried.
     */
    dropPendingChanges(state, action: PayloadAction<DropPendingPayload>) {
      const target = state.changes as Record<SheetKey, AnyTabPendingChanges>;
      const tabChanges = target[action.payload.tab] ?? {};
      for (const [id, written] of Object.entries(action.payload.changes)) {
        const current = tabChanges[id];
        if (current && pendingChangesEqual(current, written)) delete tabChanges[id];
      }
      target[action.payload.tab] = tabChanges;
    },
  },
});

export const { recordPendingChange, dropPendingChanges } = pendingSlice.actions;

export default pendingSlice.reducer;
