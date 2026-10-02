import type { SheetData } from '../types';
import type { RootState } from './index';

/**
 * The store's slices as one `SheetData` snapshot — the data half of the
 * Working Copy. Used to persist the cached snapshot after a successful pull or
 * push (ADR-0007). The field names match the tab keys, mirroring
 * `mergeSheetData`.
 *
 * A slice that is unexpectedly absent reads as empty rather than throwing: the
 * snapshot is a best-effort cache and must never fail an otherwise successful
 * sync. The savings slice arrives with its own ticket; until then both savings
 * tabs read as empty here even though the contract already carries them.
 */
export function selectSheetData(state: RootState): SheetData {
  return {
    cards: state.cards?.items ?? [],
    banks: state.banks?.items ?? [],
    payers: state.payers?.items ?? [],
    planItems: state.plan?.items ?? [],
    cardSpending: state.plan?.cardSpending ?? [],
    outflows: state.outflows?.items ?? [],
    income: state.income?.items ?? [],
    savingsPots: [],
    savingsBalances: [],
  };
}
