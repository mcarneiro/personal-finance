import type { Bank, Outflow, Card, CardSpending, IncomeEntry, Month, Payer, PlanItem } from '../types';

/**
 * A realistic demo dataset for the real-data verification run (ticket 09) and
 * for exercising the app end-to-end. June 2026 is the real trace from the
 * historical sheet (prd.md "Worked example"): plan 10.750, check-in 25/06
 * (2.899 + 9.432 + 473 = 12.804), remaining estimate 250. July, August and
 * September are simulated months added on top of the real plan so every screen
 * and the control loop can be exercised; their sobras are the acceptance
 * targets checked by `demoData.test.ts`.
 *
 * This module holds no React or store imports on purpose: the Vitest suite and
 * the dev-time seeding step both read the same fixture (single source of truth).
 */

export const DEMO_CARDS: Card[] = [
  { id: 'card-guta', name: 'cc guta' },
  { id: 'card-uv', name: 'cc uv' },
  { id: 'card-ml', name: 'cc ml' },
];

/** The household's banks, as maintained in Settings. */
export const DEMO_BANKS: Bank[] = [
  { id: 'bank-itau', name: 'Itaú' },
  { id: 'bank-nubank', name: 'Nubank' },
  { id: 'bank-mercado-livre', name: 'Mercado Livre' },
  { id: 'bank-inter', name: 'Inter' },
];

/** The household's payers, as maintained in Settings. */
export const DEMO_PAYERS: Payer[] = [
  { id: 'payer-marcelo', name: 'Marcelo' },
  { id: 'payer-guta', name: 'Guta' },
];

/** Build a month-scoped plan item; ids stay deterministic for seeding. */
function planItem(
  month: Month,
  name: string,
  amount: number,
  remainingEstimate = 0
): PlanItem {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return { id: `plan-${month}-${slug}`, month, name, amount, remainingEstimate };
}

/** Build a card check-in row, keyed the same way the plan slice keys them. */
function cardTotal(month: Month, cardId: string, total: number): CardSpending {
  return { id: `${month}-${cardId}`, month, cardId, total };
}

/** Build a outflow pinned to a month, assigned to a payer and paid from a bank. */
function outflow(
  month: Month,
  name: string,
  amount: number,
  payerId: string,
  bankId: string,
  isPaid = false,
  isFinal = true
): Outflow {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return { id: `outflow-${month}-${slug}`, month, name, amount, isPaid, isFinal, payerId, bankId };
}

/** Build an income entry pinned to a month. */
function income(month: Month, amount: number, source?: string): IncomeEntry {
  const slug = (source ?? String(amount))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-');
  return { id: `income-${month}-${slug}`, month, amount, source };
}

/**
 * The June 2026 plan exactly as recorded in the historical sheet: the four
 * buckets (6.000 + 800 + 1.200 + 1.000) plus the subscriptions the sheet kept
 * alongside them (110 + 90 + 200 + 1.350) now all read as spending buckets, so
 * the plan still totals 10.750.
 */
function junePlan(month: Month, restauranteRemaining: number): PlanItem[] {
  return [
    planItem(month, 'Mercado/Farmácia', 6000),
    planItem(month, 'Transporte', 800),
    planItem(month, 'Restaurante', 1200, restauranteRemaining),
    planItem(month, 'Compras', 1000),
    planItem(month, 'Internet', 110),
    planItem(month, 'Streaming', 90),
    planItem(month, 'Gym', 200),
    planItem(month, 'Seguro do carro', 1350),
  ];
}

/** Every number the acceptance run compares against the sheet. */
export interface DemoExpected {
  planTotal: number;
  totalSpent: number;
  projectedResult: number;
  planResult: number;
  outflowsTotal: number;
  incomeTotal: number;
  accountNet: number;
}

export interface DemoMonth {
  month: Month;
  planItems: PlanItem[];
  cardSpending: CardSpending[];
  outflows: Outflow[];
  income: IncomeEntry[];
  /** The sheet's recorded sobra values — hardcoded targets, never derived. */
  expected: DemoExpected;
}

/**
 * The 25/06 check-in moment as it was recorded live: card totals 12.804 and a
 * Restaurante estimate of 250, so Projected Result is −2.304. V1 overwrites the
 * remaining estimate at month end, so this mid-month state is preserved only as
 * a fixture — the June month row below is the settled (closed) state.
 */
export const JUNE_CHECKIN: DemoMonth = {
  month: '2026-06',
  planItems: junePlan('2026-06', 250),
  cardSpending: [
    cardTotal('2026-06', 'card-guta', 2899),
    cardTotal('2026-06', 'card-uv', 9432),
    cardTotal('2026-06', 'card-ml', 473),
  ],
  outflows: [],
  income: [],
  expected: {
    planTotal: 10750,
    totalSpent: 12804,
    projectedResult: -2304,
    planResult: -2054,
    outflowsTotal: 0,
    incomeTotal: 0,
    accountNet: 0,
  },
};

/** June close: same real plan and card totals, remaining estimate zeroed. */
const JUNE: DemoMonth = {
  month: '2026-06',
  planItems: junePlan('2026-06', 0),
  cardSpending: [
    cardTotal('2026-06', 'card-guta', 2899),
    cardTotal('2026-06', 'card-uv', 9432),
    cardTotal('2026-06', 'card-ml', 473),
  ],
  outflows: [
    outflow('2026-06', 'Cartão guta', 2899, 'payer-guta', 'bank-itau', true),
    outflow('2026-06', 'Luz', 180, 'payer-marcelo', 'bank-nubank', true),
    outflow('2026-06', 'Internet', 110, 'payer-marcelo', 'bank-nubank', true),
  ],
  income: [income('2026-06', 12000, 'Salário')],
  expected: {
    planTotal: 10750,
    totalSpent: 12804,
    projectedResult: -2054,
    planResult: -2054,
    outflowsTotal: 3189,
    incomeTotal: 12000,
    accountNet: 8811,
  },
};

const JULY: DemoMonth = {
  month: '2026-07',
  planItems: junePlan('2026-07', 0),
  cardSpending: [
    cardTotal('2026-07', 'card-guta', 3100),
    cardTotal('2026-07', 'card-uv', 8600),
    cardTotal('2026-07', 'card-ml', 620),
  ],
  outflows: [
    outflow('2026-07', 'Cartão guta', 3100, 'payer-guta', 'bank-itau', true),
    outflow('2026-07', 'Luz', 190, 'payer-marcelo', 'bank-nubank', false, false),
    outflow('2026-07', 'Internet', 110, 'payer-marcelo', 'bank-nubank', true),
    outflow('2026-07', 'Gym', 200, 'payer-guta', 'bank-inter'),
  ],
  income: [income('2026-07', 12000, 'Salário'), income('2026-07', 800, 'Freela')],
  expected: {
    planTotal: 10750,
    totalSpent: 12320,
    projectedResult: -1570,
    planResult: -1570,
    outflowsTotal: 3600,
    incomeTotal: 12800,
    accountNet: 9200,
  },
};

/** August closes over plan at −287 — the ticket's recorded sobra target. */
const AUGUST: DemoMonth = {
  month: '2026-08',
  planItems: junePlan('2026-08', 0),
  cardSpending: [
    cardTotal('2026-08', 'card-guta', 3200),
    cardTotal('2026-08', 'card-uv', 7300),
    cardTotal('2026-08', 'card-ml', 537),
  ],
  outflows: [
    outflow('2026-08', 'Cartão guta', 3200, 'payer-guta', 'bank-itau', true),
    outflow('2026-08', 'Luz', 175, 'payer-marcelo', 'bank-nubank', true),
    outflow('2026-08', 'Internet', 110, 'payer-marcelo', 'bank-nubank', true),
  ],
  income: [income('2026-08', 12000, 'Salário')],
  expected: {
    planTotal: 10750,
    totalSpent: 11037,
    projectedResult: -287,
    planResult: -287,
    outflowsTotal: 3485,
    incomeTotal: 12000,
    accountNet: 8515,
  },
};

/**
 * September is the current month, so it is mid-flight: partial card totals and
 * live remaining estimates, headlined by the Projected Result (+4.750, green).
 */
const SEPTEMBER: DemoMonth = {
  month: '2026-09',
  planItems: junePlan('2026-09', 0).map((item) =>
    item.name === 'Mercado/Farmácia'
      ? { ...item, remainingEstimate: 2000 }
      : item.name === 'Restaurante'
        ? { ...item, remainingEstimate: 300 }
        : item
  ),
  cardSpending: [
    cardTotal('2026-09', 'card-guta', 1500),
    cardTotal('2026-09', 'card-uv', 2200),
    cardTotal('2026-09', 'card-ml', 0),
  ],
  outflows: [
    // The card bill and Internet await this month's real values, so they show
    // the not-final warning and sink below the confirmed Luz.
    outflow('2026-09', 'Cartão guta', 3200, 'payer-guta', 'bank-itau', false, false),
    outflow('2026-09', 'Luz', 185, 'payer-marcelo', 'bank-nubank', true),
    outflow('2026-09', 'Internet', 110, 'payer-marcelo', 'bank-nubank', false, false),
  ],
  income: [income('2026-09', 12000, 'Salário')],
  expected: {
    planTotal: 10750,
    totalSpent: 3700,
    projectedResult: 4750,
    planResult: 7050,
    outflowsTotal: 3495,
    incomeTotal: 12000,
    accountNet: 8505,
  },
};

export const DEMO_MONTHS: DemoMonth[] = [JUNE, JULY, AUGUST, SEPTEMBER];

/** Flattened rows for the sheet's `plan` tab. */
export const DEMO_PLAN_ITEMS: PlanItem[] = DEMO_MONTHS.flatMap((entry) => entry.planItems);

/** Flattened rows for the sheet's `card_spending` tab. */
export const DEMO_CARD_SPENDING: CardSpending[] = DEMO_MONTHS.flatMap(
  (entry) => entry.cardSpending
);

/** Flattened rows for the sheet's `outflows` tab. */
export const DEMO_OUTFLOWS: Outflow[] = DEMO_MONTHS.flatMap((entry) => entry.outflows);

/** Flattened rows for the sheet's `income` tab. */
export const DEMO_INCOME: IncomeEntry[] = DEMO_MONTHS.flatMap((entry) => entry.income);
