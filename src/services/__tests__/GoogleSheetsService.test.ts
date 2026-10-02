import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleSheetsService } from '../GoogleSheetsService';
import type { Outflow } from '../../types';

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

/**
 * Planyoo's tab schema and string months are specific to this app (Stayoo stores
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
          values: [['p1', '2026-06', 'Mercado/Farmácia', 500, 250]],
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
        name: 'Mercado/Farmácia',
        amount: 500,
        remainingEstimate: 250,
      },
    ]);
  });

  it('writes plan months raw so Sheets does not coerce them into dates', async () => {
    // Given a plan item for June 2026 and an empty plan id column
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      String(url).includes('values:batchGet')
        ? Promise.resolve(jsonResponse({ valueRanges: [{ values: [] }] }))
        : Promise.resolve(jsonResponse({}))
    );
    vi.stubGlobal('fetch', fetchMock);

    // When it is saved as a new record
    await service.writePendingChanges('sheet-1', {
      plan: {
        p1: {
          type: 'create',
          id: 'p1',
          record: { id: 'p1', month: '2026-06', name: 'Netflix', amount: 42, remainingEstimate: 0 },
        },
      },
    });

    // Then the write asks Sheets to store values verbatim
    const update = fetchMock.mock.calls.find(
      ([url, options]) =>
        String(url).includes('values:batchUpdate') && (options as RequestInit)?.method === 'POST'
    );
    const body = JSON.parse(String((update?.[1] as RequestInit).body));
    expect(body.valueInputOption).toBe('RAW');
    expect(body.valueInputOption).not.toBe('USER_ENTERED');
  });

  it('parses the outflows paid flag from text or boolean cells', async () => {
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

    // When the outflows tab is read
    const outflows = await service.readOutflows('sheet-1');

    // Then both are understood as a paid status
    expect(outflows.map((outflow) => outflow.isPaid)).toEqual([true, false]);
  });

  it('reads a outflow row with its payer, bank and final-value references', async () => {
    // Given the sheet stores the new columns
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          values: [
            ['b1', '2026-06', 'Luz', 120, 'TRUE', 'payer-marcelo', 'bank-nubank', 'TRUE'],
          ],
        })
      )
    );

    // When the outflows tab is read
    const outflows = await service.readOutflows('sheet-1');

    // Then the references and the final-value flag survive the round trip
    expect(outflows).toEqual([
      {
        id: 'b1',
        month: '2026-06',
        name: 'Luz',
        amount: 120,
        isPaid: true,
        isFinal: true,
        payerId: 'payer-marcelo',
        bankId: 'bank-nubank',
      },
    ]);
  });

  it('reads a legacy five-column outflow row as unset references and not final', async () => {
    // Given a row written before the payer/bank/final columns existed
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ values: [['b1', '2026-06', 'Luz', 120, 'FALSE']] })
      )
    );

    // When the outflows tab is read
    const outflows = await service.readOutflows('sheet-1');

    // Then the missing cells default to unset rather than corrupting the row,
    // and the absent final-value flag reads as not final
    expect(outflows[0]).toMatchObject({
      name: 'Luz',
      isFinal: false,
      payerId: '',
      bankId: '',
    });
  });

  it('writes outflows with their payer, bank and final-value flag', async () => {
    // Given a final outflow assigned to a payer and bank, and an empty id column
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      String(url).includes('values:batchGet')
        ? Promise.resolve(jsonResponse({ valueRanges: [{ values: [] }] }))
        : Promise.resolve(jsonResponse({}))
    );
    vi.stubGlobal('fetch', fetchMock);

    // When it is saved as a new record
    await service.writePendingChanges('sheet-1', {
      outflows: {
        b1: {
          type: 'create',
          id: 'b1',
          record: {
            id: 'b1',
            month: '2026-06',
            name: 'Luz',
            amount: 120,
            isPaid: false,
            isFinal: true,
            payerId: 'payer-marcelo',
            bankId: 'bank-nubank',
          },
        },
      },
    });

    // Then the row carries all eight columns, in order
    const update = fetchMock.mock.calls.find(
      ([url, options]) =>
        String(url).includes('values:batchUpdate') && (options as RequestInit)?.method === 'POST'
    );
    const body = JSON.parse(String((update?.[1] as RequestInit).body));
    expect(body.data).toEqual([
      {
        range: 'outflows!A2:H2',
        values: [['b1', '2026-06', 'Luz', 120, 'FALSE', 'payer-marcelo', 'bank-nubank', 'TRUE']],
      },
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

  it('round-trips the savings pot registry', async () => {
    // Given the savings_pots tab holds two pots
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          values: [
            ['pot-1', 'Emergência'],
            ['pot-2', 'Aposentadoria'],
          ],
        })
      )
    );

    // When it is read
    const pots = await service.readSavingsPots('sheet-1');

    // Then the ids and names survive
    expect(pots).toEqual([
      { id: 'pot-1', name: 'Emergência' },
      { id: 'pot-2', name: 'Aposentadoria' },
    ]);
  });

  it('reads a savings balance row with its month, pot reference and numeric balance', async () => {
    // Given the savings_balances tab stores a balance against a real pot
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ values: [['sb1', '2026-06', 'pot-1', 10000]] })
      )
    );

    // When it is read
    const balances = await service.readSavingsBalances('sheet-1');

    // Then the month survives as a string and the balance as a number
    expect(balances).toEqual([
      { id: 'sb1', month: '2026-06', potId: 'pot-1', balance: 10000 },
    ]);
  });

  it('reads an explicit zero balance as a recorded zero', async () => {
    // Given a balance row recorded as 0
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ values: [['sb1', '2026-06', 'pot-1', 0]] }))
    );

    // When it is read
    const balances = await service.readSavingsBalances('sheet-1');

    // Then the zero is preserved, not mistaken for a missing record
    expect(balances[0].balance).toBe(0);
  });

  it('writes savings pots and balances in contract order', async () => {
    // Given a pot and one of its month's balances, with empty id columns
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      String(url).includes('values:batchGet')
        ? Promise.resolve(jsonResponse({ valueRanges: [{ values: [] }] }))
        : Promise.resolve(jsonResponse({}))
    );
    vi.stubGlobal('fetch', fetchMock);

    // When both are saved in one push
    await service.writePendingChanges('sheet-1', {
      savings_pots: {
        'pot-1': { type: 'create', id: 'pot-1', record: { id: 'pot-1', name: 'Emergência' } },
      },
      savings_balances: {
        sb1: {
          type: 'create',
          id: 'sb1',
          record: { id: 'sb1', month: '2026-06', potId: 'pot-1', balance: 10000 },
        },
      },
    });

    // Then each row carries its tab's columns, in order
    const update = fetchMock.mock.calls.find(
      ([url, options]) =>
        String(url).includes('values:batchUpdate') && (options as RequestInit)?.method === 'POST'
    );
    const body = JSON.parse(String((update?.[1] as RequestInit).body));
    expect(body.data).toEqual([
      { range: 'savings_pots!A2:B2', values: [['pot-1', 'Emergência']] },
      { range: 'savings_balances!A2:D2', values: [['sb1', '2026-06', 'pot-1', 10000]] },
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
      outflows: ['id', 'month', 'name', 'amount', 'is_paid'],
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

  it('creates the banks and payers tabs and backfills the outflows header', async () => {
    // Given a sheet that has the original five tabs, outflows still on five columns
    const service = GoogleSheetsService.getInstance();
    service.setAccessToken('test-token');
    const fetchMock = legacySheetFetch();
    vi.stubGlobal('fetch', fetchMock);

    // When the sheet is initialized
    await service.initializeSheets('sheet-1');

    const calls = fetchMock.mock.calls;

    // Then the two new tabs are created
    const created = calls
      .filter(
        ([url, options]) =>
          (options as RequestInit)?.method === 'POST' && String(url).includes(':batchUpdate')
      )
      .map(([, options]) =>
        JSON.parse(String((options as RequestInit).body)).requests[0].addSheet.properties.title
      );
    expect(created).toEqual(['banks', 'payers', 'savings_pots', 'savings_balances']);

    // And only the drifted outflows header is rewritten, gaining the new columns
    const headerWrites = calls
      .filter(
        ([url, options]) =>
          (options as RequestInit)?.method === 'PUT' && String(url).includes('outflows!')
      )
      .map(([, options]) =>
        JSON.parse(String((options as RequestInit).body)).values[0]
      );
    expect(headerWrites).toEqual([
      ['id', 'month', 'name', 'amount', 'is_paid', 'payer_id', 'bank_id', 'is_final'],
    ]);

    // While a tab whose header already matches is left alone
    const cardsHeaderWritten = calls.some(
      ([url, options]) =>
        (options as RequestInit)?.method === 'PUT' && String(url).includes('cards!')
    );
    expect(cardsHeaderWritten).toBe(false);
  });

  it('drops the retired kind column from the plan tab, rewriting its rows in order', async () => {
    // Given a plan tab created before fixed charges were removed: six columns
    // with `kind` in the third position and real data rows behind it
    const headers: Record<string, string[]> = {
      cards: ['id', 'name'],
      banks: ['id', 'name'],
      payers: ['id', 'name'],
      plan: ['id', 'month', 'kind', 'name', 'amount', 'remaining_estimate'],
      card_spending: ['id', 'month', 'card_id', 'total'],
      outflows: ['id', 'month', 'name', 'amount', 'is_paid', 'payer_id', 'bank_id'],
      income: ['id', 'month', 'amount', 'source'],
    };
    const planRows = [
      ['id', 'month', 'kind', 'name', 'amount', 'remaining_estimate'],
      ['p1', '2026-06', 'variable', 'Mercado/Farmácia', 500, 250],
      ['p2', '2026-06', 'fixed', 'Netflix', 42, 0],
    ];
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
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
      if (target.includes('!A1:Z1')) {
        const name = decodeURIComponent(target.match(/\/values\/([^!]+)!/)?.[1] ?? '');
        return Promise.resolve(jsonResponse({ values: [headers[name] ?? []] }));
      }
      if (target.includes('!A1:Z?')) {
        return Promise.resolve(jsonResponse({ values: planRows }));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = GoogleSheetsService.getInstance();
    service.setAccessToken('test-token');

    // When the sheet is initialized
    await service.initializeSheets('sheet-1');

    // Then each data row is rewritten without the kind cell, so name/amount/
    // estimate stay in their new positions instead of shifting left
    const rowPut = fetchMock.mock.calls.find(
      ([url, options]) =>
        String(url).includes('/values/plan!A2') &&
        (options as RequestInit)?.method === 'PUT'
    );
    const body = JSON.parse(String((rowPut?.[1] as RequestInit).body));
    expect(body.values).toEqual([
      ['p1', '2026-06', 'Mercado/Farmácia', 500, 250],
      ['p2', '2026-06', 'Netflix', 42, 0],
    ]);

    // And the header is rewritten to the new five-column contract
    const headerWrites = fetchMock.mock.calls
      .filter(
        ([url, options]) =>
          (options as RequestInit)?.method === 'PUT' && String(url).includes('/values/plan!A1')
      )
      .map(([, options]) => JSON.parse(String((options as RequestInit).body)).values[0]);
    expect(headerWrites).toContainEqual(['id', 'month', 'name', 'amount', 'remaining_estimate']);
  });

  it('repairs a plan tab whose header was re-headed but whose rows are still legacy', async () => {
    // Given an interrupted upgrade: the header already says the new contract
    // (with a stale trailing cell left over from the old six-column header)
    // while the data rows still carry the retired kind column
    const headers: Record<string, string[]> = {
      cards: ['id', 'name'],
      banks: ['id', 'name'],
      payers: ['id', 'name'],
      plan: ['id', 'month', 'name', 'amount', 'remaining_estimate', 'remaining_estimate'],
      card_spending: ['id', 'month', 'card_id', 'total'],
      outflows: ['id', 'month', 'name', 'amount', 'is_paid', 'payer_id', 'bank_id'],
      income: ['id', 'month', 'amount', 'source'],
    };
    const planRows = [
      ['id', 'month', 'name', 'amount', 'remaining_estimate', 'remaining_estimate'],
      ['p1', '2026-06', 'variable', 'Mercado/Farmácia', 500, 250],
      ['p2', '2026-06', 'fixed', 'Netflix', 42, 0],
    ];
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
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
      if (target.includes('!A1:Z1')) {
        const name = decodeURIComponent(target.match(/\/values\/([^!]+)!/)?.[1] ?? '');
        return Promise.resolve(jsonResponse({ values: [headers[name] ?? []] }));
      }
      if (target.includes('!A1:Z?')) {
        return Promise.resolve(jsonResponse({ values: planRows }));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = GoogleSheetsService.getInstance();
    service.setAccessToken('test-token');

    // When the sheet is initialized
    await service.initializeSheets('sheet-1');

    // Then the legacy kind cell is dropped from every data row
    const rowPut = fetchMock.mock.calls.find(
      ([url, options]) =>
        String(url).includes('/values/plan!A2') &&
        (options as RequestInit)?.method === 'PUT'
    );
    const body = JSON.parse(String((rowPut?.[1] as RequestInit).body));
    expect(body.values).toEqual([
      ['p1', '2026-06', 'Mercado/Farmácia', 500, 250],
      ['p2', '2026-06', 'Netflix', 42, 0],
    ]);

    // And the stale trailing header cell is cleared, so the tab stops
    // reporting a mismatch on every load
    const headerCellCleared = fetchMock.mock.calls.some(
      ([url, options]) =>
        (options as RequestInit)?.method === 'POST' &&
        String(url).includes('plan!F1') &&
        String(url).includes(':clear')
    );
    expect(headerCellCleared).toBe(true);
  });
});

/**
 * The pull cycle's read path (ADR-0007): headers and every tab's data in one
 * `values:batchGet`, with the schema fixes (missing tab, drifted header, legacy
 * plan) applied only when the read shows they are needed.
 */
describe('pullAll', () => {
  let service: GoogleSheetsService;

  const HEADERS: Record<string, unknown[]> = {
    cards: ['id', 'name'],
    banks: ['id', 'name'],
    payers: ['id', 'name'],
    plan: ['id', 'month', 'name', 'amount', 'remaining_estimate'],
    card_spending: ['id', 'month', 'card_id', 'total'],
    outflows: ['id', 'month', 'name', 'amount', 'is_paid', 'payer_id', 'bank_id', 'is_final'],
    income: ['id', 'month', 'amount', 'source'],
    savings_pots: ['id', 'name'],
    savings_balances: ['id', 'month', 'pot_id', 'balance'],
  };

  function tabRows(): Record<string, unknown[][]> {
    return {
      cards: [HEADERS.cards, ['c1', 'cc guta']],
      banks: [HEADERS.banks, ['bank-1', 'Nubank']],
      payers: [HEADERS.payers, ['payer-1', 'Marcelo']],
      plan: [HEADERS.plan, ['pl1', '2026-06', 'Mercado', 500, 250]],
      card_spending: [HEADERS.card_spending, ['cs1', '2026-06', 'c1', 100]],
      outflows: [
        HEADERS.outflows,
        ['b1', '2026-06', 'Luz', 120, 'FALSE', 'payer-1', 'bank-1', 'TRUE'],
      ],
      income: [HEADERS.income, ['i1', '2026-06', 3000, 'Salário']],
      savings_pots: [HEADERS.savings_pots, ['pot-1', 'Emergência']],
      savings_balances: [HEADERS.savings_balances, ['sb1', '2026-06', 'pot-1', 10000]],
    };
  }

  /** Serve a batchGet by slicing the ranges out of the request URL. */
  function batchResponse(rows: Record<string, unknown[][]>) {
    return (target: string) => {
      const ranges = [...target.matchAll(/ranges=([^&]+)/g)].map((match) => match[1]);
      return jsonResponse({
        valueRanges: ranges.map((range) => ({ values: rows[range.split('!')[0]] ?? [] })),
      });
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    service = GoogleSheetsService.getInstance();
    service.setAccessToken('test-token');
  });

  it('reads every tab, headers and data, in a single request', async () => {
    // Given a fully set-up sheet
    const rows = tabRows();
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(batchResponse(rows)(decodeURIComponent(String(url))))
    );
    vi.stubGlobal('fetch', fetchMock);

    // When the app pulls
    const data = await service.pullAll('sheet-1');

    // Then exactly one Sheets request was made, and it was the batched read
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('values:batchGet');
    expect(String(fetchMock.mock.calls[0][0])).not.toMatch(/\/spreadsheets\/sheet-1$/);

    // And every tab decoded, months intact
    expect(data.cards).toEqual([{ id: 'c1', name: 'cc guta' }]);
    expect(data.banks).toEqual([{ id: 'bank-1', name: 'Nubank' }]);
    expect(data.payers).toEqual([{ id: 'payer-1', name: 'Marcelo' }]);
    expect(data.planItems).toEqual([
      { id: 'pl1', month: '2026-06', name: 'Mercado', amount: 500, remainingEstimate: 250 },
    ]);
    expect(data.cardSpending).toEqual([
      { id: 'cs1', month: '2026-06', cardId: 'c1', total: 100 },
    ]);
    expect(data.outflows).toEqual([
      {
        id: 'b1',
        month: '2026-06',
        name: 'Luz',
        amount: 120,
        isPaid: false,
        isFinal: true,
        payerId: 'payer-1',
        bankId: 'bank-1',
      },
    ]);
    expect(data.income).toEqual([{ id: 'i1', month: '2026-06', amount: 3000, source: 'Salário' }]);
    expect(data.savingsPots).toEqual([{ id: 'pot-1', name: 'Emergência' }]);
    expect(data.savingsBalances).toEqual([
      { id: 'sb1', month: '2026-06', potId: 'pot-1', balance: 10000 },
    ]);
  });

  it('creates a missing tab and retries the same single read', async () => {
    // Given a sheet missing the banks tab, so the first batchGet rejects
    const rows = tabRows();
    let batchCalls = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const target = decodeURIComponent(String(url));
      if (target.includes('values:batchGet')) {
        batchCalls += 1;
        if (batchCalls === 1) {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: async () => ({ error: { message: 'Unable to parse range: banks!A1:Z' } }),
          });
        }
        return Promise.resolve(batchResponse(rows)(target));
      }
      if (/\/spreadsheets\/sheet-1$/.test(target)) {
        return Promise.resolve(
          jsonResponse({
            sheets: ['cards', 'payers', 'plan', 'card_spending', 'outflows', 'income', 'savings_pots', 'savings_balances'].map((title) => ({
              properties: { title },
            })),
          })
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    // When the app pulls
    const data = await service.pullAll('sheet-1');

    // Then the metadata call happened only after the failed read, the tab was
    // created with its header, and the read was retried
    const metadataCalled = fetchMock.mock.calls.some(([url]) =>
      /\/spreadsheets\/sheet-1$/.test(String(url))
    );
    expect(metadataCalled).toBe(true);
    const created = fetchMock.mock.calls
      .filter(([, options]) => (options as RequestInit)?.method === 'POST' && String((options as RequestInit).body).includes('addSheet'))
      .map(([, options]) => JSON.parse(String((options as RequestInit).body)).requests[0].addSheet.properties.title);
    expect(created).toEqual(['banks']);
    expect(batchCalls).toBe(2);

    // And the retried read decoded every tab
    expect(data.banks).toEqual([{ id: 'bank-1', name: 'Nubank' }]);
  });

  it('creates both missing savings tabs with their headers on pull', async () => {
    // Given a sheet from before savings existed, missing both savings tabs
    const rows = tabRows();
    let batchCalls = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const target = decodeURIComponent(String(url));
      if (target.includes('values:batchGet')) {
        batchCalls += 1;
        if (batchCalls === 1) {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: async () => ({ error: { message: 'Unable to parse range: savings_pots!A1:Z' } }),
          });
        }
        return Promise.resolve(batchResponse(rows)(target));
      }
      if (/\/spreadsheets\/sheet-1$/.test(target)) {
        return Promise.resolve(
          jsonResponse({
            sheets: ['cards', 'banks', 'payers', 'plan', 'card_spending', 'outflows', 'income'].map(
              (title) => ({ properties: { title } })
            ),
          })
        );
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    // When the app pulls
    const data = await service.pullAll('sheet-1');

    // Then both savings tabs are created, each with its header row
    const created = fetchMock.mock.calls
      .filter(
        ([, options]) =>
          (options as RequestInit)?.method === 'POST' &&
          String((options as RequestInit).body).includes('addSheet')
      )
      .map(
        ([, options]) =>
          JSON.parse(String((options as RequestInit).body)).requests[0].addSheet.properties.title
      );
    expect(created).toEqual(['savings_pots', 'savings_balances']);
    const headerWrites = fetchMock.mock.calls
      .filter(
        ([url, options]) =>
          (options as RequestInit)?.method === 'PUT' && String(url).includes('/values/savings_')
      )
      .map(([, options]) => JSON.parse(String((options as RequestInit).body)).values[0]);
    expect(headerWrites).toContainEqual(['id', 'name']);
    expect(headerWrites).toContainEqual(['id', 'month', 'pot_id', 'balance']);

    // And the retried read decoded them
    expect(data.savingsPots).toEqual([{ id: 'pot-1', name: 'Emergência' }]);
    expect(data.savingsBalances).toEqual([
      { id: 'sb1', month: '2026-06', potId: 'pot-1', balance: 10000 },
    ]);
  });

  it('re-heads a drifted header without touching its data rows', async () => {
    // Given outflows on the legacy five columns
    const rows = tabRows();
    rows.outflows = [
      ['id', 'month', 'name', 'amount', 'is_paid'],
      ['b1', '2026-06', 'Luz', 120, 'FALSE'],
    ];
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(batchResponse(rows)(decodeURIComponent(String(url))))
    );
    vi.stubGlobal('fetch', fetchMock);

    // When the app pulls
    const data = await service.pullAll('sheet-1');

    // Then the header is rewritten to the contract...
    const headerPut = fetchMock.mock.calls.find(
      ([url, options]) =>
        String(url).includes('/values/outflows!A1') && (options as RequestInit)?.method === 'PUT'
    );
    expect(headerPut).toBeDefined();
    expect(JSON.parse(String((headerPut?.[1] as RequestInit).body)).values[0]).toEqual(HEADERS.outflows);

    // ...its data rows are left alone, and the row still decodes (unset + not final)
    const dataPut = fetchMock.mock.calls.some(
      ([url, options]) =>
        String(url).includes('/values/outflows!A2') && (options as RequestInit)?.method === 'PUT'
    );
    expect(dataPut).toBe(false);
    expect(data.outflows).toEqual([
      {
        id: 'b1',
        month: '2026-06',
        name: 'Luz',
        amount: 120,
        isPaid: false,
        isFinal: false,
        payerId: '',
        bankId: '',
      },
    ]);
  });

  it('migrates the legacy plan tab on the pull path', async () => {
    // Given a plan tab with the retired kind column and real data behind it
    const rows = tabRows();
    rows.plan = [
      ['id', 'month', 'kind', 'name', 'amount', 'remaining_estimate'],
      ['p1', '2026-06', 'variable', 'Mercado', 500, 250],
    ];
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(batchResponse(rows)(decodeURIComponent(String(url))))
    );
    vi.stubGlobal('fetch', fetchMock);

    // When the app pulls
    const data = await service.pullAll('sheet-1');

    // Then the rows are rewritten without kind and decode in the new order
    const rowPut = fetchMock.mock.calls.find(
      ([url, options]) =>
        String(url).includes('/values/plan!A2') && (options as RequestInit)?.method === 'PUT'
    );
    expect(JSON.parse(String((rowPut?.[1] as RequestInit).body)).values).toEqual([
      ['p1', '2026-06', 'Mercado', 500, 250],
    ]);
    expect(data.planItems).toEqual([
      { id: 'p1', month: '2026-06', name: 'Mercado', amount: 500, remainingEstimate: 250 },
    ]);
  });

  it('clears a stale trailing header cell in the same pull that migrates the plan', async () => {
    // Given a half-upgraded plan header: the new five columns plus a leftover
    // sixth cell, with rows still carrying the retired kind column
    const rows = tabRows();
    rows.plan = [
      ['id', 'month', 'name', 'amount', 'remaining_estimate', 'remaining_estimate'],
      ['p1', '2026-06', 'variable', 'Mercado', 500, 250],
    ];
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(batchResponse(rows)(decodeURIComponent(String(url))))
    );
    vi.stubGlobal('fetch', fetchMock);

    // When the app pulls
    const data = await service.pullAll('sheet-1');

    // Then the stale trailing header cell is cleared in the same pull
    const headerCellCleared = fetchMock.mock.calls.some(
      ([url, options]) =>
        (options as RequestInit)?.method === 'POST' &&
        String(url).includes('plan!F1') &&
        String(url).includes(':clear')
    );
    expect(headerCellCleared).toBe(true);
    expect(data.planItems).toEqual([
      { id: 'p1', month: '2026-06', name: 'Mercado', amount: 500, remainingEstimate: 250 },
    ]);
  });

  it('skips the header checks when the caller trusts the cached schema', async () => {
    // Given a sheet whose outflows header drifted to the legacy five columns
    const rows = tabRows();
    rows.outflows = [
      ['id', 'month', 'name', 'amount', 'is_paid'],
      ['b1', '2026-06', 'Luz', 120, 'FALSE'],
    ];
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(batchResponse(rows)(decodeURIComponent(String(url))))
    );
    vi.stubGlobal('fetch', fetchMock);

    // When the pull is told the cached schema is known-good
    const data = await service.pullAll('sheet-1', { verifySchema: false });

    // Then only the single batched read happened, with no header write
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('values:batchGet');

    // And the drifted row still decodes against the contract's defaults
    expect(data.outflows).toEqual([
      {
        id: 'b1',
        month: '2026-06',
        name: 'Luz',
        amount: 120,
        isPaid: false,
        isFinal: false,
        payerId: '',
        bankId: '',
      },
    ]);
  });

  it('rethrows a non-missing read failure without a metadata call', async () => {
    // Given the batched read fails for a reason other than a missing tab
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Internal error' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    // When the app pulls
    await expect(service.pullAll('sheet-1')).rejects.toThrow('Internal error');

    // Then the sheet-metadata call was never made and the read was not retried
    const metadataCalled = fetchMock.mock.calls.some(([url]) =>
      /\/spreadsheets\/sheet-1$/.test(String(url))
    );
    expect(metadataCalled).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

/**
 * The write side of the sync cycle (ADR-0008): a save re-reads the affected
 * tabs' id column, resolves each Pending Change to a row, and writes only those
 * rows — never the whole tab — so a save from a stale Working Copy cannot drop
 * another member's edits.
 */
describe('writePendingChanges', () => {
  let service: GoogleSheetsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = GoogleSheetsService.getInstance();
    service.setAccessToken('test-token');
  });

  /** Serve the id-column batchGet from `columns`, keyed by tab name. */
  function idColumns(columns: Record<string, unknown[][]>) {
    return (target: string) => {
      const ranges = [...target.matchAll(/ranges=([^&]+)/g)].map((match) =>
        decodeURIComponent(match[1])
      );
      return jsonResponse({
        valueRanges: ranges.map((range) => ({ values: columns[range.split('!')[0]] ?? [] })),
      });
    };
  }

  function mockFetch(columns: Record<string, unknown[][]>) {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const target = decodeURIComponent(String(url));
      if (target.includes('values:batchGet')) return Promise.resolve(idColumns(columns)(target));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  function batchUpdateBody(fetchMock: ReturnType<typeof vi.fn>) {
    const call = fetchMock.mock.calls.find(
      ([url, options]) =>
        String(url).includes('values:batchUpdate') && (options as RequestInit)?.method === 'POST'
    );
    return JSON.parse(String((call?.[1] as RequestInit).body));
  }

  const luz = (overrides: Partial<Outflow> = {}): Outflow => ({
    id: 'b1',
    month: '2026-06',
    name: 'Luz',
    amount: 120,
    isPaid: false,
    isFinal: true,
    payerId: 'payer-marcelo',
    bankId: 'bank-nubank',
    ...overrides,
  });

  it('re-reads the id column then writes only the changed row in one update', async () => {
    // Given the outflows tab has three rows and only the second is edited
    const fetchMock = mockFetch({ outflows: [['b1'], ['b2'], ['b3']] });

    // When the save fires
    await service.writePendingChanges('sheet-1', {
      outflows: { b2: { type: 'update', id: 'b2', record: luz({ id: 'b2', amount: 175 }) } },
    });

    // Then exactly one id-column read and one update request were made
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('values:batchGet');
    expect(String(fetchMock.mock.calls[0][0])).toContain(encodeURIComponent('outflows!A2:A'));

    // And only b2's row (row 3) was written, in contract order
    expect(batchUpdateBody(fetchMock).data).toEqual([
      {
        range: 'outflows!A3:H3',
        values: [['b2', '2026-06', 'Luz', 175, 'FALSE', 'payer-marcelo', 'bank-nubank', 'TRUE']],
      },
    ]);
  });

  it('appends a new record at the end of the tab', async () => {
    // Given a outflows tab with three data rows
    const fetchMock = mockFetch({ outflows: [['b1'], ['b2'], ['b3']] });

    // When a new outflow is created
    await service.writePendingChanges('sheet-1', {
      outflows: { b4: { type: 'create', id: 'b4', record: luz({ id: 'b4', name: 'Água' }) } },
    });

    // Then it is written to the first row after the last one
    expect(batchUpdateBody(fetchMock).data[0].range).toBe('outflows!A5:H5');
  });

  it('overwrites the existing row when a create collides with a sheet id', async () => {
    // Given the id already exists in the sheet
    const fetchMock = mockFetch({ outflows: [['b1'], ['b2']] });

    // When a create arrives for that id (local wins)
    await service.writePendingChanges('sheet-1', {
      outflows: { b2: { type: 'create', id: 'b2', record: luz({ id: 'b2', amount: 999 }) } },
    });

    // Then it updates the existing row rather than appending a duplicate
    expect(batchUpdateBody(fetchMock).data).toEqual([
      {
        range: 'outflows!A3:H3',
        values: [['b2', '2026-06', 'Luz', 999, 'FALSE', 'payer-marcelo', 'bank-nubank', 'TRUE']],
      },
    ]);
  });

  it('blanks a deleted record in place so no other row shifts', async () => {
    // Given the outflows tab has three rows and the middle one is deleted
    const fetchMock = mockFetch({ outflows: [['b1'], ['b2'], ['b3']] });

    // When the delete is saved
    await service.writePendingChanges('sheet-1', {
      outflows: { b2: { type: 'delete', id: 'b2' } },
    });

    // Then its row is cleared in place
    expect(batchUpdateBody(fetchMock).data).toEqual([
      { range: 'outflows!A3:H3', values: [['', '', '', '', '', '', '', '']] },
    ]);
  });

  it('skips a delete for an id the sheet never had, with no update request', async () => {
    // Given a locally created record that was deleted before it was ever written
    const fetchMock = mockFetch({ outflows: [['b1']] });

    // When the delete is saved
    await service.writePendingChanges('sheet-1', {
      outflows: { gone: { type: 'delete', id: 'gone' } },
    });

    // Then the id column is read but nothing is written
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('values:batchGet');
  });

  it('batches every affected tab into one id read and one update', async () => {
    // Given edits in two tabs
    const fetchMock = mockFetch({ outflows: [['b1']], cards: [['c1']] });

    // When they are saved together
    await service.writePendingChanges('sheet-1', {
      outflows: { b1: { type: 'update', id: 'b1', record: luz({ amount: 200 }) } },
      cards: { c1: { type: 'update', id: 'c1', record: { id: 'c1', name: 'cc guta' } } },
    });

    // Then both tabs are read in one request and written in one request
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const read = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(read).toContain('values:batchGet');
    expect(read).toContain('outflows!A2:A');
    expect(read).toContain('cards!A2:A');
    expect(batchUpdateBody(fetchMock).data.map((entry: { range: string }) => entry.range)).toEqual([
      'cards!A2:B2',
      'outflows!A2:H2',
    ]);
  });

  it('makes no request at all with no Pending Changes', async () => {
    // Given nothing is pending
    const fetchMock = mockFetch({});

    // When a save fires
    await service.writePendingChanges('sheet-1', {});

    // Then the sheet is not touched
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps blank rows invisible to a read', async () => {
    // Given a tab with a blank hole left by a delete
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          values: [
            ['b1', '2026-06', 'Luz', 120, 'FALSE', '', '', 'TRUE'],
            ['', '', '', '', '', '', '', ''],
            ['b3', '2026-06', 'Água', 80, 'FALSE', '', '', 'FALSE'],
          ],
        })
      )
    );

    // When the tab is read
    const outflows = await service.readOutflows('sheet-1');

    // Then the blank row is skipped and the others survive
    expect(outflows.map((outflow) => outflow.id)).toEqual(['b1', 'b3']);
  });
});
