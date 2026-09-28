import { FormEvent, useState } from 'react';
import { parseAmount } from '../utils/currency';

interface NameAmountFormProps {
  /** Unique prefix so co-existing add/edit forms keep distinct labels and inputs. */
  formId: string;
  nameLabel: string;
  amountLabel: string;
  submitLabel: string;
  initialName?: string;
  initialAmount?: number;
  autoFocusName?: boolean;
  onSubmit: (name: string, amount: number) => void;
  /** Render a Cancel action (editing an existing item); label and handler are paired. */
  onCancel?: { label: string; onClick: () => void };
}

/**
 * The shared name + amount form, used both to add a plan item (fixed charge or
 * spending bucket) or a bill and to edit one in place. Amounts are typed as
 * loose text (pt-BR comma or en-US dot) and only become submittable once they
 * parse — a bad amount can never be recorded.
 */
export default function NameAmountForm({
  formId,
  nameLabel,
  amountLabel,
  submitLabel,
  initialName = '',
  initialAmount,
  autoFocusName = false,
  onSubmit,
  onCancel,
}: NameAmountFormProps) {
  const [name, setName] = useState(initialName);
  const [amount, setAmount] = useState(initialAmount === undefined ? '' : String(initialAmount));

  const parsedAmount = parseAmount(amount);
  const canSubmit = name.trim().length > 0 && parsedAmount !== null;

  const nameId = `${formId}-name`;
  const amountId = `${formId}-amount`;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || parsedAmount === null) return;
    onSubmit(name.trim(), parsedAmount);
    setName('');
    setAmount('');
  };

  const inputClass =
    'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={nameId} className="block text-sm font-medium text-gray-700">
            {nameLabel}
          </label>
          <input
            id={nameId}
            type="text"
            autoFocus={autoFocusName}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className="w-28">
          <label htmlFor={amountId} className="block text-sm font-medium text-gray-700">
            {amountLabel}
          </label>
          <input
            id={amountId}
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
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
