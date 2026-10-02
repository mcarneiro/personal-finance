import { describe, expect, it } from 'vitest';
import { SHEET_CONFIGS, SHEET_CONTRACT_VERSION, SHEET_KEYS } from '../google';

describe('SHEET_CONFIGS', () => {
  it('defines exactly the Planyoo tabs with the PRD columns', () => {
    // Given the sheet schema is the contract with the user's spreadsheet
    // When the tab configuration is read
    // Then every tab and column matches prd.md exactly
    expect(SHEET_CONFIGS).toEqual({
      cards: { name: 'cards', columns: ['id', 'name'] },
      banks: { name: 'banks', columns: ['id', 'name'] },
      payers: { name: 'payers', columns: ['id', 'name'] },
      plan: {
        name: 'plan',
        columns: ['id', 'month', 'name', 'amount', 'remaining_estimate'],
      },
      card_spending: {
        name: 'card_spending',
        columns: ['id', 'month', 'card_id', 'total'],
      },
      outflows: {
        name: 'outflows',
        columns: ['id', 'month', 'name', 'amount', 'is_paid', 'payer_id', 'bank_id', 'is_final'],
      },
      income: { name: 'income', columns: ['id', 'month', 'amount', 'source'] },
      savings_pots: { name: 'savings_pots', columns: ['id', 'name'] },
      savings_balances: {
        name: 'savings_balances',
        columns: ['id', 'month', 'pot_id', 'balance'],
      },
    });
  });

  it('keeps the savings tabs after income, without disturbing the earlier seven', () => {
    // Given the two savings tabs join the contract
    // When every tab is walked in its fixed order
    // Then the original seven keep their order and savings follows income
    expect(SHEET_KEYS).toEqual([
      'cards',
      'banks',
      'payers',
      'plan',
      'card_spending',
      'outflows',
      'income',
      'savings_pots',
      'savings_balances',
    ]);
  });
});

describe('SHEET_CONTRACT_VERSION', () => {
  it('is the deterministic signature of the tab config, savings included', () => {
    // Given the tab definitions are the contract version's only input
    // When the version is read
    // Then it is the per-tab signature joined in order, so a config change
    // always moves it without anyone hand-bumping a constant
    expect(SHEET_CONTRACT_VERSION).toBe(
      SHEET_KEYS.map(
        (key) => `${SHEET_CONFIGS[key].name}(${SHEET_CONFIGS[key].columns.join(',')})`
      ).join('|')
    );
    expect(SHEET_CONTRACT_VERSION).toContain('savings_pots(id,name)');
    expect(SHEET_CONTRACT_VERSION).toContain('savings_balances(id,month,pot_id,balance)');
  });

  it('differs from the seven-tab version a device would have cached', () => {
    // Given the contract version before the two savings tabs existed
    const legacyVersion = [
      'cards(id,name)',
      'banks(id,name)',
      'payers(id,name)',
      'plan(id,month,name,amount,remaining_estimate)',
      'card_spending(id,month,card_id,total)',
      'outflows(id,month,name,amount,is_paid,payer_id,bank_id,is_final)',
      'income(id,month,amount,source)',
    ].join('|');

    // When the current version is read
    // Then it has moved, so every device's cached Working Copy is invalidated
    expect(SHEET_CONTRACT_VERSION).not.toBe(legacyVersion);
  });
});
