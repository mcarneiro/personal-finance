import type { Outflow } from '../types';

/**
 * The order outflows read in on the Outflows screen: open outflows first, then
 * paid ones. While open, a final value leads one still awaiting review; the paid
 * group is a single bottom tier sorted alphabetically, since final status no
 * longer matters once the obligation is settled. Each group is alphabetical by
 * name.
 *
 * A copy is returned; the reducer's array is never reordered in place. Names
 * are compared with `localeCompare` so accented names sort as the household's
 * language expects.
 */
export function orderOutflows(outflows: Outflow[], locale?: string): Outflow[] {
  return [...outflows].sort((a, b) => {
    if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
    if (!a.isPaid && a.isFinal !== b.isFinal) return a.isFinal ? -1 : 1;
    return a.name.localeCompare(b.name, locale);
  });
}
