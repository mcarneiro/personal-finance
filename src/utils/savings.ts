import type { Month, SavingsBalance, SavingsPot } from '../types';

/**
 * A pot's carried balance for a month, together with the month it was actually
 * recorded in. `sourceMonth === month` means the browsed month had its own
 * record; otherwise the value was carried forward from the most recent earlier
 * recorded month (ADR-0011, "updated in an earlier month").
 */
export interface CarriedBalance {
  balance: number;
  sourceMonth: Month;
}

/**
 * The Savings Balance for one pot in one month (ADR-0011), as a pure function
 * over the recorded rows:
 *
 * - the month's own recorded balance wins, reporting that month as its source;
 * - otherwise the most recent earlier month's recorded balance is carried
 *   forward, reporting that earlier month as its source;
 * - otherwise `undefined` — "not checked yet", never an invented zero.
 *
 * Carry-forward only ever looks backwards: a month earlier than every recorded
 * row has no balance, and a balance is never derived from contributions. An
 * explicit `0` is a real recorded value, not a missing one.
 */
export function potBalance(
  month: Month,
  potId: string,
  balances: SavingsBalance[]
): CarriedBalance | undefined {
  let latestEarlier: SavingsBalance | undefined;
  for (const row of balances) {
    if (row.potId !== potId) continue;
    if (row.month === month) {
      return { balance: row.balance, sourceMonth: row.month };
    }
    if (row.month < month && (latestEarlier === undefined || row.month > latestEarlier.month)) {
      latestEarlier = row;
    }
  }
  return latestEarlier
    ? { balance: latestEarlier.balance, sourceMonth: latestEarlier.month }
    : undefined;
}

/**
 * Total Saved for a month: the sum of the active pots' carried balances
 * (ADR-0011). Pots with no recorded balance up to and including the month
 * contribute nothing, and the sum of no pots is `0`. Only pots in the active
 * registry are counted, so a retired pot's leftover balance rows are ignored.
 */
export function totalSaved(
  month: Month,
  pots: SavingsPot[],
  balances: SavingsBalance[]
): number {
  return pots.reduce(
    (total, pot) => total + (potBalance(month, pot.id, balances)?.balance ?? 0),
    0
  );
}
