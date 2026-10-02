import type { Month } from '../types';

/**
 * Whether a freshly-read tab already holds a record for the target month — the
 * duplicate guard the copy-last-month actions run immediately before
 * replicating (ADR-0008). Re-reading from the sheet, rather than trusting the
 * device's Working Copy, means a second member's tap is blocked once the first
 * copy has reached the sheet, instead of seeding a second set of records.
 * Pure: no I/O, no state, no side effects.
 */
export function monthHasRecords<T extends { month: Month }>(records: T[], month: Month): boolean {
  return records.some((record) => record.month === month);
}
