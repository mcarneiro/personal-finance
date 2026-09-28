import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleSheetsService } from '../GoogleSheetsService';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

/**
 * Planoo's tab schema and string months are specific to this app (Stayoo stores
 * dates), so the round-trip between the sheet and the app is guarded here.
 */
describe('GoogleSheetsService schema round-trip', () => {
  let service: GoogleSheetsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = GoogleSheetsService.getInstance();
    service.setAccessToken('test-token');
  });

  it('reads a plan row back as a YYYY-MM month string', async () => {
    // Given the sheet stores month as a plain string (as RAW writes it)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          values: [['p1', '2026-06', 'variable', 'Mercado/Farmácia', 500, 250]],
        })
      )
    );

    // When the plan tab is read
    const items = await service.readPlanItems('sheet-1');

    // Then the month survives as a string, not an Excel serial number
    expect(items).toEqual([
      {
        id: 'p1',
        month: '2026-06',
        kind: 'variable',
        name: 'Mercado/Farmácia',
        amount: 500,
        remainingEstimate: 250,
      },
    ]);
  });

  it('writes plan months raw so Sheets does not coerce them into dates', async () => {
    // Given a plan item for June 2026
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    // When it is written back
    await service.writePlanItems('sheet-1', [
      {
        id: 'p1',
        month: '2026-06',
        kind: 'fixed',
        name: 'Netflix',
        amount: 42,
        remainingEstimate: 0,
      },
    ]);

    // Then the write asks Sheets to store values verbatim
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => url.includes('valueInputOption=RAW'))).toBe(true);
    expect(urls.some((url) => url.includes('valueInputOption=USER_ENTERED'))).toBe(false);
  });

  it('parses the bills paid flag from text or boolean cells', async () => {
    // Given the sheet holds the flag as text and as a real boolean
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          values: [
            ['b1', '2026-06', 'Luz', 120, 'TRUE'],
            ['b2', '2026-06', 'Água', 80, false],
          ],
        })
      )
    );

    // When the bills tab is read
    const bills = await service.readBills('sheet-1');

    // Then both are understood as a paid status
    expect(bills.map((bill) => bill.isPaid)).toEqual([true, false]);
  });

  it('reads a bill row with its payer and bank references', async () => {
    // Given the sheet stores the new columns
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          values: [['b1', '2026-06', 'Luz', 120, 'TRUE', 'payer-marcelo', 'bank-nubank']],
        })
      )
    );

    // When the bills tab is read
    const bills = await service.readBills('sheet-1');

    // Then the references survive the round trip
    expect(bills).toEqual([
      {
        id: 'b1',
        month: '2026-06',
        name: 'Luz',
        amount: 120,
        isPaid: true,
        payerId: 'payer-marcelo',
        bankId: 'bank-nubank',
      },
    ]);
  });

  it('reads a legacy five-column bill row as unset payer and bank', async () => {
    // Given a row written before the payer/bank columns existed
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ values: [['b1', '2026-06', 'Luz', 120, 'FALSE']] })
      )
    );

    // When the bills tab is read
    const bills = await service.readBills('sheet-1');

    // Then the missing cells default to unset rather than corrupting the row
    expect(bills[0]).toMatchObject({ name: 'Luz', payerId: '', bankId: '' });
  });

  it('writes bills with their payer and bank references', async () => {
    // Given a bill assigned to a payer and bank
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    // When it is written back
    await service.writeBills('sheet-1', [
      {
        id: 'b1',
        month: '2026-06',
        name: 'Luz',
        amount: 120,
        isPaid: false,
        payerId: 'payer-marcelo',
        bankId: 'bank-nubank',
      },
    ]);

    // Then the row carries all seven columns, in order
    const put = fetchMock.mock.calls.find(
      ([url, options]) =>
        String(url).includes('/values/bills!A2') &&
        (options as RequestInit)?.method === 'PUT'
    );
    const body = JSON.parse(String((put?.[1] as RequestInit).body));
    expect(body.values).toEqual([
      ['b1', '2026-06', 'Luz', 120, 'FALSE', 'payer-marcelo', 'bank-nubank'],
    ]);
  });

  it('round-trips the banks registry', async () => {
    // Given the banks tab holds two banks
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          values: [
            ['b1', 'Nubank'],
            ['b2', 'Itaú'],
          ],
        })
      )
    );

    // When it is read
    const banks = await service.readBanks('sheet-1');

    // Then the ids and names survive
    expect(banks).toEqual([
      { id: 'b1', name: 'Nubank' },
      { id: 'b2', name: 'Itaú' },
    ]);
  });

  it('round-trips the payers registry', async () => {
    // Given the payers tab holds two payers
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          values: [
            ['p1', 'Marcelo'],
            ['p2', 'Guta'],
          ],
        })
      )
    );

    // When it is read
    const payers = await service.readPayers('sheet-1');

    // Then the ids and names survive
    expect(payers).toEqual([
      { id: 'p1', name: 'Marcelo' },
      { id: 'p2', name: 'Guta' },
    ]);
  });
});

describe('initializeSheets schema migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** A metadata + header-row fetch stub for a sheet created before banks/payers. */
  function legacySheetFetch() {
    const headers: Record<string, string[]> = {
      cards: ['id', 'name'],
      plan: ['id', 'month', 'kind', 'name', 'amount', 'remaining_estimate'],
      card_spending: ['id', 'month', 'card_id', 'total'],
      bills: ['id', 'month', 'name', 'amount', 'is_paid'],
      income: ['id', 'month', 'amount', 'source'],
    };

    return vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const target = String(url);
      if (target.includes(':batchUpdate')) return Promise.resolve(jsonResponse({}));
      if (options?.method === 'PUT') return Promise.resolve(jsonResponse({}));
      if (/\/spreadsheets\/sheet-1$/.test(target)) {
        return Promise.resolve(
          jsonResponse({
            sheets: Object.keys(headers).map((title) => ({ properties: { title } })),
          })
        );
      }
      const headerMatch = target.match(/\/values\/([^!]+)!A1:Z1/);
      if (headerMatch) {
        const name = decodeURIComponent(headerMatch[1]);
        return Promise.resolve(jsonResponse({ values: [headers[name] ?? []] }));
      }
      return Promise.resolve(jsonResponse({}));
    });
  }

  it('creates the banks and payers tabs and backfills the bills header', async () => {
    // Given a sheet that has the original five tabs, bills still on five columns
    const service = GoogleSheetsService.getInstance();
    service.setAccessToken('test-token');
    const fetchMock = legacySheetFetch();
    vi.stubGlobal('fetch', fetchMock);

    // When the sheet is initialized
    await service.initializeSheets('sheet-1');

    const calls = fetchMock.mock.calls;

    // Then the two new tabs are created
    const created = calls
      .filter(([, options]) => (options as RequestInit)?.method === 'POST')
      .map(([, options]) =>
        JSON.parse(String((options as RequestInit).body)).requests[0].addSheet.properties.title
      );
    expect(created).toEqual(['banks', 'payers']);

    // And only the drifted bills header is rewritten, gaining the new columns
    const headerWrites = calls
      .filter(
        ([url, options]) =>
          (options as RequestInit)?.method === 'PUT' && String(url).includes('bills!')
      )
      .map(([, options]) =>
        JSON.parse(String((options as RequestInit).body)).values[0]
      );
    expect(headerWrites).toEqual([
      ['id', 'month', 'name', 'amount', 'is_paid', 'payer_id', 'bank_id'],
    ]);

    // While a tab whose header already matches is left alone
    const cardsHeaderWritten = calls.some(
      ([url, options]) =>
        (options as RequestInit)?.method === 'PUT' && String(url).includes('cards!')
    );
    expect(cardsHeaderWritten).toBe(false);
  });
});
