import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import MonthScaffold from '../../components/MonthScaffold';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addBill, deleteBill, toggleBillPaid, updateBill } from '../../store/billsSlice';
import { accountNet, billsTotal, incomeTotal } from '../../utils/controlLoop';
import { billsByPayerAndBank, type BankTotal, type PayerGroup } from '../../utils/billSummary';
import { formatCurrency } from '../../utils/currency';
import { generateId } from '../../utils/id';
import { isValidMonth } from '../../utils/month';
import BillForm from './BillForm';

/**
 * The Bills screen for one month: payment obligations added fully by hand
 * (name, amount, payer, bank — the card bill is just another bill with its real
 * statement value), each with a paid toggle, plus the month's bills total,
 * income total, the account net (income − bills), and the by-payer spending
 * summary. There is no replicate and no auto-generation. The derived numbers
 * come from the control-loop utilities and the bill-summary utility and are
 * never stored; every mutation syncs through the debounced middleware onto the
 * bills tab.
 */
export default function BillsScreen() {
  const { t, i18n } = useTranslation();
  const { month } = useParams<{ month: string }>();
  const dispatch = useAppDispatch();
  const bills = useAppSelector((state) => state.bills.items);
  const income = useAppSelector((state) => state.income.items);
  const banks = useAppSelector((state) => state.banks.items);
  const payers = useAppSelector((state) => state.payers.items);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!isValidMonth(month)) {
    // MonthScaffold owns the redirect; nothing to list until it settles.
    return <MonthScaffold basePath="/bills" title={t('bills.title')} />;
  }

  const monthBills = bills.filter((bill) => bill.month === month);
  const net = accountNet(month, income, bills);
  const spending = billsByPayerAndBank(month, bills, banks, payers);

  const payerNames = new Map(payers.map((payer) => [payer.id, payer.name]));
  const bankNames = new Map(banks.map((bank) => [bank.id, bank.name]));
  /** Resolve a registry name, falling back for unset vs. since-removed entries. */
  const payerLabel = (id: string) =>
    id ? (payerNames.get(id) ?? t('bills.removedPayer')) : t('bills.unassignedPayer');
  const bankLabel = (id: string) =>
    id ? (bankNames.get(id) ?? t('bills.removedBank')) : t('bills.unassignedBank');

  const registryReady = payers.length > 0 && banks.length > 0;

  return (
    <MonthScaffold basePath="/bills" title={t('bills.title')}>
      <section
        aria-label={t('bills.summary')}
        className="mt-4 rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{t('bills.billsTotal')}</span>
          <span className="text-sm font-medium text-gray-900">
            {formatCurrency(billsTotal(month, bills), i18n.language)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm text-gray-700">{t('bills.incomeTotal')}</span>
          <span className="text-sm font-medium text-gray-900">
            {formatCurrency(incomeTotal(month, income), i18n.language)}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="text-sm font-medium text-gray-700">{t('bills.accountNet')}</span>
          <span className="text-lg font-bold text-gray-900">
            {formatCurrency(net, i18n.language)}
          </span>
        </div>
      </section>

      {monthBills.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">{t('bills.empty')}</p>
      )}

      {monthBills.length > 0 && (
        <section className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <ul className="divide-y divide-gray-100">
            {monthBills.map((bill) => (
              <li key={bill.id} className="py-2">
                {editingId === bill.id ? (
                  <BillForm
                    formId={`edit-${bill.id}`}
                    payers={payers}
                    banks={banks}
                    nameLabel={t('bills.itemNameLabel')}
                    amountLabel={t('bills.itemAmountLabel')}
                    submitLabel={t('bills.save')}
                    initialName={bill.name}
                    initialAmount={bill.amount}
                    initialPayerId={bill.payerId}
                    initialBankId={bill.bankId}
                    autoFocusName
                    onSubmit={(draft) => {
                      dispatch(updateBill({ ...bill, ...draft }));
                      setEditingId(null);
                    }}
                    onCancel={{ label: t('bills.cancel'), onClick: () => setEditingId(null) }}
                  />
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <input
                        id={`paid-${bill.id}`}
                        type="checkbox"
                        checked={bill.isPaid}
                        onChange={() => dispatch(toggleBillPaid(bill.id))}
                        aria-label={t(bill.isPaid ? 'bills.markOpen' : 'bills.markPaid', {
                          name: bill.name,
                        })}
                        className="h-4 w-4 shrink-0 rounded border-gray-300"
                      />
                      <span
                        className={`min-w-0 flex-1 truncate text-sm ${
                          bill.isPaid ? 'text-gray-400 line-through' : 'text-gray-900'
                        }`}
                      >
                        {bill.name}
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          bill.isPaid ? 'text-gray-400 line-through' : 'text-gray-900'
                        }`}
                      >
                        {formatCurrency(bill.amount, i18n.language)}
                      </span>
                    </div>
                    <p className="ml-6 text-xs text-gray-500">
                      {payerLabel(bill.payerId)} · {bankLabel(bill.bankId)}
                    </p>
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-medium ${
                          bill.isPaid ? 'text-green-600' : 'text-amber-600'
                        }`}
                      >
                        {t(bill.isPaid ? 'bills.paid' : 'bills.open')}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingId(bill.id)}
                          aria-label={t('bills.edit', { name: bill.name })}
                          className="rounded-lg px-2 py-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
                        >
                          {t('bills.editAction')}
                        </button>
                        <button
                          type="button"
                          onClick={() => dispatch(deleteBill(bill.id))}
                          aria-label={t('bills.remove', { name: bill.name })}
                          className="rounded-lg px-2 py-1 text-sm font-medium text-red-600 transition-colors hover:text-red-700"
                        >
                          {t('bills.removeAction')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
        {registryReady ? (
          <BillForm
            key={month}
            formId="add-bill"
            payers={payers}
            banks={banks}
            nameLabel={t('bills.nameLabel')}
            amountLabel={t('bills.amountLabel')}
            submitLabel={t('bills.addBill')}
            onSubmit={(draft) =>
              dispatch(addBill({ id: generateId(), month, isPaid: false, ...draft }))
            }
          />
        ) : (
          <p className="text-sm text-gray-600">{t('bills.needsRegistry')}</p>
        )}
      </section>

      <section
        aria-label={t('bills.byPayerSummary')}
        className="mt-4 rounded-lg border border-gray-200 bg-white p-4"
      >
        <h2 className="text-sm font-semibold text-gray-900">{t('bills.byPayerSummary')}</h2>

        {spending.length === 0 ? (
          <p className="mt-1 text-sm text-gray-600">{t('bills.byPayerEmpty')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {spending.map((group) => (
              <li key={group.payerId || '__unassigned__'} className="py-2">
                <PayerGroupRow group={group} locale={i18n.language} payerLabel={payerLabel} bankLabel={bankLabel} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </MonthScaffold>
  );
}

/** One payer's line with its per-bank breakdown. */
function PayerGroupRow({
  group,
  locale,
  payerLabel,
  bankLabel,
}: {
  group: PayerGroup;
  locale: string;
  payerLabel: (id: string) => string;
  bankLabel: (id: string) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">{payerLabel(group.payerId)}</span>
        <span className="text-sm font-medium text-gray-900">
          {formatCurrency(group.total, locale)}
        </span>
      </div>
      <ul className="mt-1 space-y-1">
        {group.banks.map((line: BankTotal) => (
          <li
            key={line.bankId || '__nobank__'}
            className="flex items-center justify-between pl-4"
          >
            <span className="text-xs text-gray-600">{bankLabel(line.bankId)}</span>
            <span className="text-xs text-gray-600">{formatCurrency(line.total, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
