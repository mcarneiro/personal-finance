import { describe, expect, it } from 'vitest';
import { copyOutflows } from '../outflowCopy';
import { copyPlanItems } from '../planCopy';
import { copyIncomeEntries } from '../incomeCopy';
import type { Outflow, IncomeEntry, PlanItem } from '../../types';

const JUNE = '2026-06';
const MAY = '2026-05';

/**
 * A copy seeds a whole month: last month's records are not unique by name, and
 * every copy must be its own record. Ids that collide would key the Pending
 * Changes onto each other, so only one copy would ever reach the sheet.
 */
function expectUniqueIds(ids: string[]) {
  expect(new Set(ids).size).toBe(ids.length);
}

function planItem(name: string): PlanItem {
  return { id: `plan-May-${name}`, month: MAY, name, amount: 100, remainingEstimate: 0 };
}

function outflow(name: string): Outflow {
  return {
    id: `outflow-May-${name}`,
    month: MAY,
    name,
    amount: 50,
    isPaid: false,
    isFinal: true,
    payerId: '',
    bankId: '',
  };
}

function income(source: string): IncomeEntry {
  return { id: `income-May-${source}`, month: MAY, amount: 100, source };
}

describe('copy id uniqueness', () => {
  it('gives every copied plan bucket its own id', () => {
    // Given last month's plan holds buckets, two of them sharing a name
    const source = [planItem('Luz'), planItem('Luz'), planItem('Gás')];

    // When I copy the plan into an empty month
    const copies = copyPlanItems(source, JUNE);

    // Then each copy is a distinct record
    expectUniqueIds(copies.map((item) => item.id));
  });

  it('gives every copied outflow its own id', () => {
    // Given last month's outflows include duplicate names and a whole list
    const source = [outflow('Luz'), outflow('Luz'), outflow('Internet'), outflow('Cartão')];

    // When I replicate the outflows
    const copies = copyOutflows(source, JUNE);

    // Then each copy is a distinct record
    expectUniqueIds(copies.map((item) => item.id));
  });

  it('gives every copied income entry its own id', () => {
    // Given last month's income includes two unlabeled entries
    const source = [
      income('Salário'),
      { ...income('unlabeled-1'), source: undefined },
      { ...income('unlabeled-2'), source: undefined },
    ];

    // When I replicate income
    const copies = copyIncomeEntries(source, JUNE);

    // Then each copy is a distinct record
    expectUniqueIds(copies.map((item) => item.id));
  });
});
