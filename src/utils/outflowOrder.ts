import type { Outflow } from '../types';

/**
 * The order outflows read in on the Outflows screen: outflows with a final value first,
 * then the ones still awaiting review, each group open before paid and
 * alphabetical by name. A replicated month therefore gathers every variable
 * outflow that still needs updating at the bottom, out of the way of the confirmed
 * obligations; paying a outflow sinks it within its group.
 *
 * A copy is returned; the reducer's array is never reordered in place. Names
 * are compared with `localeCompare` so accented names sort as the household's
 * language expects.
 */
export function orderOutflows(outflows: Outflow[], locale?: string): Outflow[] {
  return [...outflows].sort((a, b) => {
    if (a.isFinal !== b.isFinal) return a.isFinal ? -1 : 1;
    if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
    return a.name.localeCompare(b.name, locale);
  });
}
