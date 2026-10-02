import { describe, expect, it } from 'vitest';
import { monthHasRecords } from '../copyGuard';
import type { Bill } from '../../types';

const JUNE = '2026-06';
const MAY = '2026-05';

function bill(month: string, name: string): Bill {
  return {
    id: `${month}-${name}`,
    month,
    name,
    amount: 10,
    isPaid: false,
    isFinal: false,
    payerId: '',
    bankId: '',
  };
}

describe('monthHasRecords', () => {
  it('is true when the freshly-read rows include the target month', () => {
    // Given fresh rows for May and June
    const rows = [bill(MAY, 'Luz'), bill(JUNE, 'Internet')];

    // When checking the month being replicated into
    // Then it is reported as already populated, so the copy is blocked
    expect(monthHasRecords(rows, JUNE)).toBe(true);
  });

  it('is false when no fresh row belongs to the target month', () => {
    // Given fresh rows for May only
    const rows = [bill(MAY, 'Luz')];

    // When checking the empty target month
    // Then the copy may proceed
    expect(monthHasRecords(rows, JUNE)).toBe(false);
  });

  it('is false for an empty tab', () => {
    // Given a tab with no rows at all
    // When checking the target month
    // Then the copy may proceed
    expect(monthHasRecords([], JUNE)).toBe(false);
  });
});
