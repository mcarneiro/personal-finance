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
