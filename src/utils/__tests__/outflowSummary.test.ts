import { describe, expect, it } from 'vitest';
import type { Bank, Outflow, Month, Payer } from '../../types';
import { outflowsByPayerAndBank } from '../outflowSummary';

const MONTH: Month = '2026-06';
const OTHER_MONTH: Month = '2026-05';

const MARCELO: Payer = { id: 'payer-marcelo', name: 'Marcelo' };
const GUTA: Payer = { id: 'payer-guta', name: 'Guta' };
const PAYERS = [MARCELO, GUTA];

const ITAU: Bank = { id: 'bank-itau', name: 'Itaú' };
const NUBANK: Bank = { id: 'bank-nubank', name: 'Nubank' };
const BANKS = [ITAU, NUBANK];

function outflow(
  month: Month,
  name: string,
  amount: number,
  payerId: string,
  bankId: string,
  isPaid = false
): Outflow {
  return {
    id: `${month}-${name}`,
    month,
    name,
    amount,
    isPaid,
    isFinal: true,
    payerId,
    bankId,
  };
}

describe('outflowsByPayerAndBank', () => {
  it('groups the month outflows by payer and then by bank, with totals', () => {
    // Given June's outflows split across two payers and two banks
    const outflows = [
      outflow(MONTH, 'Luz', 150, MARCELO.id, NUBANK.id),
      outflow(MONTH, 'Internet', 110, MARCELO.id, NUBANK.id),
      outflow(MONTH, 'Cartão guta', 2899, GUTA.id, ITAU.id),
      outflow(MONTH, 'Gym', 200, GUTA.id, NUBANK.id),
    ];

    // When the summary is computed
    const summary = outflowsByPayerAndBank(MONTH, outflows, BANKS, PAYERS);

    // Then each payer carries its own total and its banks carry theirs
    expect(summary).toEqual([
      {
        payerId: 'payer-marcelo',
        payerName: 'Marcelo',
        total: 260,
        remaining: 260,
        banks: [{ bankId: 'bank-nubank', bankName: 'Nubank', total: 260, remaining: 260 }],
      },
      {
        payerId: 'payer-guta',
        payerName: 'Guta',
        total: 3099,
        remaining: 3099,
        banks: [
          { bankId: 'bank-itau', bankName: 'Itaú', total: 2899, remaining: 2899 },
          { bankId: 'bank-nubank', bankName: 'Nubank', total: 200, remaining: 200 },
        ],
      },
    ]);
  });

  it('merges several outflows for the same payer and bank', () => {
    // Given two June outflows paid by the same person from the same bank
    const outflows = [
      outflow(MONTH, 'Luz', 150, MARCELO.id, ITAU.id),
      outflow(MONTH, 'Água', 90, MARCELO.id, ITAU.id),
    ];

    // When the summary is computed
    const summary = outflowsByPayerAndBank(MONTH, outflows, BANKS, PAYERS);

    // Then they collapse into one bank line and one payer group
    expect(summary).toEqual([
      {
        payerId: 'payer-marcelo',
        payerName: 'Marcelo',
        total: 240,
        remaining: 240,
        banks: [{ bankId: 'bank-itau', bankName: 'Itaú', total: 240, remaining: 240 }],
      },
    ]);
  });

  it('reads in registry order, and unset or removed references sort last', () => {
    // Given a outflow in an unregistered bank, a outflow with no payer or bank, and
    // outflows for the registered entries, listed out of registry order
    const outflows = [
      outflow(MONTH, 'Sem cadastro', 40, GUTA.id, 'bank-removido'),
      outflow(MONTH, 'Sem nada', 25, '', ''),
      outflow(MONTH, 'Cartão guta', 2899, GUTA.id, ITAU.id),
      outflow(MONTH, 'Luz', 150, MARCELO.id, NUBANK.id),
    ];

    // When the summary is computed
    const summary = outflowsByPayerAndBank(MONTH, outflows, BANKS, PAYERS);

    // Then registered payers come in registry order (Marcelo, Guta); Guta's
    // removed bank resolves to an empty name and follows Itaú; the completely
    // unset outflow is its own last group
    expect(summary).toEqual([
      {
        payerId: 'payer-marcelo',
        payerName: 'Marcelo',
        total: 150,
        remaining: 150,
        banks: [{ bankId: 'bank-nubank', bankName: 'Nubank', total: 150, remaining: 150 }],
      },
      {
        payerId: 'payer-guta',
        payerName: 'Guta',
        total: 2939,
        remaining: 2939,
        banks: [
          { bankId: 'bank-itau', bankName: 'Itaú', total: 2899, remaining: 2899 },
          { bankId: 'bank-removido', bankName: '', total: 40, remaining: 40 },
        ],
      },
      {
        payerId: '',
        payerName: '',
        total: 25,
        remaining: 25,
        banks: [{ bankId: '', bankName: '', total: 25, remaining: 25 }],
      },
    ]);
  });

  it('ignores other months entirely', () => {
    // Given June has one outflow and May has another
    const outflows = [
      outflow(MONTH, 'Luz', 150, MARCELO.id, NUBANK.id),
      outflow(OTHER_MONTH, 'Água', 90, GUTA.id, ITAU.id),
    ];

    // When June's summary is computed
    const summary = outflowsByPayerAndBank(MONTH, outflows, BANKS, PAYERS);

    // Then only June's outflow is counted and May's payer never appears
    expect(summary).toHaveLength(1);
    expect(summary[0].total).toBe(150);
    expect(summary[0].payerName).toBe('Marcelo');
  });

  it('counts only unpaid outflows as remaining, keeping paid ones in the total', () => {
    // Given June has an open outflow and a paid one from the same payer and bank
    const outflows = [
      outflow(MONTH, 'Luz', 150, MARCELO.id, NUBANK.id),
      outflow(MONTH, 'Internet', 110, MARCELO.id, NUBANK.id, true),
    ];

    // When the summary is computed
    const summary = outflowsByPayerAndBank(MONTH, outflows, BANKS, PAYERS);

    // Then the total counts both, but only the open outflow is still to pay
    expect(summary).toEqual([
      {
        payerId: 'payer-marcelo',
        payerName: 'Marcelo',
        total: 260,
        remaining: 150,
        banks: [{ bankId: 'bank-nubank', bankName: 'Nubank', total: 260, remaining: 150 }],
      },
    ]);
  });

  it('is empty for a month with no outflows', () => {
    // Given every outflow is in another month
    const outflows = [outflow(OTHER_MONTH, 'Luz', 150, MARCELO.id, NUBANK.id)];

    // When the summary is computed
    // Then there is nothing to show
    expect(outflowsByPayerAndBank(MONTH, outflows, BANKS, PAYERS)).toEqual([]);
  });
});
