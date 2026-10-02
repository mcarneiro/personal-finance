import type { Bank, Bill, Payer } from '../types';
import { orderKeys } from './billSummary';

/**
 * The payer/bank selection narrowing the Bills list — pure view state, held in
 * the screen and never stored in Redux or the sheet. An empty array on a facet
 * means "no restriction on it".
 */
export interface BillFilter {
  payerIds: string[];
  bankIds: string[];
}

/** No restriction on either facet; the list is unfiltered. */
export const EMPTY_BILL_FILTER: BillFilter = { payerIds: [], bankIds: [] };

/** How many checkboxes are active across both facets (drives the icon badge). */
export function billFilterCount(filter: BillFilter): number {
  return filter.payerIds.length + filter.bankIds.length;
}

/** True when neither facet restricts the list. */
export function isBillFilterEmpty(filter: BillFilter): boolean {
  return filter.payerIds.length === 0 && filter.bankIds.length === 0;
}

/**
 * Read a `BillFilter` back from storage. Only an object with two arrays of
 * string ids is accepted; anything else — a stale shape, a corrupt value or a
 * hand-edited entry — yields null so the caller can fall back to no filter
 * instead of crashing on a malformed selection.
 */
export function parseBillFilter(raw: unknown): BillFilter | null {
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
export interface BillFilterOptions {
  payerIds: string[];
  bankIds: string[];
}

/**
 * The payers and banks worth offering as filter checkboxes for the browsed
 * month: only the references that actually appear on its bills, so every
 * checkbox can change the list. Ordering mirrors the by-payer summary — registry
 * order first, then unset or since-removed references — and each id is listed
 * once.
 */
export function billFilterOptions(
  monthBills: Bill[],
  banks: Bank[],
  payers: Payer[]
): BillFilterOptions {
  const present = (ids: string[]) => [...new Set(ids)];
  return {
    payerIds: orderKeys(
      payers.map((payer) => payer.id),
      present(monthBills.map((bill) => bill.payerId))
    ),
    bankIds: orderKeys(
      banks.map((bank) => bank.id),
      present(monthBills.map((bill) => bill.bankId))
    ),
  };
}

/**
 * The bills narrowed by payer and/or bank. Within a facet the selected ids are
 * OR-ed and across facets they are AND-ed, so "Guta" + "Itaú, Nubank" reads
 * Guta's bills paid from either bank. An empty facet does not restrict; an
 * empty filter returns the caller's array untouched, leaving ordering to the
 * caller.
 */
export function filterBills(bills: Bill[], filter: BillFilter): Bill[] {
  if (isBillFilterEmpty(filter)) return bills;
  return bills.filter(
    (bill) =>
      (filter.payerIds.length === 0 || filter.payerIds.includes(bill.payerId)) &&
      (filter.bankIds.length === 0 || filter.bankIds.includes(bill.bankId))
  );
}
