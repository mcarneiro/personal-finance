import { describe, expect, it } from 'vitest';
import {
  accountNet,
  outflowsTotal,
  incomeTotal,
  planResult,
  planTotal,
  projectedResult,
  totalSpent,
} from '../utils/controlLoop';
import { DEMO_MONTHS, JUNE_CHECKIN } from './demoData';

describe('demo data — the real-data verification run (ticket 09)', () => {
  // Given the seeded demo months (the real June trace plus simulated
  // July/August/September on the same plan)
  // When each month's control-loop numbers are computed
  // Then Plan Total, Total Spent, Projected Result, Plan Result, outflows total,
  // income total and account net all match the values recorded in the sheet
  it.each(DEMO_MONTHS)('reproduces every recorded value for $month', (entry) => {
    const { month, planItems, cardSpending, outflows, income, expected } = entry;

    expect(planTotal(month, planItems)).toBe(expected.planTotal);
    expect(totalSpent(month, cardSpending)).toBe(expected.totalSpent);
    expect(projectedResult(month, planItems, cardSpending)).toBe(expected.projectedResult);
    expect(planResult(month, planItems, cardSpending)).toBe(expected.planResult);
    expect(outflowsTotal(month, outflows)).toBe(expected.outflowsTotal);
    expect(incomeTotal(month, income)).toBe(expected.incomeTotal);
    expect(accountNet(month, income, outflows)).toBe(expected.accountNet);
  });

  // Given August is fully closed (estimates zeroed)
  // When the app headlines the month
  // Then the final Plan Result is the recorded sobra, −287
  it('August closes at the recorded sobra of −287', () => {
    const august = DEMO_MONTHS.find((entry) => entry.month === '2026-08');
    expect(august).toBeDefined();
    if (!august) return;

    expect(planResult(august.month, august.planItems, august.cardSpending)).toBe(-287);
  });

  // Given the 25/06 check-in: card totals 12.804 and a Restaurante estimate of 250
  // When the live Projected Result is computed
  // Then it is −2.304 (over plan, red)
  it('the 25/06 check-in projects −2.304', () => {
    expect(
      projectedResult(JUNE_CHECKIN.month, JUNE_CHECKIN.planItems, JUNE_CHECKIN.cardSpending)
    ).toBe(-2304);
  });
});
