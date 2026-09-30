import { describe, expect, it } from 'vitest';
import type { Bank, Bill, Month, Payer } from '../../types';
import { billsByPayerAndBank } from '../billSummary';

const MONTH: Month = '2026-06';
const OTHER_MONTH: Month = '2026-05';

const MARCELO: Payer = { id: 'payer-marcelo', name: 'Marcelo' };
const GUTA: Payer = { id: 'payer-guta', name: 'Guta' };
const PAYERS = [MARCELO, GUTA];

const ITAU: Bank = { id: 'bank-itau', name: 'Itaú' };
const NUBANK: Bank = { id: 'bank-nubank', name: 'Nubank' };
const BANKS = [ITAU, NUBANK];

function bill(
  month: Month,
  name: string,
  amount: number,
  payerId: string,
  bankId: string
): Bill {
  return {
    id: `${month}-${name}`,
    month,
    name,
    amount,
    isPaid: false,
    isFinal: true,
    payerId,
    bankId,
  };
}

describe('billsByPayerAndBank', () => {
  it('groups the month bills by payer and then by bank, with totals', () => {
    // Given June's bills split across two payers and two banks
    const bills = [
      bill(MONTH, 'Luz', 150, MARCELO.id, NUBANK.id),
      bill(MONTH, 'Internet', 110, MARCELO.id, NUBANK.id),
      bill(MONTH, 'Cartão guta', 2899, GUTA.id, ITAU.id),
      bill(MONTH, 'Gym', 200, GUTA.id, NUBANK.id),
    ];

    // When the summary is computed
    const summary = billsByPayerAndBank(MONTH, bills, BANKS, PAYERS);

    // Then each payer carries its own total and its banks carry theirs
    expect(summary).toEqual([
      {
        payerId: 'payer-marcelo',
        payerName: 'Marcelo',
        total: 260,
        banks: [{ bankId: 'bank-nubank', bankName: 'Nubank', total: 260 }],
      },
      {
        payerId: 'payer-guta',
        payerName: 'Guta',
        total: 3099,
        banks: [
          { bankId: 'bank-itau', bankName: 'Itaú', total: 2899 },
          { bankId: 'bank-nubank', bankName: 'Nubank', total: 200 },
        ],
      },
    ]);
  });

  it('merges several bills for the same payer and bank', () => {
    // Given two June bills paid by the same person from the same bank
    const bills = [
      bill(MONTH, 'Luz', 150, MARCELO.id, ITAU.id),
      bill(MONTH, 'Água', 90, MARCELO.id, ITAU.id),
    ];

    // When the summary is computed
    const summary = billsByPayerAndBank(MONTH, bills, BANKS, PAYERS);

    // Then they collapse into one bank line and one payer group
    expect(summary).toEqual([
      {
        payerId: 'payer-marcelo',
        payerName: 'Marcelo',
        total: 240,
        banks: [{ bankId: 'bank-itau', bankName: 'Itaú', total: 240 }],
      },
    ]);
  });

  it('reads in registry order, and unset or removed references sort last', () => {
    // Given a bill in an unregistered bank, a bill with no payer or bank, and
    // bills for the registered entries, listed out of registry order
    const bills = [
      bill(MONTH, 'Sem cadastro', 40, GUTA.id, 'bank-removido'),
      bill(MONTH, 'Sem nada', 25, '', ''),
      bill(MONTH, 'Cartão guta', 2899, GUTA.id, ITAU.id),
      bill(MONTH, 'Luz', 150, MARCELO.id, NUBANK.id),
    ];

    // When the summary is computed
    const summary = billsByPayerAndBank(MONTH, bills, BANKS, PAYERS);

    // Then registered payers come in registry order (Marcelo, Guta); Guta's
    // removed bank resolves to an empty name and follows Itaú; the completely
    // unset bill is its own last group
    expect(summary).toEqual([
      {
        payerId: 'payer-marcelo',
        payerName: 'Marcelo',
        total: 150,
        banks: [{ bankId: 'bank-nubank', bankName: 'Nubank', total: 150 }],
      },
      {
        payerId: 'payer-guta',
        payerName: 'Guta',
        total: 2939,
        banks: [
          { bankId: 'bank-itau', bankName: 'Itaú', total: 2899 },
          { bankId: 'bank-removido', bankName: '', total: 40 },
        ],
      },
      {
        payerId: '',
        payerName: '',
        total: 25,
        banks: [{ bankId: '', bankName: '', total: 25 }],
      },
    ]);
  });

  it('ignores other months entirely', () => {
    // Given June has one bill and May has another
    const bills = [
      bill(MONTH, 'Luz', 150, MARCELO.id, NUBANK.id),
      bill(OTHER_MONTH, 'Água', 90, GUTA.id, ITAU.id),
    ];

    // When June's summary is computed
    const summary = billsByPayerAndBank(MONTH, bills, BANKS, PAYERS);

    // Then only June's bill is counted and May's payer never appears
    expect(summary).toHaveLength(1);
    expect(summary[0].total).toBe(150);
    expect(summary[0].payerName).toBe('Marcelo');
  });

  it('is empty for a month with no bills', () => {
    // Given every bill is in another month
    const bills = [bill(OTHER_MONTH, 'Luz', 150, MARCELO.id, NUBANK.id)];

    // When the summary is computed
    // Then there is nothing to show
    expect(billsByPayerAndBank(MONTH, bills, BANKS, PAYERS)).toEqual([]);
  });
});
