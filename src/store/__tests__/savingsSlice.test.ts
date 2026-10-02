import { describe, expect, it } from 'vitest';
import type { SavingsBalance, SavingsPot } from '../../types';
import reducer, {
  addSavingsPot,
  deleteSavingsBalance,
  deleteSavingsPot,
  setSavingsBalances,
  setSavingsPots,
  upsertSavingsBalance,
  updateSavingsPot,
  type SavingsState,
} from '../savingsSlice';

const EMERGENCY: SavingsPot = { id: 'pot-1', name: 'Emergência' };
const RETIREMENT: SavingsPot = { id: 'pot-2', name: 'Aposentadoria' };

function balance(id: string, month: string, potId: string, value: number): SavingsBalance {
  return { id, month, potId, balance: value };
}

describe('savingsSlice pot registry', () => {
  it('replaces the registry on setSavingsPots', () => {
    // Given a registry loaded from the sheet
    const state: SavingsState = { items: [], balances: [] };

    // When the snapshot is applied
    const next = reducer(state, setSavingsPots([EMERGENCY, RETIREMENT]));

    // Then the pots replace the previous registry
    expect(next.items).toEqual([EMERGENCY, RETIREMENT]);
  });

  it('adds, updates and removes a pot', () => {
    // Given an empty registry
    let state = reducer({ items: [], balances: [] } as SavingsState, addSavingsPot(EMERGENCY));
    expect(state.items).toEqual([EMERGENCY]);

    // When the pot is renamed
    state = reducer(state, updateSavingsPot({ id: 'pot-1', name: 'Reserva' }));
    // Then the rename flows through the same id
    expect(state.items).toEqual([{ id: 'pot-1', name: 'Reserva' }]);

    // When the pot is retired
    state = reducer(state, deleteSavingsPot('pot-1'));
    // Then it is gone from the registry
    expect(state.items).toEqual([]);
  });

  it('leaves the recorded balances untouched when a pot is removed', () => {
    // Given a pot with recorded balance history
    const state: SavingsState = {
      items: [EMERGENCY],
      balances: [
        balance('2026-05-pot-1', '2026-05', 'pot-1', 10000),
        balance('2026-06-pot-1', '2026-06', 'pot-1', 11000),
      ],
    };

    // When the pot is retired
    const next = reducer(state, deleteSavingsPot('pot-1'));

    // Then the registry drops it but its balance rows are kept for the sheet
    expect(next.items).toEqual([]);
    expect(next.balances).toEqual(state.balances);
  });
});

describe('savingsSlice balances', () => {
  it('replaces the balances on setSavingsBalances', () => {
    // Given an empty slice
    // When a fresh pull is applied
    const rows = [balance('2026-06-pot-1', '2026-06', 'pot-1', 11000)];
    const next = reducer({ items: [], balances: [] } as SavingsState, setSavingsBalances(rows));

    // Then the rows replace the previous balances
    expect(next.balances).toEqual(rows);
  });

  it('creates one row per pot per month on the first commit', () => {
    // Given no recorded balance yet
    // When June's balance is committed
    const next = reducer(
      { items: [EMERGENCY], balances: [] } as SavingsState,
      upsertSavingsBalance({ month: '2026-06', potId: 'pot-1', balance: 11000 })
    );

    // Then a single row is added for that pot and month
    expect(next.balances).toEqual([
      { id: '2026-06-pot-1', month: '2026-06', potId: 'pot-1', balance: 11000 },
    ]);
  });

  it('overwrites the same month’s row instead of adding a duplicate', () => {
    // Given June's balance was already checked in
    const state: SavingsState = {
      items: [EMERGENCY],
      balances: [balance('2026-06-pot-1', '2026-06', 'pot-1', 11000)],
    };

    // When the household corrects it
    const next = reducer(state, upsertSavingsBalance({ month: '2026-06', potId: 'pot-1', balance: 11500 }));

    // Then the row is updated in place, keeping history to one row per month
    expect(next.balances).toHaveLength(1);
    expect(next.balances[0]).toEqual({
      id: '2026-06-pot-1',
      month: '2026-06',
      potId: 'pot-1',
      balance: 11500,
    });
  });

  it('keeps separate rows for the same pot across months', () => {
    // Given a May balance
    const state: SavingsState = {
      items: [EMERGENCY],
      balances: [balance('2026-05-pot-1', '2026-05', 'pot-1', 10000)],
    };

    // When June is checked in
    const next = reducer(state, upsertSavingsBalance({ month: '2026-06', potId: 'pot-1', balance: 11000 }));

    // Then both months are kept as history
    expect(next.balances.map((row) => row.month)).toEqual(['2026-05', '2026-06']);
  });

  it('stores an explicit zero as a recorded row', () => {
    // Given no June record
    // When the household records zero
    const next = reducer(
      { items: [EMERGENCY], balances: [] } as SavingsState,
      upsertSavingsBalance({ month: '2026-06', potId: 'pot-1', balance: 0 })
    );

    // Then the zero is a real row, distinguishable from "not checked"
    expect(next.balances).toEqual([
      { id: '2026-06-pot-1', month: '2026-06', potId: 'pot-1', balance: 0 },
    ]);
  });

  it('deletes only the named row when a balance is cleared', () => {
    // Given a pot recorded in May and June
    const state: SavingsState = {
      items: [EMERGENCY],
      balances: [
        balance('2026-05-pot-1', '2026-05', 'pot-1', 10000),
        balance('2026-06-pot-1', '2026-06', 'pot-1', 11000),
      ],
    };

    // When June's field is cleared
    const next = reducer(state, deleteSavingsBalance('2026-06-pot-1'));

    // Then only June's row goes, so May's value can be carried forward
    expect(next.balances).toEqual([balance('2026-05-pot-1', '2026-05', 'pot-1', 10000)]);
  });
});
