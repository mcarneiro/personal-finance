import type { Bill } from '../types';

/**
 * The order bills read in on the Bills screen: open obligations first, then
 * paid ones, each group alphabetical by name. Paying a bill therefore sinks it
 * to the bottom, keeping what is still owed at the top of the list.
 *
 * A copy is returned; the reducer's array is never reordered in place. Names
 * are compared with `localeCompare` so accented names sort as the household's
 * language expects.
 */
export function orderBills(bills: Bill[], locale?: string): Bill[] {
  return [...bills].sort((a, b) => {
    if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
    return a.name.localeCompare(b.name, locale);
  });
}
