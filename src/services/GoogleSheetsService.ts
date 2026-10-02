import { SHEET_CONFIGS, SHEET_KEYS, type SheetKey } from '../config/google';
import {
  Bank,
  Bill,
  Card,
  CardSpending,
  IncomeEntry,
  Payer,
  PendingChanges,
  PlanItem,
  SheetData,
} from '../types';

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
   * Migrate the `plan` tab off the retired `kind` column. Planyoo no longer
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
   *
   * `verifySchema` defaults to true. When the caller holds a cached Working Copy
   * stamped as schema-known-good for this sheet and contract, it can pass false
   * to skip the header checks (and the legacy plan migration) entirely: the
   * headers are still read with the data, but never rewritten. A missing tab is
   * still created, because that is driven by the read failing, not by a check.
   */
  async pullAll(
    spreadsheetId: string,
    { verifySchema = true }: { verifySchema?: boolean } = {}
  ): Promise<SheetData> {
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

      if (verifySchema) {
        if (key === 'plan') {
          const migrated = await this.migrateLegacyPlanRows(spreadsheetId, header, body);
          if (migrated) body = migrated;
        }
        // Reconcile against the header as read, not the migrated one, so a stale
        // trailing cell from a wider legacy header is cleared in the same pull.
        await this.reconcileHeader(spreadsheetId, config.name, header, config.columns);
      }
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
      // RAW keeps values exactly as sent. Planyoo keys rows by a `YYYY-MM` month
      // string, so USER_ENTERED must be avoided: Sheets would coerce `2026-06`
      // into a date and read it back as a serial number.
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A2?valueInputOption=RAW`;
      await this.apiRequest(url, {
        method: 'PUT',
        body: JSON.stringify({ values }),
      });
    }
  }

  /** Serialize one record into its tab's row, in the sheet contract's order. */
  private toRow(key: SheetKey, record: unknown): unknown[] {
    switch (key) {
      case 'cards': {
        const card = record as Card;
        return [card.id, card.name];
      }
      case 'banks': {
        const bank = record as Bank;
        return [bank.id, bank.name];
      }
      case 'payers': {
        const payer = record as Payer;
        return [payer.id, payer.name];
      }
      case 'plan': {
        const item = record as PlanItem;
        return [item.id, item.month, item.name, item.amount, item.remainingEstimate];
      }
      case 'card_spending': {
        const entry = record as CardSpending;
        return [entry.id, entry.month, entry.cardId, entry.total];
      }
      case 'bills': {
        const bill = record as Bill;
        return [
          bill.id,
          bill.month,
          bill.name,
          bill.amount,
          bill.isPaid ? 'TRUE' : 'FALSE',
          bill.payerId,
          bill.bankId,
          bill.isFinal ? 'TRUE' : 'FALSE',
        ];
      }
      case 'income': {
        const entry = record as IncomeEntry;
        return [entry.id, entry.month, entry.amount, entry.source || ''];
      }
    }
  }

  /**
   * Read the id column of every affected tab in one `values:batchGet` (A2:A per
   * tab). The response is aligned to `keys`; an omitted range reads as empty.
   */
  private async batchGetIdColumns(
    spreadsheetId: string,
    keys: SheetKey[]
  ): Promise<Partial<Record<SheetKey, unknown[][]>>> {
    const ranges = keys.map((key) => `${SHEET_CONFIGS[key].name}!A2:A`);
    const query = ranges.map((range) => `ranges=${encodeURIComponent(range)}`).join('&');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${query}&valueRenderOption=UNFORMATTED_VALUE`;
    const data: BatchGetResponse = await this.apiRequest(url);
    const returned = data.valueRanges ?? [];
    const byKey: Partial<Record<SheetKey, unknown[][]>> = {};
    keys.forEach((key, index) => {
      byKey[key] = returned[index]?.values ?? [];
    });
    return byKey;
  }

  /** Map each non-blank id in a tab's id column to its 1-based sheet row. */
  private rowIndexById(idColumn: unknown[][] | undefined): Map<string, number> {
    const rowById = new Map<string, number>();
    (idColumn ?? []).forEach((row, index) => {
      const id = this.parseString(row?.[0]).trim();
      if (id) rowById.set(id, index + 2);
    });
    return rowById;
  }

  /**
   * The write side of the sync cycle (ADR-0008): a save re-reads the id column
   * of every affected tab in one request, maps each Pending Change to its row,
   * and writes only those rows' ranges in one `values:batchUpdate`. Creates
   * whose id is absent append at the tab's end; an id already in the sheet is
   * overwritten (the local Pending Change always wins), and an update for an id
   * the sheet no longer has appends too — a local edit is never dropped; deletes
   * blank the row in place so no other row shifts. Untouched rows are never
   * rewritten, so a save from a stale Working Copy cannot drop another member's
   * edits.
   *
   * Local Pending Changes are the sole source of the written values — the
   * device's whole copy is never sent.
   */
  async writePendingChanges(spreadsheetId: string, pending: PendingChanges): Promise<void> {
    const keys = SHEET_KEYS.filter((key) => Object.keys(pending[key] ?? {}).length > 0);
    if (keys.length === 0) return;

    const idColumns = await this.batchGetIdColumns(spreadsheetId, keys);
    const data: Array<{ range: string; values: unknown[][] }> = [];

    for (const key of keys) {
      const config = SHEET_CONFIGS[key];
      const idColumn = idColumns[key] ?? [];
      const rowById = this.rowIndexById(idColumn);
      const lastColumn = String.fromCharCode(64 + config.columns.length);
      // Every tab has fewer than 26 columns, so a single letter always addresses
      // the last one.
      const blank = config.columns.map(() => '');
      // The id column read stops at the last non-blank row, so its length is the
      // append point; each new record takes the next row after it.
      let nextRow = idColumn.length + 2;

      for (const change of Object.values(pending[key] ?? {})) {
        const id = this.parseString(change.id).trim();
        if (!id) continue;
        const existing = rowById.get(id);

        if (change.type === 'delete') {
          // A record never written (e.g. created then deleted locally) has no
          // row to blank; dropping it from the Pending Changes is enough.
          if (existing === undefined) continue;
          data.push({ range: `${config.name}!A${existing}:${lastColumn}${existing}`, values: [blank] });
          continue;
        }

        const row = existing ?? nextRow++;
        rowById.set(id, row);
        data.push({ range: `${config.name}!A${row}:${lastColumn}${row}`, values: [this.toRow(key, change.record)] });
      }
    }

    if (data.length === 0) return;

    // RAW keeps values exactly as sent. Planyoo keys rows by a `YYYY-MM` month
    // string, so Sheets must not coerce `2026-06` into a date and read it back
    // as a serial number.
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
    await this.apiRequest(url, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'RAW', data }),
    });
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

  async readBanks(spreadsheetId: string): Promise<Bank[]> {
    return this.parseBanksRows(await this.readRows(spreadsheetId, 'banks', 'A2:B'));
  }

  async readPayers(spreadsheetId: string): Promise<Payer[]> {
    return this.parsePayersRows(await this.readRows(spreadsheetId, 'payers', 'A2:B'));
  }

  async readPlanItems(spreadsheetId: string): Promise<PlanItem[]> {
    return this.parsePlanRows(await this.readRows(spreadsheetId, 'plan', 'A2:E'));
  }

  async readCardSpending(spreadsheetId: string): Promise<CardSpending[]> {
    return this.parseCardSpendingRows(await this.readRows(spreadsheetId, 'card_spending', 'A2:D'));
  }

  async readBills(spreadsheetId: string): Promise<Bill[]> {
    return this.parseBillsRows(await this.readRows(spreadsheetId, 'bills', 'A2:H'));
  }

  async readIncome(spreadsheetId: string): Promise<IncomeEntry[]> {
    return this.parseIncomeRows(await this.readRows(spreadsheetId, 'income', 'A2:D'));
  }

  /** Extract the spreadsheet ID from a pasted Google Sheets URL. */
  static extractSpreadsheetId(url: string): string | null {
    const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }
}

export const googleSheetsService = GoogleSheetsService.getInstance();
