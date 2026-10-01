import type { SheetKey } from '../config/google';

/**
 * A month identifier in `YYYY-MM` format (e.g. `2026-06`).
 * Month strings are the app's canonical month scope across routes and data.
 */
export type Month = string;

/** A registered credit card. Cards are the input mechanism for Card Spending. */
export interface Card {
  id: string;
  name: string;
}

/** A registered bank a Bill can be paid from. */
export interface Bank {
  id: string;
  name: string;
}

/** A registered household member who pays a Bill. */
export interface Payer {
  id: string;
  name: string;
}

/** A single spending bucket in a month's Spending Plan. */
export interface PlanItem {
  id: string;
  month: Month;
  /** Spending bucket name. */
  name: string;
  /** The bucket cap. */
  amount: number;
  /** What is still expected to be spent in the bucket until month end; default 0. */
  remainingEstimate: number;
}

/** The current total charged to one card so far in a month, overwritten at check-in. */
export interface CardSpending {
  id: string;
  month: Month;
  cardId: string;
  total: number;
}

/** A payment obligation tracked for a particular month. */
export interface Bill {
  id: string;
  month: Month;
  name: string;
  amount: number;
  isPaid: boolean;
  /**
   * Whether the amount has been confirmed for this month. A bill starts (and
   * replicated copies always arrive) not final, so variable amounts are visibly
   * flagged until reviewed; the amount itself is still fully editable.
   */
  isFinal: boolean;
  /**
   * The registered payer and bank, referenced by id so renaming a registry
   * entry flows through. `''` means unset — legacy rows written before these
   * fields existed, or a registry entry that was later removed.
   */
  payerId: string;
  bankId: string;
}

/** An amount of money expected to arrive during a month. */
export interface IncomeEntry {
  id: string;
  month: Month;
  amount: number;
  source?: string;
}

/**
 * The record-level edit a Pending Change represents. `create` and `update`
 * carry the record's new value; `delete` carries only its id.
 */
export type PendingChangeType = 'create' | 'update' | 'delete';

/**
 * A member's edit to one record that has not yet been written to the sheet
 * (CONTEXT.md, "Pending Change"). It carries the id it is keyed by, so a
 * record has at most one Pending Change at a time — the latest local intent.
 * `create` and `update` carry the new record; `delete` carries nothing else.
 */
export type PendingChange<T extends { id: string }> =
  | { type: 'create'; id: string; record: T }
  | { type: 'update'; id: string; record: T }
  | { type: 'delete'; id: string };

/** One tab's Pending Changes, keyed by record id. */
export type TabPendingChanges<T extends { id: string }> = Record<string, PendingChange<T>>;

/** The record type each sheet tab holds. */
export interface SheetRecords {
  cards: Card;
  banks: Bank;
  payers: Payer;
  plan: PlanItem;
  card_spending: CardSpending;
  bills: Bill;
  income: IncomeEntry;
}

/** The record type a given sheet tab holds. */
export type SheetRecord<K extends SheetKey> = SheetRecords[K];

/** A device's Pending Changes for every tab, grouped by tab. */
export type PendingChanges = { [K in SheetKey]?: TabPendingChanges<SheetRecord<K>> };
