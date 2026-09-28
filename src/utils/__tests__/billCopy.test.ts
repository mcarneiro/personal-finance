import { describe, expect, it } from 'vitest';
import type { Bill } from '../../types';
import { copyBills } from '../billCopy';

const MAY = '2026-05';
const JUNE = '2026-06';

function bill(overrides: Partial<Bill>): Bill {
  return {
    id: 'source',
    month: MAY,
    name: 'Luz',
    amount: 150,
    isPaid: false,
    payerId: 'payer-marcelo',
    bankId: 'bank-nubank',
    ...overrides,
  };
}

describe('copyBills', () => {
  it('copies names, amounts, payers and banks into the target month', () => {
    // Given last month's bills: one paid from a bank, one assigned to another payer
    const source = [
      bill({ id: 'a', name: 'Luz', amount: 150 }),
      bill({ id: 'b', name: 'Cartão guta', amount: 2899, payerId: 'payer-guta', bankId: 'bank-itau' }),
    ];

    // When I replicate them into the target month
    const copies = copyBills(source, JUNE);

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

  it('starts every copied bill unpaid, so last month payment never leaks', () => {
    // Given last month's bill was already paid
    const source = [bill({ id: 'a', isPaid: true })];

    // When I replicate it
    const copies = copyBills(source, JUNE);

    // Then the new month's obligation starts open
    expect(copies[0].isPaid).toBe(false);
  });

  it('gives every copy a fresh id so it cannot collide with its source', () => {
    // Given last month's bills carry their own ids
    const source = [bill({ id: 'a', name: 'Luz' }), bill({ id: 'b', name: 'Internet' })];

    // When I replicate them
    const copies = copyBills(source, JUNE);

    // Then every copy is keyed by a new, distinct id
    const ids = copies.map((copy) => copy.id);
    expect(ids).not.toContain('a');
    expect(ids).not.toContain('b');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('preserves unset payer and bank references on legacy rows', () => {
    // Given a legacy bill with no payer or bank recorded
    const source = [bill({ id: 'a', payerId: '', bankId: '' })];

    // When I replicate it
    const copies = copyBills(source, JUNE);

    // Then the copy keeps the blanks rather than inventing a registry entry
    expect(copies[0].payerId).toBe('');
    expect(copies[0].bankId).toBe('');
  });

  it('copies nothing when last month had no bills', () => {
    // Given last month had no bills
    // When I replicate it
    // Then the target month stays empty
    expect(copyBills([], JUNE)).toEqual([]);
  });
});
