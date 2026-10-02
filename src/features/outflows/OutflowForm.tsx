import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Bank, Payer } from '../../types';
import { parseAmount } from '../../utils/currency';

export interface OutflowDraft {
  name: string;
  amount: number;
  isFinal: boolean;
  payerId: string;
  bankId: string;
}

interface OutflowFormProps {
  /** Unique prefix so co-existing add/edit forms keep distinct labels and inputs. */
  formId: string;
  payers: Payer[];
  banks: Bank[];
  nameLabel: string;
  amountLabel: string;
  submitLabel: string;
  initialName?: string;
  initialAmount?: number;
  initialIsFinal?: boolean;
  initialPayerId?: string;
  initialBankId?: string;
  autoFocusName?: boolean;
  onSubmit: (draft: OutflowDraft) => void;
  /** Render a Cancel action (editing an existing outflow); label and handler are paired. */
  onCancel?: { label: string; onClick: () => void };
}

/**
 * The outflow form: name, amount, payer and bank — all four required, so a outflow can
 * never be saved without knowing who pays it and from where. Amounts are typed
 * as loose text (pt-BR comma or en-US dot) and only become submittable once they
 * parse. Payer/bank are chosen from the registries maintained in Settings. The
 * final-value checkbox is optional and unset by default, marking the amount as
 * confirmed for the month.
 */
export default function OutflowForm({
  formId,
  payers,
  banks,
  nameLabel,
  amountLabel,
  submitLabel,
  initialName = '',
  initialAmount,
  initialIsFinal = false,
  initialPayerId = '',
  initialBankId = '',
  autoFocusName = false,
  onSubmit,
  onCancel,
}: OutflowFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [amount, setAmount] = useState(initialAmount === undefined ? '' : String(initialAmount));
  const [isFinal, setIsFinal] = useState(initialIsFinal);
  const [payerId, setPayerId] = useState(initialPayerId);
  const [bankId, setBankId] = useState(initialBankId);

  const parsedAmount = parseAmount(amount);
  const canSubmit =
    name.trim().length > 0 && parsedAmount !== null && payerId !== '' && bankId !== '';

  const nameId = `${formId}-name`;
  const amountId = `${formId}-amount`;
  const finalId = `${formId}-final`;
  const payerIdField = `${formId}-payer`;
  const bankIdField = `${formId}-bank`;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || parsedAmount === null) return;
    onSubmit({ name: name.trim(), amount: parsedAmount, isFinal, payerId, bankId });
    setName('');
    setAmount('');
    setIsFinal(false);
    setPayerId('');
    setBankId('');
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

      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={payerIdField} className="block text-sm font-medium text-gray-700">
            {t('outflows.payerLabel')}
          </label>
          <select
            id={payerIdField}
            value={payerId}
            onChange={(event) => setPayerId(event.target.value)}
            className={inputClass}
          >
            <option value="">{t('outflows.selectPayer')}</option>
            {payers.map((payer) => (
              <option key={payer.id} value={payer.id}>
                {payer.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor={bankIdField} className="block text-sm font-medium text-gray-700">
            {t('outflows.bankLabel')}
          </label>
          <select
            id={bankIdField}
            value={bankId}
            onChange={(event) => setBankId(event.target.value)}
            className={inputClass}
          >
            <option value="">{t('outflows.selectBank')}</option>
            {banks.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id={finalId}
          type="checkbox"
          checked={isFinal}
          onChange={(event) => setIsFinal(event.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor={finalId} className="text-sm text-gray-700">
          {t('outflows.finalValueLabel')}
        </label>
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
