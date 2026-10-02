import { describe, expect, it } from 'vitest';
import type { Outflow } from '../../types';
import { copyOutflows } from '../outflowCopy';

const MAY = '2026-05';
const JUNE = '2026-06';

function outflow(overrides: Partial<Outflow>): Outflow {
  return {
    id: 'source',
    month: MAY,
    name: 'Luz',
    amount: 150,
    isPaid: false,
    isFinal: true,
    payerId: 'payer-marcelo',
    bankId: 'bank-nubank',
    ...overrides,
  };
}

describe('copyOutflows', () => {
  it('copies names, amounts, payers and banks into the target month', () => {
    // Given last month's outflows: one paid from a bank, one assigned to another payer
    const source = [
      outflow({ id: 'a', name: 'Luz', amount: 150 }),
      outflow({ id: 'b', name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
    ];

    // When I replicate them into the target month
    const copies = copyOutflows(source, JUNE);

    // Then both carry over their amount, payer and bank
    expect(copies).toEqual([
      expect.objectContaining({
        month: JUNE,
        name: 'Luz',
        amount: 150,
        payerId: 'payer-marcelo',
        bankId: 'bank-nubank',
      }),
      expect.objectContaining({
        month: JUNE,
        name: 'Cartão guta',
        amount: 2899,
        payerId: 'payer-guta',
        bankId: 'bank-itau',
      }),
    ]);
  });

  it('starts every copied outflow unpaid, so last month payment never leaks', () => {
    // Given last month's outflow was already paid
    const source = [outflow({ id: 'a', isPaid: true })];

    // When I replicate it
    const copies = copyOutflows(source, JUNE);

    // Then the new month's obligation starts open
    expect(copies[0].isPaid).toBe(false);
  });

  it("starts every copied outflow not final, so last month's confirmed value never leaks", () => {
    // Given last month's outflow had its value confirmed as final
    const source = [outflow({ id: 'a', isFinal: true })];

    // When I replicate it
    const copies = copyOutflows(source, JUNE);

    // Then the new month's copy is flagged as still awaiting review
    expect(copies[0].isFinal).toBe(false);
  });

  it('gives every copy a fresh id so it cannot collide with its source', () => {
    // Given last month's outflows carry their own ids
    const source = [outflow({ id: 'a', name: 'Luz' }), outflow({ id: 'b', name: 'Internet' })];

    // When I replicate them
    const copies = copyOutflows(source, JUNE);

    // Then every copy is keyed by a new, distinct id
    const ids = copies.map((copy) => copy.id);
    expect(ids).not.toContain('a');
    expect(ids).not.toContain('b');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('preserves unset payer and bank references on legacy rows', () => {
    // Given a legacy outflow with no payer or bank recorded
    const source = [outflow({ id: 'a', payerId: '', bankId: '' })];

    // When I replicate it
    const copies = copyOutflows(source, JUNE);

    // Then the copy keeps the blanks rather than inventing a registry entry
    expect(copies[0].payerId).toBe('');
    expect(copies[0].bankId).toBe('');
  });

  it('copies nothing when last month had no outflows', () => {
    // Given last month had no outflows
    // When I replicate it
    // Then the target month stays empty
    expect(copyOutflows([], JUNE)).toEqual([]);
  });
});
