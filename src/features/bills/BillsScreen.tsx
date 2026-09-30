import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import MonthScaffold from '../../components/MonthScaffold';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addBills, toggleBillPaid } from '../../store/billsSlice';
import { accountNet, billsTotal, incomeTotal } from '../../utils/controlLoop';
import { billsByPayerAndBank, type BankTotal, type PayerGroup } from '../../utils/billSummary';
import { copyBills } from '../../utils/billCopy';
import { formatCurrency } from '../../utils/currency';
import { isValidMonth, shiftMonth } from '../../utils/month';
import NeedsRegistryNotice from './NeedsRegistryNotice';

/**
 * The Bills screen for one month: payment obligations added by hand (name,
 * amount, payer, bank — the card bill is just another bill with its real
 * statement value), each with a paid toggle, plus the month's bills total,
 * income total, the account net (income − bills), and the by-payer spending
 * summary. The replicate-last-month button copies last month's obligations so
 * recurring bills need no retyping; the copies arrive open (never pre-paid) and
 * can be edited freely. The derived numbers come from the control-loop
 * utilities and the bill-summary utility and are never stored; every mutation
 * syncs through the debounced middleware onto the bills tab.
 */
export default function BillsScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { month } = useParams<{ month: string }>();
  const dispatch = useAppDispatch();
  const bills = useAppSelector((state) => state.bills.items);
  const income = useAppSelector((state) => state.income.items);
  const banks = useAppSelector((state) => state.banks.items);
  const payers = useAppSelector((state) => state.payers.items);

  if (!isValidMonth(month)) {
    // MonthScaffold owns the redirect; nothing to list until it settles.
    return <MonthScaffold basePath="/bills" />;
  }

  const monthBills = bills.filter((bill) => bill.month === month);
  const lastMonthBills = bills.filter((bill) => bill.month === shiftMonth(month, -1));
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
    <MonthScaffold basePath="/bills">
      <section
        aria-label={t('bills.summary')}
        className="mt-4 rounded-lg bg-white p-4 shadow-sm"
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
        {/* Replicate only into an empty month: on a month that already has
            bills it would silently duplicate the whole list. */}
        {lastMonthBills.length > 0 && monthBills.length === 0 && (
          <button
            type="button"
            onClick={() => dispatch(addBills(copyBills(lastMonthBills, month)))}
            className="mt-3 w-full rounded-lg border border-blue-600 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
          >
            {t('bills.copyLastMonth')}
          </button>
        )}
      </section>

      {monthBills.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">{t('bills.empty')}</p>
      )}

      {monthBills.length > 0 && (
        <section className="mt-4 rounded-lg bg-white p-4 shadow-sm">
          <ul className="divide-y divide-gray-100">
            {monthBills.map((bill) => (
              <li key={bill.id} className="flex items-start gap-2 py-2">
                {/* The paid toggle stays a sibling of the row button — a
                    checkbox nested in a button would be invalid and awkward
                    to reach with a screen reader. */}
                <input
                  id={`paid-${bill.id}`}
                  type="checkbox"
                  checked={bill.isPaid}
                  onChange={() => dispatch(toggleBillPaid(bill.id))}
                  aria-label={t(bill.isPaid ? 'bills.markOpen' : 'bills.markPaid', {
                    name: bill.name,
                  })}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
                />
                <button
                  type="button"
                  onClick={() => navigate(`/bills/edit/${bill.id}`)}
                  aria-label={t('bills.edit', { name: bill.name })}
                  className="flex min-w-0 flex-1 flex-col gap-1 text-left"
                >
                  <span className="flex items-center justify-between gap-2">
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
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs text-gray-500">
                      {payerLabel(bill.payerId)} · {bankLabel(bill.bankId)}
                    </span>
                    <span
                      className={`shrink-0 text-xs font-medium ${
                        bill.isPaid ? 'text-green-600' : 'text-amber-600'
                      }`}
                    >
                      {t(bill.isPaid ? 'bills.paid' : 'bills.open')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!registryReady && (
        <div className="mt-4">
          <NeedsRegistryNotice />
        </div>
      )}

      <section
        aria-label={t('bills.byPayerSummary')}
        className="mt-4 rounded-lg bg-white p-4 shadow-sm"
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
