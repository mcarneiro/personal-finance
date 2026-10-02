import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { toggleBillPaid } from '../../store/billsSlice';
import {
  accountNet,
  billsTotal,
  incomeTotal,
  planTotal,
  totalSpent,
} from '../../utils/controlLoop';
import { planPace } from '../../utils/planPace';
import { orderBills } from '../../utils/billOrder';
import { formatCurrency } from '../../utils/currency';
import { getCurrentMonth, getMonthName } from '../../utils/month';

const CHEVRON_ICON = 'M9 5l7 7-7 7';

interface DashboardScreenProps {
  /**
   * The clock the month label and spend pace are read from. Defaults to the real
   * now; injectable so tests can pin the month and the elapsed days.
   */
  now?: Date;
}

/**
 * The household Dashboard — the app's entry point, for the current month only.
 * It gathers the three things the household looks at together: the income/bills
 * picture (the Bills screen's Income Total, Bills Total and Account Net as
 * horizontal bars), the Spending Plan's progress (Plan Total and Total Spent as
 * a filled bar, coloured against how far through the month we are, with an
 * over-plan callout), and the Bills still open to pay, each with a paid toggle.
 * No numbers are stored here: the totals come from the control-loop utilities,
 * the pace from `planPace`, and the list from the same order and paid action the
 * Bills screen uses. History review stays on the month-scoped screens, so the
 * Dashboard never navigates months.
 */
export default function DashboardScreen({ now = new Date() }: DashboardScreenProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const month = getCurrentMonth(now);

  const planItems = useAppSelector((state) => state.plan.items);
  const cardSpending = useAppSelector((state) => state.plan.cardSpending);
  const bills = useAppSelector((state) => state.bills.items);
  const income = useAppSelector((state) => state.income.items);
  const banks = useAppSelector((state) => state.banks.items);
  const payers = useAppSelector((state) => state.payers.items);

  const incomeValue = incomeTotal(month, income);
  const billsValue = billsTotal(month, bills);
  const net = accountNet(month, income, bills);
  const target = planTotal(month, planItems);
  const spent = totalSpent(month, cardSpending);
  const pace = planPace(month, target, spent, now);

  // The Dashboard is the open to-do list, so it holds only the month's open
  // bills, in the Bills screen's order on that subset (final first, alphabetical).
  const openBills = orderBills(
    bills.filter((bill) => bill.month === month && !bill.isPaid),
    i18n.language
  );

  const payerNames = new Map(payers.map((payer) => [payer.id, payer.name]));
  const bankNames = new Map(banks.map((bank) => [bank.id, bank.name]));
  const payerLabel = (id: string) =>
    id ? (payerNames.get(id) ?? t('bills.removedPayer')) : t('bills.unassignedPayer');
  const bankLabel = (id: string) =>
    id ? (bankNames.get(id) ?? t('bills.removedBank')) : t('bills.unassignedBank');

  // A month with neither income nor bills says nothing; the plan block hides when
  // there is no plan to pace against. The open-bills block always shows, so the
  // good news ("nothing left to pay") is never silent.
  const showCashFlow = incomeValue !== 0 || billsValue !== 0;
  const showPlan = target !== 0;

  const barMax = Math.max(incomeValue, billsValue, 1);
  const fillPercent = Math.min(100, Math.round(pace.spendRatio * 100));
  const monthPercent = Math.min(100, Math.round(pace.monthRatio * 100));

  const barColor =
    pace.level === 'over'
      ? 'bg-red-600'
      : pace.level === 'ahead'
        ? 'bg-amber-500'
        : 'bg-green-500';

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <p className="text-sm font-medium text-gray-500">{getMonthName(month, i18n.language)}</p>

      {showCashFlow && (
        <section
          aria-label={t('home.cashFlow')}
          className="mt-4 rounded-lg bg-white p-4 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-gray-900">{t('home.cashFlow')}</h2>
          <ul className="mt-3 space-y-3">
            <CashFlowBar
              label={t('bills.incomeTotal')}
              value={incomeValue}
              max={barMax}
              locale={i18n.language}
              barClass="bg-blue-600"
              ariaLabel={t('home.viewIncome')}
              onClick={() => navigate(`/income/${month}`)}
            />
            <CashFlowBar
              label={t('bills.billsTotal')}
              value={billsValue}
              max={barMax}
              locale={i18n.language}
              barClass="bg-rose-500"
              ariaLabel={t('home.viewBills')}
              onClick={() => navigate(`/bills/${month}`)}
            />
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="text-sm font-medium text-gray-700">{t('bills.accountNet')}</span>
            <span className="text-lg font-bold text-gray-900">
              {formatCurrency(net, i18n.language)}
            </span>
          </div>
        </section>
      )}

      {showPlan && (
        <section aria-label={t('plan.title')} className="mt-4 rounded-lg bg-white p-4 shadow-sm">
          <BlockHeader
            label={t('plan.title')}
            onClick={() => navigate(`/plan/${month}`)}
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-gray-700">{t('plan.total')}</span>
            <span className="text-sm font-medium text-gray-900">
              {formatCurrency(target, i18n.language)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">{t('plan.totalSpentSoFar')}</span>
            <span className="text-sm font-medium text-gray-900">
              {formatCurrency(spent, i18n.language)}
            </span>
          </div>

          {/* The bar fills toward the plan and stops at it; a thin marker shows
              where the month itself is, so "ahead of pace" reads visually. */}
          <div
            role="progressbar"
            aria-label={t('plan.totalSpentSoFar')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={fillPercent}
            className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100"
          >
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${fillPercent}%` }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-y-0 w-px bg-gray-400/70"
              style={{ left: `${monthPercent}%` }}
            />
          </div>

          {pace.level === 'ahead' && (
            <button
              type="button"
              onClick={() => navigate(`/plan/${month}`)}
              className="mt-2 text-left text-sm font-medium text-amber-700"
            >
              {t('home.planAhead', { amount: formatCurrency(pace.headroom, i18n.language) })}
            </button>
          )}
          {pace.level === 'over' && (
            <button
              type="button"
              onClick={() => navigate(`/plan/${month}`)}
              className="mt-2 text-left text-sm font-medium text-red-700"
            >
              {t('home.planOver', { amount: formatCurrency(-pace.headroom, i18n.language) })}
            </button>
          )}
        </section>
      )}

      <section
        aria-label={t('home.openBills')}
        className="mt-4 rounded-lg bg-white p-4 shadow-sm"
      >
        <BlockHeader
          label={t('home.openBills')}
          onClick={() => navigate(`/bills/${month}`)}
        />
        {openBills.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">{t('home.allPaid')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {openBills.map((bill) => (
              <li key={bill.id} className="flex items-start gap-2 py-2">
                {/* The paid toggle is a sibling of the row button, as on the
                    Bills screen — a checkbox nested in a button is invalid. */}
                <input
                  id={`dashboard-paid-${bill.id}`}
                  type="checkbox"
                  checked={bill.isPaid}
                  onChange={() => dispatch(toggleBillPaid(bill.id))}
                  aria-label={t('bills.markPaid', { name: bill.name })}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
                />
                <button
                  type="button"
                  onClick={() => navigate(`/bills/edit/${bill.id}`)}
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
                      <span className="min-w-0 truncate text-sm text-gray-900">{bill.name}</span>
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(bill.amount, i18n.language)}
                    </span>
                  </span>
                  <span className="min-w-0 truncate text-xs text-gray-500">
                    {payerLabel(bill.payerId)} · {bankLabel(bill.bankId)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** A tappable block header that opens the block's full month screen. */
function BlockHeader({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <h2>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-sm font-semibold text-gray-900">{label}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="h-4 w-4 shrink-0 text-gray-400"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={CHEVRON_ICON} />
        </svg>
      </button>
    </h2>
  );
}

/** One labelled horizontal bar in the income/outcome picture, on a shared scale. */
function CashFlowBar({
  label,
  value,
  max,
  locale,
  barClass,
  ariaLabel,
  onClick,
}: {
  label: string;
  value: number;
  max: number;
  locale: string;
  barClass: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  const percent = Math.round((value / max) * 100);
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className="block w-full text-left"
      >
        <span className="flex items-center justify-between text-sm">
          <span className="text-gray-700">{label}</span>
          <span className="font-medium text-gray-900">{formatCurrency(value, locale)}</span>
        </span>
        <span
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-1 block h-2 w-full overflow-hidden rounded-full bg-gray-100"
        >
          <span className={`block h-full rounded-full ${barClass}`} style={{ width: `${percent}%` }} />
        </span>
      </button>
    </li>
  );
}
