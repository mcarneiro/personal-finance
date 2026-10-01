import { vi } from 'vitest';
import type { googleSheetsService } from '../services/GoogleSheetsService';
import type { SheetKey } from '../config/google';
import type { PendingChange, PendingChanges, SheetRecord, TabPendingChanges } from '../types';

type Service = typeof googleSheetsService;

/**
 * The payload of every row-scoped write a mocked service was called with, in
 * call order. A save now sends only the changed records (ADR-0008), so tests
 * read the Pending Changes payload instead of the device's whole list.
 */
export function writePayloads(service: Service): PendingChanges[] {
  return vi.mocked(service.writePendingChanges).mock.calls.map(([, changes]) => changes);
}

/** The created/updated records of one tab in one write payload. */
function recordsOf<K extends SheetKey>(changes: PendingChanges, tab: K): SheetRecord<K>[] {
  const tabChanges = changes[tab] as TabPendingChanges<SheetRecord<K>> | undefined;
  return Object.values(tabChanges ?? {}).flatMap((change) =>
    change.type === 'delete' ? [] : [change.record]
  );
}

/** Every Pending Change written for one tab, across all write calls. */
export function writtenChanges<K extends SheetKey>(
  service: Service,
  tab: K
): PendingChange<SheetRecord<K>>[] {
  return writePayloads(service).flatMap((changes) => {
    const tabChanges = changes[tab] as TabPendingChanges<SheetRecord<K>> | undefined;
    return Object.values(tabChanges ?? {});
  });
}

/** Every created/updated record written for one tab, across all write calls. */
export function writtenRecords<K extends SheetKey>(service: Service, tab: K): SheetRecord<K>[] {
  return writePayloads(service).flatMap((changes) => recordsOf(changes, tab));
}

/** The created/updated records of one tab from the most recent write call. */
export function lastWrittenRecords<K extends SheetKey>(service: Service, tab: K): SheetRecord<K>[] {
  const payloads = writePayloads(service);
  const last = payloads[payloads.length - 1];
  return last ? recordsOf(last, tab) : [];
}
