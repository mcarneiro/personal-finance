import { FormEvent, useState } from 'react';
import { parseAmount } from '../../utils/currency';

interface IncomeEntryFormProps {
  /** Unique prefix so co-existing add/edit forms keep distinct labels and inputs. */
  formId: string;
  amountLabel: string;
  sourceLabel: string;
  submitLabel: string;
  initialAmount?: number;
  initialSource?: string;
  autoFocusAmount?: boolean;
  /** The note is optional; a blank one is submitted as `undefined`. */
  onSubmit: (amount: number, source?: string) => void;
  /** Render a Cancel action (editing an existing entry); label and handler are paired. */
  onCancel?: { label: string; onClick: () => void };
}

/**
 * The amount + optional source-note form for an income entry, used by the
 * full-screen income editor to create and edit an entry. Only the amount is
 * required; amounts are typed as loose text (pt-BR comma or en-US dot) and only
 * become submittable once they parse — a bad amount can never be recorded.
 */
export default function IncomeEntryForm({
  formId,
  amountLabel,
  sourceLabel,
  submitLabel,
  initialAmount,
  initialSource = '',
  autoFocusAmount = false,
  onSubmit,
  onCancel,
}: IncomeEntryFormProps) {
  const [amount, setAmount] = useState(initialAmount === undefined ? '' : String(initialAmount));
  const [source, setSource] = useState(initialSource);

  const parsedAmount = parseAmount(amount);
  const canSubmit = parsedAmount !== null;

  const amountId = `${formId}-amount`;
  const sourceId = `${formId}-source`;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || parsedAmount === null) return;
    const trimmedSource = source.trim();
    onSubmit(parsedAmount, trimmedSource === '' ? undefined : trimmedSource);
    setAmount('');
    setSource('');
  };

  const inputClass =
    'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <div className="w-28">
          <label htmlFor={amountId} className="block text-sm font-medium text-gray-700">
            {amountLabel}
          </label>
          <input
            id={amountId}
            type="text"
            inputMode="decimal"
            autoFocus={autoFocusAmount}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor={sourceId} className="block text-sm font-medium text-gray-700">
            {sourceLabel}
          </label>
          <input
            id={sourceId}
            type="text"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel.onClick}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            {onCancel.label}
          </button>
        )}
      </div>
    </form>
  );
}
