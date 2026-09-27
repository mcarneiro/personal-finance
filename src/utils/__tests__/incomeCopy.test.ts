import { describe, expect, it } from 'vitest';
import type { IncomeEntry } from '../../types';
import { copyIncomeEntries } from '../incomeCopy';

const MAY = '2026-05';
const JUNE = '2026-06';

function entry(overrides: Partial<IncomeEntry>): IncomeEntry {
  return { id: 'source', month: MAY, amount: 12000, source: 'Salário', ...overrides };
}

describe('copyIncomeEntries', () => {
  it('copies amounts and source notes into the target month', () => {
    // Given last month's income: a salary and a one-off extra
    const source = [
      entry({ id: 'a', amount: 12000, source: 'Salário' }),
      entry({ id: 'b', amount: 500, source: 'Freela' }),
    ];

    // When I replicate it into the target month
    const copies = copyIncomeEntries(source, JUNE);

    // Then both entries carry over with their amounts and notes
    expect(copies).toEqual([
      expect.objectContaining({ month: JUNE, amount: 12000, source: 'Salário' }),
      expect.objectContaining({ month: JUNE, amount: 500, source: 'Freela' }),
    ]);
  });

  it('keeps an entry without a source note as recorded', () => {
    // Given last month had an entry with no source note
    const source = [entry({ id: 'a', amount: 800, source: undefined })];

    // When I replicate it
    const copies = copyIncomeEntries(source, JUNE);

    // Then the copy also has no source note
    expect(copies[0].source).toBeUndefined();
  });

  it('gives every copy a fresh id so it cannot collide with its source', () => {
    // Given last month's entries carry their own ids
    const source = [entry({ id: 'a', source: 'Salário' }), entry({ id: 'b', source: 'Extra' })];

    // When I replicate them
    const copies = copyIncomeEntries(source, JUNE);

    // Then every copy is keyed by a new, distinct id
    const ids = copies.map((copy) => copy.id);
    expect(ids).not.toContain('a');
    expect(ids).not.toContain('b');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('copies nothing when last month had no income', () => {
    // Given last month had no income
    // When I replicate it
    // Then the target month stays empty
    expect(copyIncomeEntries([], JUNE)).toEqual([]);
  });
});
