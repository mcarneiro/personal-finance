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
});
