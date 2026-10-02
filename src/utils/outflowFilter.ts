import type { Bank, Outflow, Payer } from '../types';
import { orderKeys } from './outflowSummary';

/**
 * The payer/bank selection narrowing the Outflows list — pure view state, held in
 * the screen and never stored in Redux or the sheet. An empty array on a facet
 * means "no restriction on it".
 */
export interface OutflowFilter {
  payerIds: string[];
  bankIds: string[];
}

/** No restriction on either facet; the list is unfiltered. */
export const EMPTY_OUTFLOW_FILTER: OutflowFilter = { payerIds: [], bankIds: [] };

/** How many checkboxes are active across both facets (drives the icon badge). */
export function outflowFilterCount(filter: OutflowFilter): number {
  return filter.payerIds.length + filter.bankIds.length;
}

/** True when neither facet restricts the list. */
export function isOutflowFilterEmpty(filter: OutflowFilter): boolean {
  return filter.payerIds.length === 0 && filter.bankIds.length === 0;
}

/**
 * Read a `OutflowFilter` back from storage. Only an object with two arrays of
 * string ids is accepted; anything else — a stale shape, a corrupt value or a
 * hand-edited entry — yields null so the caller can fall back to no filter
 * instead of crashing on a malformed selection.
 */
export function parseOutflowFilter(raw: unknown): OutflowFilter | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as { payerIds?: unknown; bankIds?: unknown };
  const ids = (value: unknown): string[] | null =>
    Array.isArray(value) && value.every((id) => typeof id === 'string') ? [...value] : null;
  const payerIds = ids(candidate.payerIds);
  const bankIds = ids(candidate.bankIds);
  if (payerIds === null || bankIds === null) return null;
  return { payerIds, bankIds };
}

/** The checkbox options the filter drawer offers for a month. */
export interface OutflowFilterOptions {
  payerIds: string[];
  bankIds: string[];
}

/**
 * The payers and banks worth offering as filter checkboxes for the browsed
 * month: only the references that actually appear on its outflows, so every
 * checkbox can change the list. Ordering mirrors the by-payer summary — registry
 * order first, then unset or since-removed references — and each id is listed
 * once.
 */
export function outflowFilterOptions(
  monthOutflows: Outflow[],
  banks: Bank[],
  payers: Payer[]
): OutflowFilterOptions {
  const present = (ids: string[]) => [...new Set(ids)];
  return {
    payerIds: orderKeys(
      payers.map((payer) => payer.id),
      present(monthOutflows.map((outflow) => outflow.payerId))
    ),
    bankIds: orderKeys(
      banks.map((bank) => bank.id),
      present(monthOutflows.map((outflow) => outflow.bankId))
    ),
  };
}

/**
 * The outflows narrowed by payer and/or bank. Within a facet the selected ids are
 * OR-ed and across facets they are AND-ed, so "Guta" + "Itaú, Nubank" reads
 * Guta's outflows paid from either bank. An empty facet does not restrict; an
 * empty filter returns the caller's array untouched, leaving ordering to the
 * caller.
 */
export function filterOutflows(outflows: Outflow[], filter: OutflowFilter): Outflow[] {
  if (isOutflowFilterEmpty(filter)) return outflows;
  return outflows.filter(
    (outflow) =>
      (filter.payerIds.length === 0 || filter.payerIds.includes(outflow.payerId)) &&
      (filter.bankIds.length === 0 || filter.bankIds.includes(outflow.bankId))
  );
}
