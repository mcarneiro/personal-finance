import { describe, expect, it } from 'vitest';
import type { Bill, CardSpending, IncomeEntry, Month, PlanItem } from '../../types';
import {
  accountNet,
  billsTotal,
  incomeTotal,
  planResult,
  planTotal,
  projectedResult,
  totalSpent,
} from '../controlLoop';

const MONTH: Month = '2026-06';
const OTHER_MONTH: Month = '2026-05';

/** Build a spending bucket pinned to a month, with the remaining estimate defaulting to zero. */
function planItem(
  month: Month,
  name: string,
  amount: number,
  remainingEstimate = 0
): PlanItem {
  return { id: `${month}-${name}`, month, name, amount, remainingEstimate };
}

/** Build a card-spending row pinned to a month. */
function cardTotal(month: Month, cardId: string, total: number): CardSpending {
  return { id: `${month}-${cardId}`, month, cardId, total };
}

/** Build a bill pinned to a month. */
function bill(month: Month, name: string, amount: number, isPaid = false): Bill {
  return { id: `${month}-${name}`, month, name, amount, isPaid, payerId: '', bankId: '' };
}

/** Build an income entry pinned to a month. */
function incomeEntry(month: Month, amount: number, source?: string): IncomeEntry {
  return { id: `${month}-${source ?? amount}`, month, amount, source };
}

describe('planTotal', () => {
  // Given a set of spending buckets
  // When computing Plan Total for a month
  // Then only that month's bucket caps are summed
  it.each([
    ['no items at all', [], 0],
    ['items only in other months', [planItem(OTHER_MONTH, 'Netflix', 44.9)], 0],
    ['a single bucket', [planItem(MONTH, 'Internet', 110)], 110],
    [
      'two bucket caps',
      [planItem(MONTH, 'Internet', 110), planItem(MONTH, 'Mercado/Farmácia', 6000)],
      6110,
    ],
    [
      'items across several months',
      [
        planItem(OTHER_MONTH, 'Mercado/Farmácia', 5000),
        planItem(MONTH, 'Mercado/Farmácia', 6000),
        planItem(OTHER_MONTH, 'Internet', 110),
        planItem(MONTH, 'Internet', 110),
      ],
      6110,
    ],
  ])('Given %s the Plan Total is %s', (_name, items, expected) => {
    expect(planTotal(MONTH, items)).toBe(expected);
  });
});

describe('totalSpent', () => {
  // Given a set of card-spending rows
  // When computing Total Spent for a month
  // Then only that month's card totals are summed
  it.each([
    ['no rows at all', [], 0],
    ['rows only in other months', [cardTotal(OTHER_MONTH, 'cc-guta', 1000)], 0],
    ['a single card total', [cardTotal(MONTH, 'cc-guta', 2899)], 2899],
    [
      'several card totals',
      [
        cardTotal(MONTH, 'cc-guta', 2899),
        cardTotal(MONTH, 'cc-uv', 9432),
        cardTotal(MONTH, 'cc-ml', 473),
      ],
      12804,
    ],
    // Missing card totals: a card with no check-in row yet contributes nothing.
    [
      'some cards not yet checked in',
      [cardTotal(MONTH, 'cc-guta', 2899), cardTotal(MONTH, 'cc-ml', 473)],
      3372,
    ],
  ])('Given %s the Total Spent is %s', (_name, cardSpending, expected) => {
    expect(totalSpent(MONTH, cardSpending)).toBe(expected);
  });
});

describe('projectedResult', () => {
  // Given plan items and card totals
  // When computing the Projected Result for a month
  // Then it is Plan Total − Total Spent − Σ remaining estimates
  it.each([
    ['an empty month', [], [], 0],
    [
      'zero estimates, inside the plan',
      [planItem(MONTH, 'Mercado/Farmácia', 6000)],
      [cardTotal(MONTH, 'cc-guta', 2899)],
      3101,
    ],
    [
      'remaining estimates subtracted from the projection',
      [planItem(MONTH, 'Restaurante', 1200, 250)],
      [cardTotal(MONTH, 'cc-uv', 1200)],
      -250,
    ],
    [
      'a negative (over-plan) result',
      [planItem(MONTH, 'Compras', 1000)],
      [cardTotal(MONTH, 'cc-uv', 1200)],
      -200,
    ],
    [
      'data from other months is ignored',
      [planItem(OTHER_MONTH, 'Compras', 1000, 999)],
      [cardTotal(OTHER_MONTH, 'cc-uv', 1200)],
      0,
    ],
  ])('Given %s the Projected Result is %s', (_name, items, cardSpending, expected) => {
    expect(projectedResult(MONTH, items, cardSpending)).toBe(expected);
  });
});

describe('planResult', () => {
  // Given plan items and card totals
  // When computing the Plan Result for a month
  // Then it is Plan Total − Total Spent
  it.each([
    ['an empty month', [], [], 0],
    [
      'a month inside the plan',
      [planItem(MONTH, 'Mercado/Farmácia', 6000)],
      [cardTotal(MONTH, 'cc-guta', 2899)],
      3101,
    ],
    [
      'a month over the plan',
      [planItem(MONTH, 'Compras', 1000)],
      [cardTotal(MONTH, 'cc-uv', 1200)],
      -200,
    ],
    [
      'data from other months is ignored',
      [planItem(OTHER_MONTH, 'Compras', 1000)],
      [cardTotal(OTHER_MONTH, 'cc-uv', 1200)],
      0,
    ],
  ])('Given %s the Plan Result is %s', (_name, items, cardSpending, expected) => {
    expect(planResult(MONTH, items, cardSpending)).toBe(expected);
  });
});

describe('incomeTotal', () => {
  // Given a set of income entries
  // When computing the month's income total
  // Then only that month's entries are summed
  it.each([
    ['no entries at all', [], 0],
    ['entries only in other months', [incomeEntry(OTHER_MONTH, 12000, 'Salário')], 0],
    ['a single salary', [incomeEntry(MONTH, 12000, 'Salário')], 12000],
    [
      'a salary plus extras, with notes optional',
      [
        incomeEntry(MONTH, 12000, 'Salário'),
        incomeEntry(MONTH, 500, 'Freela'),
        incomeEntry(MONTH, 250),
      ],
      12750,
    ],
    [
      'data from other months is ignored',
      [incomeEntry(OTHER_MONTH, 99999, 'Salário'), incomeEntry(MONTH, 100)],
      100,
    ],
  ])('Given %s the income total is %s', (_name, incomeEntries, expected) => {
    expect(incomeTotal(MONTH, incomeEntries)).toBe(expected);
  });
});

describe('billsTotal', () => {
  // Given a set of bills
  // When computing the month's bills total
  // Then only that month's bills are summed, paid or not
  it.each([
    ['no bills at all', [], 0],
    ['bills only in other months', [bill(OTHER_MONTH, 'Luz', 150)], 0],
    ['a single bill', [bill(MONTH, 'Luz', 150)], 150],
    [
      'open and paid bills, including the card bill statement value',
      [
        bill(MONTH, 'Luz', 150),
        bill(MONTH, 'Cartão guta', 2899, true),
      ],
      3049,
    ],
    [
      'data from other months is ignored',
      [bill(OTHER_MONTH, 'Luz', 99999), bill(MONTH, 'Internet', 110)],
      110,
    ],
  ])('Given %s the bills total is %s', (_name, bills, expected) => {
    expect(billsTotal(MONTH, bills)).toBe(expected);
  });
});

describe('accountNet', () => {
  // Given income entries and bills
  // When computing the Account Net for a month
  // Then it is Σ income − Σ bills
  it.each([
    ['an empty month', [], [], 0],
    ['income only', [incomeEntry(MONTH, 12000, 'Salário')], [], 12000],
    ['bills only', [], [bill(MONTH, 'Luz', 150)], -150],
    // Paid status does not change the account net: the bill is an obligation
    // either way.
    [
      'income minus bills',
      [incomeEntry(MONTH, 12000, 'Salário')],
      [bill(MONTH, 'Luz', 150), bill(MONTH, 'Cartão guta', 2899, true)],
      8951,
    ],
    [
      'bills exceed income',
      [incomeEntry(MONTH, 1000, 'Salário')],
      [bill(MONTH, 'Cartão guta', 2899)],
      -1899,
    ],
    [
      'data from other months is ignored',
      [incomeEntry(OTHER_MONTH, 99999, 'Salário')],
      [bill(OTHER_MONTH, 'Luz', 150)],
      0,
    ],
  ])('Given %s the Account Net is %s', (_name, incomeEntries, bills, expected) => {
    expect(accountNet(MONTH, incomeEntries, bills)).toBe(expected);
  });
});

describe('the June 2026 trace from the real historical sheet', () => {
  // Given the real June 2026 numbers: plan 10.750 across the month's buckets;
  // check-in 25/06: cc guta 2.899 + cc uv 9.432 + cc ml 473 → Total Spent 12.804;
  // remaining estimate: restaurante 250
  // When computing the control-loop numbers for 2026-06
  // Then Plan Total is 10.750, Total Spent is 12.804, Plan Result is −2.054 and
  // Projected Result is −2.304 (pt-BR notation; −2.304 = −2304)
  const items: PlanItem[] = [
    planItem(MONTH, 'Mercado/Farmácia', 6000),
    planItem(MONTH, 'Transporte', 800),
    planItem(MONTH, 'Restaurante', 1200, 250),
    planItem(MONTH, 'Compras', 1000),
    planItem(MONTH, 'Internet', 110),
    planItem(MONTH, 'Streaming', 90),
    planItem(MONTH, 'Gym', 200),
    planItem(MONTH, 'Seguro do carro', 1350),
  ];
  const cardSpending: CardSpending[] = [
    cardTotal(MONTH, 'cc-guta', 2899),
    cardTotal(MONTH, 'cc-uv', 9432),
    cardTotal(MONTH, 'cc-ml', 473),
  ];

  it('reproduces Plan Total, Total Spent, Plan Result and Projected Result exactly', () => {
    expect(planTotal(MONTH, items)).toBe(10750);
    expect(totalSpent(MONTH, cardSpending)).toBe(12804);
    expect(planResult(MONTH, items, cardSpending)).toBe(-2054);
    expect(projectedResult(MONTH, items, cardSpending)).toBe(-2304);
  });
});

describe('at month end', () => {
  // Given a month whose remaining estimates have all zeroed out
  // When comparing the Projected Result with the Plan Result
  // Then the projection is the final Plan Result
  it('the projection becomes the Plan Result', () => {
    const items = [
      planItem(MONTH, 'Mercado/Farmácia', 6000),
      planItem(MONTH, 'Restaurante', 1200, 0),
    ];
    const cardSpending = [cardTotal(MONTH, 'cc-guta', 2899)];

    expect(projectedResult(MONTH, items, cardSpending)).toBe(
      planResult(MONTH, items, cardSpending)
    );
  });
});
