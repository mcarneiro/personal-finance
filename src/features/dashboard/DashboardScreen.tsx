import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { toggleOutflowPaid } from '../../store/outflowsSlice';
import {
  accountNet,
  outflowsTotal,
  incomeTotal,
  planTotal,
  totalSpent,
} from '../../utils/controlLoop';
import { planPace, type PlanPaceLevel } from '../../utils/planPace';
import { cashFlowBar, type CashFlowLevel } from '../../utils/cashFlowBar';
import { orderOutflows } from '../../utils/outflowOrder';
import { formatCurrency } from '../../utils/currency';
import { getCurrentMonth, getMonthName } from '../../utils/month';
import { useRegistryLabels } from '../../hooks/useRegistryLabels';
import OutflowRow from '../outflows/OutflowRow';

const CHEVRON_ICON = 'M9 5l7 7-7 7';

/** The plan bar's colour per pace level. */
const BAR_COLOR: Record<PlanPaceLevel, string> = {
  under: 'bg-green-500',
  ahead: 'bg-amber-500',
  over: 'bg-red-600',
};

/** The cash-flow bar's colour per level. */
const CASH_FLOW_BAR_COLOR: Record<CashFlowLevel, string> = {
  under: 'bg-green-500',
  over: 'bg-red-600',
};

interface DashboardScreenProps {
  /**
   * The clock the month label and spend pace are read from. Defaults to the real
   * now; injectable so tests can pin the month and the elapsed days.
   */
  now?: Date;
}

/**
 * The household Dashboard — the app's entry point, for the current month only.
 * It gathers the three things the household looks at together: the income/outflows
 * picture (the Outflows screen's Income Total and Outflows Total as a single bar
 * filled by the outflows toward the income, plus Account Net), the Spending Plan's
 * progress (Plan Total and Total Spent as a filled bar, coloured against how far
 * through the month we are, with an over-plan callout), and the Outflows still
 * open to pay, each with a paid toggle.
 * No numbers are stored here: the totals come from the control-loop utilities,
 * the pace from `planPace`, and the list from the same order and paid action the
 * Outflows screen uses. History review stays on the month-scoped screens, so the
 * Dashboard never navigates months.
 */
export default function DashboardScreen({ now = new Date() }: DashboardScreenProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const month = getCurrentMonth(now);

  const planItems = useAppSelector((state) => state.plan.items);
  const cardSpending = useAppSelector((state) => state.plan.cardSpending);
  const outflows = useAppSelector((state) => state.outflows.items);
  const income = useAppSelector((state) => state.income.items);
  // Payer/bank names are resolved exactly as on the Outflows screen.
  const { payerLabel, bankLabel } = useRegistryLabels();

  const incomeValue = incomeTotal(month, income);
  const outflowsValue = outflowsTotal(month, outflows);
  const net = accountNet(month, income, outflows);
  const target = planTotal(month, planItems);
  const spent = totalSpent(month, cardSpending);
  const pace = planPace(month, target, spent, now);

  // The Dashboard is the open to-do list, so it holds only the month's open
  // outflows, in the Outflows screen's order on that subset (final first, alphabetical).
  const openOutflows = orderOutflows(
    outflows.filter((outflow) => outflow.month === month && !outflow.isPaid),
    i18n.language
  );

  // A month with neither income nor outflows says nothing; the plan block hides when
  // there is no plan to pace against. The open-outflows block always shows, so the
  // good news ("nothing left to pay") is never silent.
  const showCashFlow = incomeValue !== 0 || outflowsValue !== 0;
  const showPlan = target !== 0;

  const fillPercent = Math.min(100, Math.round(pace.spendRatio * 100));
  const monthPercent = Math.min(100, Math.round(pace.monthRatio * 100));

  const barColor = BAR_COLOR[pace.level];
  const cashFlow = cashFlowBar(incomeValue, outflowsValue);
  const cashFlowFillPercent = Math.round(cashFlow.ratio * 100);
  const cashFlowColor = CASH_FLOW_BAR_COLOR[cashFlow.level];

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <p className="text-sm font-medium text-gray-500">{getMonthName(month, i18n.language)}</p>

      {showCashFlow && (
        <section
          aria-label={t('home.cashFlow')}
          className="mt-4 rounded-lg bg-white p-4 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-gray-900">{t('home.cashFlow')}</h2>
          <button
            type="button"
            onClick={() => navigate(`/income/${month}`)}
            aria-label={t('home.viewIncome')}
            className="mt-3 flex w-full items-center justify-between text-left"
          >
            <span className="text-sm text-gray-700">{t('outflows.incomeTotal')}</span>
            <span className="text-sm font-medium text-gray-900">
              {formatCurrency(incomeValue, i18n.language)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate(`/outflows/${month}`)}
            aria-label={t('home.viewOutflows')}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-sm text-gray-700">{t('outflows.outflowsTotal')}</span>
            <span className="text-sm font-medium text-gray-900">
              {formatCurrency(outflowsValue, i18n.language)}
            </span>
          </button>

          {/* The bar fills with the month's outflows toward the income ceiling and
              stops at it; it turns red and caps once outflows pass the income. */}
          <div
            role="progressbar"
            aria-label={t('outflows.outflowsTotal')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={cashFlowFillPercent}
            className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100"
          >
            <div
              className={`h-full rounded-full ${cashFlowColor}`}
              style={{ width: `${cashFlowFillPercent}%` }}
            />
          </div>

          {cashFlow.level === 'over' && (
            <button
              type="button"
              onClick={() => navigate(`/outflows/${month}`)}
              className="mt-2 text-left text-sm font-medium text-red-700"
            >
              {t('home.cashFlowOver', { amount: formatCurrency(-net, i18n.language) })}
            </button>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="text-sm font-medium text-gray-700">{t('outflows.accountNet')}</span>
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
              // Clamped just inside the clipped track so the marker stays visible
              // even on the last day, when the month is 100% elapsed.
              style={{ left: `${Math.min(monthPercent, 99)}%` }}
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
        aria-label={t('home.openOutflows')}
        className="mt-4 rounded-lg bg-white p-4 shadow-sm"
      >
        <BlockHeader
          label={t('home.openOutflows')}
          onClick={() => navigate(`/outflows/${month}`)}
        />
        {openOutflows.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">{t('home.allPaid')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {openOutflows.map((outflow) => (
              <OutflowRow
                key={outflow.id}
                outflow={outflow}
                locale={i18n.language}
                payerLabel={payerLabel}
                bankLabel={bankLabel}
                showStatus={false}
                idPrefix="dashboard-paid"
                onTogglePaid={(id) => dispatch(toggleOutflowPaid(id))}
                onEdit={(id) => navigate(`/outflows/edit/${id}`)}
              />
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
