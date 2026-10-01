import { SHEET_CONFIGS, type SheetKey } from '../config/google';
import { Bank, Bill, Card, CardSpending, IncomeEntry, Payer, PlanItem, SheetData } from '../types';

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

interface BatchGetResponse {
  valueRanges?: Array<{
    values?: unknown[][];
  }>;
}

/** Every tab, in the fixed order the batch read and parsing walk them. */
const SHEET_KEYS = Object.keys(SHEET_CONFIGS) as SheetKey[];

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

  /** Clear every cell in a range (used to drop rows and stale header cells). */
  private async clearRange(
    spreadsheetId: string,
    sheetName: string,
    range: string
  ): Promise<void> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!${range}:clear`;
    await this.apiRequest(url, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  /**
   * Rewrite a tab's header row only when it does not already match the contract
   * — how an existing sheet gains columns introduced after it was created. Data
   * rows are never touched: cells for a new column read back blank until the
   * row is next written. When the contract shrinks, the now-superfluous header
   * cells are cleared too, otherwise a stale trailing header would keep the row
   * "not matching" and be rewritten on every load.
   */
  private async ensureHeaders(
    spreadsheetId: string,
    sheetName: string,
    columns: readonly string[]
  ): Promise<void> {
    const rows = await this.readRows(spreadsheetId, sheetName, 'A1:Z1');
    await this.reconcileHeader(spreadsheetId, sheetName, rows[0] ?? [], columns);
  }

  /**
   * Reconcile a tab's header row against the contract, given the header already
   * read. Nothing is written when it matches; otherwise the header is rewritten
   * (data rows are never touched) and, when the contract shrank, the now
   * superfluous header cells are cleared so the row stops reporting a mismatch.
   */
  private async reconcileHeader(
    spreadsheetId: string,
    sheetName: string,
    header: unknown[],
    columns: readonly string[]
  ): Promise<void> {
    const matches =
      header.length === columns.length && columns.every((column, i) => String(header[i]) === column);
    if (matches) return;

    await this.writeHeaders(spreadsheetId, sheetName, columns);
    if (header.length > columns.length) {
      const firstExtra = String.fromCharCode(65 + columns.length);
      const lastExtra = String.fromCharCode(64 + header.length);
      await this.clearRange(spreadsheetId, sheetName, `${firstExtra}1:${lastExtra}1`);
    }
  }

  /**
   * Migrate the `plan` tab off the retired `kind` column. Planoo no longer
   * distinguishes fixed charges from spending buckets — every plan item is a
   * bucket — so the third column is dropped and each remaining row is rewritten
   * in the new order (id, month, name, amount, remaining_estimate). Without this
   * the header rewrite in `ensureHeaders` would leave data rows shifted one
   * column left and corrupt every read.
   *
   * Detection is two-pronged: the original header still names the third column
   * `kind`, or — if an earlier load already re-headed the tab but left the rows
   * in the old order — the rows are wider than the new five-column contract.
   * The second case only triggers when the header is also the wrong width, so an
   * ordinary bucket legitimately named `fixed` or `variable` is never mistaken
   * for legacy data.
   */
  private async migrateLegacyPlanRows(
    spreadsheetId: string,
    header: unknown[],
    dataRows: unknown[][]
  ): Promise<unknown[][] | null> {
    const newColumns = SHEET_CONFIGS.plan.columns;
    const nonBlank = dataRows.filter((row) => !this.isBlankRow(row));
    const headerHasKind = String(header[2]) === 'kind';
    const rowsLookLegacy =
      header.length !== newColumns.length && nonBlank.some((row) => row.length > newColumns.length);
    if (!headerHasKind && !rowsLookLegacy) return null;

    const migrated = nonBlank.map((row) => [
      row[0] ?? '',
      row[1] ?? '',
      row[3] ?? '',
      row[4] ?? '',
      row[5] ?? '',
    ]);

    await this.writeRows(spreadsheetId, 'plan', 'F', migrated);
    await this.writeHeaders(spreadsheetId, 'plan', newColumns);
    return migrated;
  }

  /** Migrate the `plan` tab by reading it first (onboarding's schema walk). */
  private async migrateLegacyPlanSheet(spreadsheetId: string): Promise<void> {
    const rows = await this.readRows(spreadsheetId, 'plan', 'A1:Z');
    await this.migrateLegacyPlanRows(spreadsheetId, rows[0] ?? [], rows.slice(1));
  }

  /** One range per tab, spanning the header row and every data row. */
  private tabRanges(): string[] {
    return SHEET_KEYS.map((key) => `${SHEET_CONFIGS[key].name}!A1:Z`);
  }

  /**
   * Read every tab's header and data rows in one `values:batchGet`. The response
   * is aligned to `tabRanges()`; a range the API omitted reads as empty.
   */
  private async batchGetTabValues(spreadsheetId: string): Promise<unknown[][][]> {
    const ranges = this.tabRanges();
    const query = ranges.map((range) => `ranges=${encodeURIComponent(range)}`).join('&');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${query}&valueRenderOption=UNFORMATTED_VALUE`;
    const data: BatchGetResponse = await this.apiRequest(url);
    const returned = data.valueRanges ?? [];
    return ranges.map((_, index) => returned[index]?.values ?? []);
  }

  /**
   * Whether a `batchGet` failure means a tab does not exist yet. Sheets rejects
   * the whole batch when any range names a missing tab, so this is the only
   * signal that justifies the metadata/title call (and the retried read). Other
   * failures — auth, network, quota — are real errors and must surface.
   */
  private isMissingTabError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /unable to parse range/i.test(message);
  }

  /** Create the tabs the connected sheet does not have yet, headers included. */
  private async createMissingTabs(spreadsheetId: string): Promise<void> {
    const titles = await this.listSheetTitles(spreadsheetId);
    for (const key of SHEET_KEYS) {
      const config = SHEET_CONFIGS[key];
      if (!titles.has(config.name)) {
        await this.createSheet(spreadsheetId, config.name);
        await this.writeHeaders(spreadsheetId, config.name, config.columns);
      }
    }
  }

  /**
   * The pull side of the sync cycle: read every tab — headers and data — in a
   * single Sheets request, create any missing tab with its header row, re-head a
   * drifted header without touching its data, and migrate the legacy plan sheet.
   * The returned snapshot is the raw sheet state; replaying Pending Changes over
   * it is the caller's job (ADR-0007, ADR-0008).
   *
   * A tab the sheet does not have yet makes `batchGet` reject. Only then is the
   * sheet-metadata call made: the missing tabs are created and the same single
   * read is retried. Any other failure is rethrown, so an offline or auth error
   * never masquerades as a missing tab.
   */
  async pullAll(spreadsheetId: string): Promise<SheetData> {
    let values: unknown[][][];
    try {
      values = await this.batchGetTabValues(spreadsheetId);
    } catch (error) {
      if (!this.isMissingTabError(error)) throw error;
      await this.createMissingTabs(spreadsheetId);
      values = await this.batchGetTabValues(spreadsheetId);
    }

    const byKey: Partial<Record<SheetKey, unknown[][]>> = {};
    for (let i = 0; i < SHEET_KEYS.length; i++) {
      const key = SHEET_KEYS[i];
      const config = SHEET_CONFIGS[key];
      const header: unknown[] = values[i][0] ?? [];
      let body = values[i].slice(1);

      if (key === 'plan') {
        const migrated = await this.migrateLegacyPlanRows(spreadsheetId, header, body);
        if (migrated) body = migrated;
      }
      // Reconcile against the header as read, not the migrated one, so a stale
      // trailing cell from a wider legacy header is cleared in the same pull.
      await this.reconcileHeader(spreadsheetId, config.name, header, config.columns);
      byKey[key] = body;
    }

    return {
      cards: this.parseCardsRows(byKey.cards ?? []),
      banks: this.parseBanksRows(byKey.banks ?? []),
      payers: this.parsePayersRows(byKey.payers ?? []),
      planItems: this.parsePlanRows(byKey.plan ?? []),
      cardSpending: this.parseCardSpendingRows(byKey.card_spending ?? []),
      bills: this.parseBillsRows(byKey.bills ?? []),
      income: this.parseIncomeRows(byKey.income ?? []),
    };
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
        if (config.name === 'plan') {
          await this.migrateLegacyPlanSheet(spreadsheetId);
        }
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
    await this.clearRange(spreadsheetId, sheetName, `A2:${lastColumn}`);

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

  /**
   * Decode a tab's data rows (header already stripped) into records. Shared by
   * the per-tab reads and the single-request pull, so both paths decode
   * identically. Blank rows — the holes a delete leaves — are skipped.
   */
  private parseCardsRows(rows: unknown[][]): Card[] {
    return rows.filter((row) => !this.isBlankRow(row)).map((row, index) => {
      const [id, name] = row;
      return { id: this.parseString(id, `card-${index}`), name: this.parseString(name) };
    });
  }

  private parseBanksRows(rows: unknown[][]): Bank[] {
    return rows.filter((row) => !this.isBlankRow(row)).map((row, index) => {
      const [id, name] = row;
      return { id: this.parseString(id, `bank-${index}`), name: this.parseString(name) };
    });
  }

  private parsePayersRows(rows: unknown[][]): Payer[] {
    return rows.filter((row) => !this.isBlankRow(row)).map((row, index) => {
      const [id, name] = row;
      return { id: this.parseString(id, `payer-${index}`), name: this.parseString(name) };
    });
  }

  private parsePlanRows(rows: unknown[][]): PlanItem[] {
    return rows.filter((row) => !this.isBlankRow(row)).map((row, index) => {
      const [id, month, name, amount, remainingEstimate] = row;
      return {
        id: this.parseString(id, `plan-${index}`),
        month: this.parseString(month),
        name: this.parseString(name),
        amount: this.parseNumber(amount),
        remainingEstimate: this.parseNumber(remainingEstimate),
      };
    });
  }

  private parseCardSpendingRows(rows: unknown[][]): CardSpending[] {
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

  private parseBillsRows(rows: unknown[][]): Bill[] {
    return rows.filter((row) => !this.isBlankRow(row)).map((row, index) => {
      const [id, month, name, amount, isPaid, payerId, bankId, isFinal] = row;
      return {
        id: this.parseString(id, `bill-${index}`),
        month: this.parseString(month),
        name: this.parseString(name),
        amount: this.parseNumber(amount),
        isPaid: this.parseBoolean(isPaid),
        // Blank cells are the legacy default: bills written before these
        // columns existed read back as unset, and an absent is_final reads as
        // not final so the value is flagged for review.
        isFinal: this.parseBoolean(isFinal),
        payerId: this.parseString(payerId),
        bankId: this.parseString(bankId),
      };
    });
  }

  private parseIncomeRows(rows: unknown[][]): IncomeEntry[] {
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

  async readCards(spreadsheetId: string): Promise<Card[]> {
    return this.parseCardsRows(await this.readRows(spreadsheetId, 'cards', 'A2:B'));
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
    return this.parseBanksRows(await this.readRows(spreadsheetId, 'banks', 'A2:B'));
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
    return this.parsePayersRows(await this.readRows(spreadsheetId, 'payers', 'A2:B'));
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
    return this.parsePlanRows(await this.readRows(spreadsheetId, 'plan', 'A2:E'));
  }

  async writePlanItems(spreadsheetId: string, items: PlanItem[]): Promise<void> {
    await this.writeRows(
      spreadsheetId,
      'plan',
      'E',
      items.map((item) => [
        item.id,
        item.month,
        item.name,
        item.amount,
        item.remainingEstimate,
      ])
    );
  }

  async readCardSpending(spreadsheetId: string): Promise<CardSpending[]> {
    return this.parseCardSpendingRows(await this.readRows(spreadsheetId, 'card_spending', 'A2:D'));
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
    return this.parseBillsRows(await this.readRows(spreadsheetId, 'bills', 'A2:H'));
  }

  async writeBills(spreadsheetId: string, bills: Bill[]): Promise<void> {
    await this.writeRows(
      spreadsheetId,
      'bills',
      'H',
      bills.map((bill) => [
        bill.id,
        bill.month,
        bill.name,
        bill.amount,
        bill.isPaid ? 'TRUE' : 'FALSE',
        bill.payerId,
        bill.bankId,
        bill.isFinal ? 'TRUE' : 'FALSE',
      ])
    );
  }

  async readIncome(spreadsheetId: string): Promise<IncomeEntry[]> {
    return this.parseIncomeRows(await this.readRows(spreadsheetId, 'income', 'A2:D'));
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
