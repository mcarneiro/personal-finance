import { useTranslation } from 'react-i18next';
import type { Bill } from '../../types';
import { formatCurrency } from '../../utils/currency';

interface BillRowProps {
  bill: Bill;
  locale: string;
  payerLabel: (id: string) => string;
  bankLabel: (id: string) => string;
  /**
   * Whether to show the paid/open status label. The Bills screen shows it; the
   * Dashboard lists only open bills, so there it is redundant.
   */
  showStatus?: boolean;
  /** Id prefix so co-existing lists keep distinct checkbox ids. */
  idPrefix?: string;
  onTogglePaid: (id: string) => void;
  onEdit: (id: string) => void;
}

/**
 * One bill row: the paid toggle (a sibling of the row button — a checkbox nested
 * in a button is invalid and awkward for a screen reader), the ⚠️ not-final
 * flag, the name and amount, and the payer · bank line. Shared by the Bills
 * screen and the Dashboard so a bill reads the same in both.
 */
export default function BillRow({
  bill,
  locale,
  payerLabel,
  bankLabel,
  showStatus = true,
  idPrefix = 'paid',
  onTogglePaid,
  onEdit,
}: BillRowProps) {
  const { t } = useTranslation();

  return (
    <li className="flex items-start gap-2 py-2">
      <input
        id={`${idPrefix}-${bill.id}`}
        type="checkbox"
        checked={bill.isPaid}
        onChange={() => onTogglePaid(bill.id)}
        aria-label={t(bill.isPaid ? 'bills.markOpen' : 'bills.markPaid', { name: bill.name })}
        className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
      />
      <button
        type="button"
        onClick={() => onEdit(bill.id)}
        aria-label={t('bills.edit', { name: bill.name })}
        className="flex min-w-0 flex-1 flex-col gap-1 text-left"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 flex-1 items-center gap-1">
            {!bill.isFinal && (
              <span
                role="img"
                aria-label={t('bills.notFinal')}
                title={t('bills.notFinal')}
                className="shrink-0 text-sm"
              >
                ⚠️
              </span>
            )}
            <span
              className={`min-w-0 truncate text-sm ${
                bill.isPaid ? 'text-gray-400 line-through' : 'text-gray-900'
              }`}
            >
              {bill.name}
            </span>
          </span>
          <span
            className={`text-sm font-medium ${
              bill.isPaid ? 'text-gray-400 line-through' : 'text-gray-900'
            }`}
          >
            {formatCurrency(bill.amount, locale)}
          </span>
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs text-gray-500">
            {payerLabel(bill.payerId)} · {bankLabel(bill.bankId)}
          </span>
          {showStatus && (
            <span
              className={`shrink-0 text-xs font-medium ${
                bill.isPaid ? 'text-green-600' : 'text-amber-600'
              }`}
            >
              {t(bill.isPaid ? 'bills.paid' : 'bills.open')}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
