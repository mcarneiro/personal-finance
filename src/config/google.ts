// Google API Configuration
export const GOOGLE_CONFIG = {
  // OAuth Client ID from environment variables
  // This is set up once by the developer, not by each user
  CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',

  // Scopes required for the application
  SCOPES: [
    'https://www.googleapis.com/auth/spreadsheets', // Read and write access to sheets
  ].join(' '),

  // Discovery docs for Google Sheets API
  DISCOVERY_DOCS: [
    'https://sheets.googleapis.com/$discovery/rest?version=v4',
  ],
};

/**
 * Sheet tab definitions for Planyoo. Column names are the sheet contract (see
 * `prd.md`) and must not drift. A missing tab is created with its header row; an
 * existing tab whose header row differs (e.g. one created before a new column
 * was introduced) has its header row rewritten, but never its data.
 */
export const SHEET_CONFIGS = {
  cards: {
    name: 'cards',
    columns: ['id', 'name'],
  },
  banks: {
    name: 'banks',
    columns: ['id', 'name'],
  },
  payers: {
    name: 'payers',
    columns: ['id', 'name'],
  },
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
  income: {
    name: 'income',
    columns: ['id', 'month', 'amount', 'source'],
  },
  savings_pots: {
    name: 'savings_pots',
    columns: ['id', 'name'],
  },
  savings_balances: {
    name: 'savings_balances',
    columns: ['id', 'month', 'pot_id', 'balance'],
  },
} as const;

export type SheetKey = keyof typeof SHEET_CONFIGS;

/** Every tab, in the fixed order the batched read and write paths walk them. */
export const SHEET_KEYS = Object.keys(SHEET_CONFIGS) as SheetKey[];

/**
 * Sheet contract version: a deterministic signature of the tab definitions
 * above. A cached Working Copy is stamped with it and only reused while the
 * stamp still matches, so adding, removing or renaming a column invalidates the
 * local cache without anyone having to remember to bump a constant.
 */
export const SHEET_CONTRACT_VERSION: string = (Object.keys(SHEET_CONFIGS) as SheetKey[])
  .map((key) => `${SHEET_CONFIGS[key].name}(${SHEET_CONFIGS[key].columns.join(',')})`)
  .join('|');
