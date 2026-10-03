import { useTranslation } from 'react-i18next';
import type { Outflow } from '../../types';
import { formatDisplayAmount } from '../../utils/currency';

interface OutflowRowProps {
  outflow: Outflow;
  locale: string;
  payerLabel: (id: string) => string;
  bankLabel: (id: string) => string;
  /**
   * Whether to show the paid/open status label. The Outflows screen shows it; the
   * Dashboard lists only open outflows, so there it is redundant.
   */
  showStatus?: boolean;
  /** Id prefix so co-existing lists keep distinct checkbox ids. */
  idPrefix?: string;
  /** Whether Privacy Mode is masking amounts, and the localized mask to draw. */
  masked?: boolean;
  mask?: string;
  onTogglePaid: (id: string) => void;
  onEdit: (id: string) => void;
}

/**
 * One outflow row: the paid toggle (a sibling of the row button — a checkbox nested
 * in a button is invalid and awkward for a screen reader), the ⚠️ not-final
 * flag, the name and amount, and the payer · bank line. Shared by the Outflows
 * screen and the Dashboard so a outflow reads the same in both.
 */
export default function OutflowRow({
  outflow,
  locale,
  payerLabel,
  bankLabel,
  showStatus = true,
  idPrefix = 'paid',
  masked = false,
  mask,
  onTogglePaid,
  onEdit,
}: OutflowRowProps) {
  const { t } = useTranslation();

  return (
    <li className="flex items-start gap-2 py-2">
      <input
        id={`${idPrefix}-${outflow.id}`}
        type="checkbox"
        checked={outflow.isPaid}
        onChange={() => onTogglePaid(outflow.id)}
        aria-label={t(outflow.isPaid ? 'outflows.markOpen' : 'outflows.markPaid', { name: outflow.name })}
        className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
      />
      <button
        type="button"
        onClick={() => onEdit(outflow.id)}
        aria-label={t('outflows.edit', { name: outflow.name })}
        className="flex min-w-0 flex-1 flex-col gap-1 text-left"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 flex-1 items-center gap-1">
            {!outflow.isFinal && (
              <span
                role="img"
                aria-label={t('outflows.notFinal')}
                title={t('outflows.notFinal')}
                className="shrink-0 text-sm"
              >
                ⚠️
              </span>
            )}
            <span
              className={`min-w-0 truncate text-sm ${
                outflow.isPaid ? 'text-gray-400 line-through' : 'text-gray-900'
              }`}
            >
              {outflow.name}
            </span>
          </span>
          <span
            className={`text-sm font-medium ${
              outflow.isPaid ? 'text-gray-400 line-through' : 'text-gray-900'
            }`}
          >
            {formatDisplayAmount(outflow.amount, locale, masked, mask)}
          </span>
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs text-gray-500">
            {payerLabel(outflow.payerId)} · {bankLabel(outflow.bankId)}
          </span>
          {showStatus && (
            <span
              className={`shrink-0 text-xs font-medium ${
                outflow.isPaid ? 'text-green-600' : 'text-amber-600'
              }`}
            >
              {t(outflow.isPaid ? 'outflows.paid' : 'outflows.open')}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
