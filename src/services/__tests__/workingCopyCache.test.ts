import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SHEET_CONTRACT_VERSION } from '../../config/google';
import type { SheetData } from '../../types';
import { clearWorkingCopy, loadWorkingCopy, saveWorkingCopy } from '../workingCopyCache';

function snapshot(overrides: Partial<SheetData> = {}): SheetData {
  return {
    cards: [{ id: 'c1', name: 'cc guta' }],
    banks: [{ id: 'bank-1', name: 'Nubank' }],
    payers: [{ id: 'payer-1', name: 'Marcelo' }],
    planItems: [
      { id: 'pl1', month: '2026-06', name: 'Mercado', amount: 500, remainingEstimate: 250 },
    ],
    cardSpending: [{ id: 'cs1', month: '2026-06', cardId: 'c1', total: 100 }],
    outflows: [
      {
        id: 'b1',
        month: '2026-06',
        name: 'Luz',
        amount: 120,
        isPaid: false,
        isFinal: true,
        payerId: 'payer-1',
        bankId: 'bank-1',
      },
    ],
    income: [{ id: 'i1', month: '2026-06', amount: 3000, source: 'Salário' }],
    ...overrides,
  };
}

/** The raw stored entry, so a test can write one the app itself would not. */
function rawEntry(overrides: Record<string, unknown>): string {
  return JSON.stringify({
    formatVersion: 1,
    spreadsheetId: 'sheet-1',
    contractVersion: SHEET_CONTRACT_VERSION,
    savedAt: 1,
    data: snapshot(),
    ...overrides,
  });
}

describe('Working Copy cache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads back the snapshot it saved for a sheet', () => {
    // Given a cached snapshot for a connected sheet
    const data = snapshot();

    // When it is saved and read back
    saveWorkingCopy('sheet-1', data);

    // Then the same snapshot comes back
    expect(loadWorkingCopy('sheet-1')).toEqual(data);
  });

  it('returns nothing for a sheet with no cache', () => {
    // Given a cache exists only for a different sheet
    saveWorkingCopy('sheet-1', snapshot());

    // When another sheet is looked up
    // Then this sheet has no working copy of its own
    expect(loadWorkingCopy('sheet-2')).toBeNull();
  });

  it('does not reuse a cache across a Settings sheet change', () => {
    // Given sheet-1 has a cached snapshot
    saveWorkingCopy('sheet-1', snapshot({ outflows: [] }));

    // When the household connects a different sheet with different data
    saveWorkingCopy('sheet-2', snapshot());

    // Then each sheet reads only its own snapshot
    expect(loadWorkingCopy('sheet-1')?.outflows).toEqual([]);
    expect(loadWorkingCopy('sheet-2')?.outflows).toHaveLength(1);
  });

  it('discards a cache stamped with a different sheet contract version', () => {
    // Given a cache written against an older column contract
    localStorage.setItem(
      'planyoo:workingCopy:sheet-1',
      rawEntry({ contractVersion: 'cards(id,name)|legacy' })
    );

    // When it is read against the current contract
    // Then it is rejected...
    expect(loadWorkingCopy('sheet-1')).toBeNull();
    // ...and dropped, so it is not re-checked on every startup
    expect(localStorage.getItem('planyoo:workingCopy:sheet-1')).toBeNull();
  });

  it('discards a cache written in an older storage format', () => {
    // Given a cache from an older payload shape
    localStorage.setItem('planyoo:workingCopy:sheet-1', rawEntry({ formatVersion: 0 }));

    // When it is read
    // Then it is rejected and cleared
    expect(loadWorkingCopy('sheet-1')).toBeNull();
    expect(localStorage.getItem('planyoo:workingCopy:sheet-1')).toBeNull();
  });

  it('discards a cache whose payload is not a full snapshot', () => {
    // Given a cache whose data is not the expected snapshot shape
    localStorage.setItem('planyoo:workingCopy:sheet-1', rawEntry({ data: 42 }));

    // When it is read
    // Then it is rejected and cleared rather than dispatched into the store
    expect(loadWorkingCopy('sheet-1')).toBeNull();
    expect(localStorage.getItem('planyoo:workingCopy:sheet-1')).toBeNull();
  });

  it('survives a corrupt cache entry instead of throwing', () => {
    // Given storage holds something that is not valid JSON
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('planyoo:workingCopy:sheet-1', '{not json');

    // When it is read
    // Then it returns nothing and clears the bad entry
    expect(loadWorkingCopy('sheet-1')).toBeNull();
    expect(localStorage.getItem('planyoo:workingCopy:sheet-1')).toBeNull();
  });

  it('clears a cached snapshot on request', () => {
    // Given a cached snapshot
    saveWorkingCopy('sheet-1', snapshot());

    // When the cache is cleared
    clearWorkingCopy('sheet-1');

    // Then it is gone
    expect(loadWorkingCopy('sheet-1')).toBeNull();
  });
});
