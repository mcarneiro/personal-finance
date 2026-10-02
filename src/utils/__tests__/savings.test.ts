import { describe, expect, it } from 'vitest';
import type { Month, SavingsBalance, SavingsPot } from '../../types';
import { potBalance, totalSaved } from '../savings';

const MONTH: Month = '2026-06';
const MAY: Month = '2026-05';
const APRIL: Month = '2026-04';
const METHOD: Month = '2026-07';

/** Build an active pot in the registry. */
function pot(id: string, name: string): SavingsPot {
  return { id, name };
}

/** Build a recorded balance row for one pot in one month. */
function balance(month: Month, potId: string, value: number): SavingsBalance {
  return { id: `${month}-${potId}`, month, potId, balance: value };
}

describe('potBalance', () => {
  // Given recorded balances for a pot
  // When asking for a month's carried balance
  // Then the month's own record wins, else the nearest earlier one, else nothing
  it('returns the exact month record and reports that month as the source', () => {
    // Given the pot was recorded in May and June
    const balances = [balance(MAY, 'pot-1', 10000), balance(MONTH, 'pot-1', 11000)];

    // When asking for June
    const result = potBalance(MONTH, 'pot-1', balances);

    // Then the June row is used, not the carried May one
    expect(result).toEqual({ balance: 11000, sourceMonth: MONTH });
  });

  it('carries the last earlier balance forward when the month is missing', () => {
    // Given the pot was last recorded in May
    const balances = [balance(MAY, 'pot-1', 10000)];

    // When asking for June, which was never recorded
    const result = potBalance(MONTH, 'pot-1', balances);

    // Then May's value is carried, saying it came from May
    expect(result).toEqual({ balance: 10000, sourceMonth: MAY });
  });

  it('carries the nearest earlier balance across a gap of several months', () => {
    // Given the pot was recorded in April and May but skipped June
    const balances = [
      balance(APRIL, 'pot-1', 9000),
      balance(MAY, 'pot-1', 10000),
      balance(METHOD, 'pot-1', 12000),
    ];

    // When asking for June
    const result = potBalance(MONTH, 'pot-1', balances);

    // Then the nearest earlier (May), not the older April nor the later July
    expect(result).toEqual({ balance: 10000, sourceMonth: MAY });
  });

  it('never invents a balance for a month before every record', () => {
    // Given the earliest record is June
    const balances = [balance(MONTH, 'pot-1', 11000)];

    // When asking for May, which precedes it
    const result = potBalance(MAY, 'pot-1', balances);

    // Then carry-forward does not look forwards
    expect(result).toBeUndefined();
  });

  it('returns undefined for a pot recorded in no month up to this one', () => {
    // Given no records for the pot at all
    const balances: SavingsBalance[] = [];

    // When asking for June
    // Then there is nothing to carry
    expect(potBalance(MONTH, 'pot-1', balances)).toBeUndefined();
  });

  it('ignores another pot’s records', () => {
    // Given only a different pot has a record
    const balances = [balance(MAY, 'pot-2', 5000)];

    // When asking for pot-1
    // Then it has no balance
    expect(potBalance(MONTH, 'pot-1', balances)).toBeUndefined();
  });

  it('respects a recorded zero as a real balance', () => {
    // Given a pot explicitly recorded as zero in June
    const balances = [balance(MAY, 'pot-1', 10000), balance(MONTH, 'pot-1', 0)];

    // When asking for June
    const result = potBalance(MONTH, 'pot-1', balances);

    // Then zero is returned, distinct from "no record"
    expect(result).toEqual({ balance: 0, sourceMonth: MONTH });
  });

  it('carries a recorded zero forward as a real value', () => {
    // Given the pot was explicitly set to zero in May and not touched since
    const balances = [balance(MAY, 'pot-1', 0)];

    // When asking for June
    const result = potBalance(MONTH, 'pot-1', balances);

    // Then the carried value is a real zero, still sourced from May
    expect(result).toEqual({ balance: 0, sourceMonth: MAY });
  });
});

describe('totalSaved', () => {
  // Given active pots and recorded balances
  // When computing Total Saved for a month
  // Then it is the sum of each active pot's carried balance
  it('is zero for no pots', () => {
    // Given an empty registry
    // When computing Total Saved
    // Then the sum of none is zero
    expect(totalSaved(MONTH, [], [])).toBe(0);
  });

  it('sums several pots, carrying the missing months forward', () => {
    // Given three pots: one recorded in June, one only in May, one never
    const pots = [pot('pot-1', 'Emergência'), pot('pot-2', 'Aposentadoria'), pot('pot-3', 'Viagem')];
    const balances = [
      balance(MONTH, 'pot-1', 11000),
      balance(MAY, 'pot-2', 40000),
    ];

    // When computing Total Saved for June
    // Then June's 11000 plus May's carried 40000, and the unrecorded pot adds nothing
    expect(totalSaved(MONTH, pots, balances)).toBe(51000);
  });

  it('ignores a removed pot’s stale balance rows even when a pot of the same name is re-added', () => {
    // Given a re-added 'Emergência' (new id pot-1) while the earlier pot of the
    // same name was removed, leaving its rows under the old id
    const pots = [pot('pot-1', 'Emergência')];
    const balances = [
      balance(MONTH, 'pot-1', 11000),
      balance(MONTH, 'pot-retired', 50000),
    ];

    // When computing Total Saved
    // Then only the active pot's id counts — the shared name does not reconnect
    // the retired pot's rows
    expect(totalSaved(MONTH, pots, balances)).toBe(11000);
  });

  it('counts a pot recorded only in an earlier month at its carried value', () => {
    // Given one pot last recorded in May
    const pots = [pot('pot-1', 'Emergência')];
    const balances = [balance(MAY, 'pot-1', 9000)];

    // When computing Total Saved for June
    // Then May's value is carried into the total
    expect(totalSaved(MONTH, pots, balances)).toBe(9000);
  });

  it('counts an explicit zero as zero, not as missing', () => {
    // Given a pot recorded as zero
    const pots = [pot('pot-1', 'Emergência')];
    const balances = [balance(MONTH, 'pot-1', 0)];

    // When computing Total Saved
    // Then the real zero contributes nothing but is not treated as absent
    expect(totalSaved(MONTH, pots, balances)).toBe(0);
  });
});
