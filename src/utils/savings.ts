import type { Month, SavingsBalance, SavingsPot } from '../types';
import { shiftMonth } from './month';

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

/**
 * One month's change in Total Saved from the month before it, as the pair the
 * Savings screen shows under the headline: the signed absolute difference and
 * the change as a percentage of the previous month's Total Saved.
 */
export interface SavingsDelta {
  /** The signed change, current month minus previous month (so growth is positive). */
  absolute: number;
  /**
   * The change as a percentage of the previous month's Total Saved, or `null`
   * when that base is zero: a percentage against nothing has no meaning, so the
   * screen shows the absolute change alone (growing from an empty month).
   */
  percent: number | null;
}

/**
 * The month-over-month change in Total Saved (ADR-0011): both sides are derived
 * from `totalSaved`, so the comparison can never drift from the headline, and
 * both use the current active registry — a retired pot is excluded from the
 * previous month too, exactly as it is from every month's headline. The previous
 * month is the calendar month before the browsed one, and carry-forward means an
 * unchanged month reads as a zero delta rather than a missing one.
 */
export function savingsDelta(
  month: Month,
  pots: SavingsPot[],
  balances: SavingsBalance[]
): SavingsDelta {
  const current = totalSaved(month, pots, balances);
  const previous = totalSaved(shiftMonth(month, -1), pots, balances);
  const absolute = current - previous;
  return {
    absolute,
    percent: previous === 0 ? null : (absolute / previous) * 100,
  };
}
