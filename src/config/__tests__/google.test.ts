import { describe, expect, it } from 'vitest';
import { SHEET_CONFIGS } from '../google';

describe('SHEET_CONFIGS', () => {
  it('defines exactly the five Planoo tabs with the PRD columns', () => {
    // Given the sheet schema is the contract with the user's spreadsheet
    // When the tab configuration is read
    // Then every tab and column matches prd.md exactly
    expect(SHEET_CONFIGS).toEqual({
      cards: { name: 'cards', columns: ['id', 'name'] },
      plan: {
        name: 'plan',
        columns: ['id', 'month', 'kind', 'name', 'amount', 'remaining_estimate'],
      },
      card_spending: {
        name: 'card_spending',
        columns: ['id', 'month', 'card_id', 'total'],
      },
      bills: { name: 'bills', columns: ['id', 'month', 'name', 'amount', 'is_paid'] },
      income: { name: 'income', columns: ['id', 'month', 'amount', 'source'] },
    });
  });
});
