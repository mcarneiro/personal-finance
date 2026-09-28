import { SHEET_CONFIGS } from '../config/google';
import { Bank, Bill, Card, CardSpending, IncomeEntry, Payer, PlanItem, PlanItemKind } from '../types';

interface SheetResponse {
  sheets?: Array<{
    properties?: {
      title: string;
    };
  }>;
}

interface ValueResponse {
  values?: unknown[][];
}

/**
 * Google Sheets plumbing ported from Stayoo (ADR-0001): OAuth token handling,
 * tab initialization, and per-tab read/write. Tabs only ever created when
 * missing — existing sheet content is never modified by initialization.
 */
export class GoogleSheetsService {
  private static instance: GoogleSheetsService;
  private accessToken: string | null = null;

  private constructor() {}

  static getInstance(): GoogleSheetsService {
    if (!GoogleSheetsService.instance) {
      GoogleSheetsService.instance = new GoogleSheetsService();
    }
    return GoogleSheetsService.instance;
  }

  /** Set access token for API requests. */
  setAccessToken(token: string) {
    this.accessToken = token;
  }

  /** Make a request to the Google Sheets API. */
  private async apiRequest(url: string, options: RequestInit = {}) {
    if (!this.accessToken) {
      throw new Error('No access token available. Please sign in.');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      // Handle authentication errors (expired or invalid token)
      if (response.status === 401) {
        // Clear the invalid token
        this.accessToken = null;
        const error = new Error('Your session has expired. Please sign in again.');
        (error as { code?: string }).code = 'TOKEN_EXPIRED';
        throw error;
      }

      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'API request failed');
    }

    return response.json();
  }

  /** The titles of every tab in the spreadsheet. */
  private async listSheetTitles(spreadsheetId: string): Promise<Set<string>> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const data: SheetResponse = await this.apiRequest(url);

    const titles = (data.sheets || [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => typeof title === 'string');
    return new Set(titles);
  }

  /** Create a new tab. */
  private async createSheet(spreadsheetId: string, sheetName: string): Promise<void> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    await this.apiRequest(url, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      }),
    });
  }

  /** Write headers to a tab. */
  private async writeHeaders(
    spreadsheetId: string,
    sheetName: string,
    columns: readonly string[]
  ): Promise<void> {
    const range = `${sheetName}!A1:${String.fromCharCode(64 + columns.length)}1`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;

    await this.apiRequest(url, {
      method: 'PUT',
      body: JSON.stringify({
        values: [columns],
      }),
    });
  }

  /**
   * Rewrite a tab's header row only when it does not already match the contract
   * — how an existing sheet gains columns introduced after it was created. Data
   * rows are never touched: cells for a new column read back blank until the
   * row is next written.
   */
  private async ensureHeaders(
    spreadsheetId: string,
    sheetName: string,
    columns: readonly string[]
  ): Promise<void> {
    const rows = await this.readRows(spreadsheetId, sheetName, 'A1:Z1');
    const header = rows[0] ?? [];
    const matches =
      header.length === columns.length && columns.every((column, i) => String(header[i]) === column);

    if (!matches) {
      await this.writeHeaders(spreadsheetId, sheetName, columns);
    }
  }

  /**
   * Initialize all required tabs: missing tabs are created with their header
   * row, and an existing tab whose header row drifted is re-headed (see
   * `ensureHeaders`). Existing data rows are left untouched.
   */
  async initializeSheets(spreadsheetId: string): Promise<void> {
    const titles = await this.listSheetTitles(spreadsheetId);

    for (const config of Object.values(SHEET_CONFIGS)) {
      if (!titles.has(config.name)) {
        await this.createSheet(spreadsheetId, config.name);
        await this.writeHeaders(spreadsheetId, config.name, config.columns);
      } else {
        await this.ensureHeaders(spreadsheetId, config.name, config.columns);
      }
    }
  }

  /** Read every tab once, returning the raw (headerless) rows. */
  private async readRows(spreadsheetId: string, sheetName: string, range: string): Promise<unknown[][]> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!${range}?valueRenderOption=UNFORMATTED_VALUE`;
    const data: ValueResponse = await this.apiRequest(url);
    return data.values || [];
  }

  /** Replace every data row in a tab (header row is preserved). */
  private async writeRows(
    spreadsheetId: string,
    sheetName: string,
    lastColumn: string,
    values: unknown[][]
  ): Promise<void> {
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A2:${lastColumn}:clear`;
    await this.apiRequest(clearUrl, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (values.length > 0) {
      // RAW keeps values exactly as sent. Planoo keys rows by a `YYYY-MM` month
      // string, so USER_ENTERED must be avoided: Sheets would coerce `2026-06`
      // into a date and read it back as a serial number.
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A2?valueInputOption=RAW`;
      await this.apiRequest(url, {
        method: 'PUT',
        body: JSON.stringify({ values }),
      });
    }
  }

  private parseNumber(value: unknown): number {
    const parsed = parseFloat(String(value));
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private parseBoolean(value: unknown): boolean {
    return (
      value === true ||
      value === 'TRUE' ||
      value === 'true' ||
      value === 1 ||
      value === '1' ||
      String(value).toUpperCase() === 'TRUE'
    );
  }

  private parseString(value: unknown, fallback = ''): string {
    return value === null || value === undefined ? fallback : String(value);
  }

  private isBlankRow(row: unknown[]): boolean {
    return row.every((cell) => cell === '' || cell === null || cell === undefined);
  }

  async readCards(spreadsheetId: string): Promise<Card[]> {
    const rows = await this.readRows(spreadsheetId, 'cards', 'A2:B');
    return rows.filter((row) => !this.isBlankRow(row)).map((row, index) => {
      const [id, name] = row;
      return { id: this.parseString(id, `card-${index}`), name: this.parseString(name) };
    });
  }

  async writeCards(spreadsheetId: string, cards: Card[]): Promise<void> {
    await this.writeRows(
      spreadsheetId,
      'cards',
      'B',
      cards.map((card) => [card.id, card.name])
    );
  }

  async readBanks(spreadsheetId: string): Promise<Bank[]> {
    const rows = await this.readRows(spreadsheetId, 'banks', 'A2:B');
    return rows.filter((row) => !this.isBlankRow(row)).map((row, index) => {
      const [id, name] = row;
      return { id: this.parseString(id, `bank-${index}`), name: this.parseString(name) };
    });
  }

  async writeBanks(spreadsheetId: string, banks: Bank[]): Promise<void> {
    await this.writeRows(
      spreadsheetId,
      'banks',
      'B',
      banks.map((bank) => [bank.id, bank.name])
    );
  }

  async readPayers(spreadsheetId: string): Promise<Payer[]> {
    const rows = await this.readRows(spreadsheetId, 'payers', 'A2:B');
    return rows.filter((row) => !this.isBlankRow(row)).map((row, index) => {
      const [id, name] = row;
      return { id: this.parseString(id, `payer-${index}`), name: this.parseString(name) };
    });
  }

  async writePayers(spreadsheetId: string, payers: Payer[]): Promise<void> {
    await this.writeRows(
      spreadsheetId,
      'payers',
      'B',
      payers.map((payer) => [payer.id, payer.name])
    );
  }

  async readPlanItems(spreadsheetId: string): Promise<PlanItem[]> {
    const rows = await this.readRows(spreadsheetId, 'plan', 'A2:F');
    return rows.filter((row) => !this.isBlankRow(row)).map((row, index) => {
      const [id, month, kind, name, amount, remainingEstimate] = row;
      return {
        id: this.parseString(id, `plan-${index}`),
        month: this.parseString(month),
        kind: (this.parseString(kind) === 'fixed' ? 'fixed' : 'variable') as PlanItemKind,
        name: this.parseString(name),
        amount: this.parseNumber(amount),
        remainingEstimate: this.parseNumber(remainingEstimate),
      };
    });
  }

  async writePlanItems(spreadsheetId: string, items: PlanItem[]): Promise<void> {
    await this.writeRows(
      spreadsheetId,
      'plan',
      'F',
      items.map((item) => [
        item.id,
        item.month,
        item.kind,
        item.name,
        item.amount,
        item.remainingEstimate,
      ])
    );
  }

  async readCardSpending(spreadsheetId: string): Promise<CardSpending[]> {
    const rows = await this.readRows(spreadsheetId, 'card_spending', 'A2:D');
    return rows.filter((row) => !this.isBlankRow(row)).map((row, index) => {
      const [id, month, cardId, total] = row;
      return {
        id: this.parseString(id, `card-spending-${index}`),
        month: this.parseString(month),
        cardId: this.parseString(cardId),
        total: this.parseNumber(total),
      };
    });
  }

  async writeCardSpending(spreadsheetId: string, entries: CardSpending[]): Promise<void> {
    await this.writeRows(
      spreadsheetId,
      'card_spending',
      'D',
      entries.map((entry) => [entry.id, entry.month, entry.cardId, entry.total])
    );
  }

  async readBills(spreadsheetId: string): Promise<Bill[]> {
    const rows = await this.readRows(spreadsheetId, 'bills', 'A2:G');
    return rows.filter((row) => !this.isBlankRow(row)).map((row, index) => {
      const [id, month, name, amount, isPaid, payerId, bankId] = row;
      return {
        id: this.parseString(id, `bill-${index}`),
        month: this.parseString(month),
        name: this.parseString(name),
        amount: this.parseNumber(amount),
        isPaid: this.parseBoolean(isPaid),
        // Blank cells are the legacy default: bills written before these
        // columns existed read back as unset.
        payerId: this.parseString(payerId),
        bankId: this.parseString(bankId),
      };
    });
  }

  async writeBills(spreadsheetId: string, bills: Bill[]): Promise<void> {
    await this.writeRows(
      spreadsheetId,
      'bills',
      'G',
      bills.map((bill) => [
        bill.id,
        bill.month,
        bill.name,
        bill.amount,
        bill.isPaid ? 'TRUE' : 'FALSE',
        bill.payerId,
        bill.bankId,
      ])
    );
  }

  async readIncome(spreadsheetId: string): Promise<IncomeEntry[]> {
    const rows = await this.readRows(spreadsheetId, 'income', 'A2:D');
    return rows.filter((row) => !this.isBlankRow(row)).map((row, index) => {
      const [id, month, amount, source] = row;
      return {
        id: this.parseString(id, `income-${index}`),
        month: this.parseString(month),
        amount: this.parseNumber(amount),
        source: this.parseString(source) || undefined,
      };
    });
  }

  async writeIncome(spreadsheetId: string, entries: IncomeEntry[]): Promise<void> {
    await this.writeRows(
      spreadsheetId,
      'income',
      'D',
      entries.map((entry) => [entry.id, entry.month, entry.amount, entry.source || ''])
    );
  }

  /** Extract the spreadsheet ID from a pasted Google Sheets URL. */
  static extractSpreadsheetId(url: string): string | null {
    const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }
}

export const googleSheetsService = GoogleSheetsService.getInstance();
