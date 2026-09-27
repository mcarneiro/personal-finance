import { describe, expect, it } from 'vitest';
import type { PlanItem } from '../../types';
import { copyPlanItems } from '../planCopy';

const MAY = '2026-05';
const JUNE = '2026-06';

function planItem(overrides: Partial<PlanItem>): PlanItem {
  return {
    id: 'source',
    month: MAY,
    kind: 'fixed',
    name: 'Internet',
    amount: 110,
    remainingEstimate: 0,
    ...overrides,
  };
}

describe('copyPlanItems', () => {
  it('copies names, kinds and amounts into the target month', () => {
    // Given last month's plan of a bucket and a fixed charge
    const source = [
      planItem({ id: 'a', kind: 'variable', name: 'Mercado/Farmácia', amount: 6000 }),
      planItem({ id: 'b', kind: 'fixed', name: 'Internet', amount: 110 }),
    ];

    // When I copy it into the target month
    const copies = copyPlanItems(source, JUNE);

    // Then the composition carries over into the target month
    expect(copies).toEqual([
      expect.objectContaining({
        month: JUNE,
        kind: 'variable',
        name: 'Mercado/Farmácia',
        amount: 6000,
      }),
      expect.objectContaining({ month: JUNE, kind: 'fixed', name: 'Internet', amount: 110 }),
    ]);
  });

  it('starts every remaining estimate at zero', () => {
    // Given last month's bucket still carried a remaining estimate
    const source = [
      planItem({ id: 'a', kind: 'variable', name: 'Restaurante', amount: 1200, remainingEstimate: 250 }),
    ];

    // When I copy it
    const copies = copyPlanItems(source, JUNE);

    // Then last month's forecast never leaks into the new month
    expect(copies[0].remainingEstimate).toBe(0);
  });

  it('gives every copy a fresh id so it cannot collide with its source', () => {
    // Given last month's items carry their own ids
    const source = [
      planItem({ id: 'a', name: 'Internet' }),
      planItem({ id: 'b', name: 'Gym' }),
    ];

    // When I copy them
    const copies = copyPlanItems(source, JUNE);

    // Then every copy is keyed by a new, distinct id
    const ids = copies.map((copy) => copy.id);
    expect(ids).not.toContain('a');
    expect(ids).not.toContain('b');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('copies nothing when last month had no plan', () => {
    // Given last month had no plan
    // When I copy it
    // Then the target month stays empty
    expect(copyPlanItems([], JUNE)).toEqual([]);
  });
});
