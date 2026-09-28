import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import MonthScaffold from '../../components/MonthScaffold';
import NameAmountForm from '../../components/NameAmountForm';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addBill, deleteBill, toggleBillPaid, updateBill } from '../../store/billsSlice';
import { accountNet, billsTotal, incomeTotal } from '../../utils/controlLoop';
import { formatCurrency } from '../../utils/currency';
import { generateId } from '../../utils/id';
import { isValidMonth } from '../../utils/month';

/**
 * The Bills screen for one month: payment obligations added fully by hand
 * (name, amount — the card bill is just another bill with its real statement
 * value), each with a paid toggle, plus the month's bills total, income total
 * and the account net (income − bills). There is no replicate and no
 * auto-generation. The derived numbers come from the control-loop utilities and
 * are never stored; every mutation syncs through the debounced middleware onto
 * the bills tab.
 */
export default function BillsScreen() {
  const { t, i18n } = useTranslation();
  const { month } = useParams<{ month: string }>();
  const dispatch = useAppDispatch();
  const bills = useAppSelector((state) => state.bills.items);
  const income = useAppSelector((state) => state.income.items);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!isValidMonth(month)) {
    // MonthScaffold owns the redirect; nothing to list until it settles.
    return <MonthScaffold basePath="/bills" title={t('bills.title')} />;
  }

  const monthBills = bills.filter((bill) => bill.month === month);
  const net = accountNet(month, income, bills);

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
                  <NameAmountForm
                    formId={`edit-${bill.id}`}
                    nameLabel={t('bills.itemNameLabel')}
                    amountLabel={t('bills.itemAmountLabel')}
                    submitLabel={t('bills.save')}
                    initialName={bill.name}
                    initialAmount={bill.amount}
                    autoFocusName
                    onSubmit={(name, amount) => {
                      dispatch(updateBill({ ...bill, name, amount }));
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
        <NameAmountForm
          key={month}
          formId="add-bill"
          nameLabel={t('bills.nameLabel')}
          amountLabel={t('bills.amountLabel')}
          submitLabel={t('bills.addBill')}
          onSubmit={(name, amount) =>
            dispatch(addBill({ id: generateId(), month, name, amount, isPaid: false }))
          }
        />
      </section>
    </MonthScaffold>
  );
}
