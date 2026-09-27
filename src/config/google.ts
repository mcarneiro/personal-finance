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
 * Sheet tab definitions for Planoo. Column names are the sheet contract (see
 * `prd.md`) and must not drift: a tab is only created when it is missing, and
 * existing content is never touched.
 */
export const SHEET_CONFIGS = {
  cards: {
    name: 'cards',
    columns: ['id', 'name'],
  },
  plan: {
    name: 'plan',
    columns: ['id', 'month', 'kind', 'name', 'amount', 'remaining_estimate'],
  },
  card_spending: {
    name: 'card_spending',
    columns: ['id', 'month', 'card_id', 'total'],
  },
  bills: {
    name: 'bills',
    columns: ['id', 'month', 'name', 'amount', 'is_paid'],
  },
  income: {
    name: 'income',
    columns: ['id', 'month', 'amount', 'source'],
  },
} as const;

export type SheetKey = keyof typeof SHEET_CONFIGS;
