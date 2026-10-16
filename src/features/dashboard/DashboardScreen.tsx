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
import { cashFlowBar, cashFlowSlices } from '../../utils/cashFlowBar';
import { orderOutflows } from '../../utils/outflowOrder';
import { formatDisplayAmount } from '../../utils/currency';
import { getCurrentMonth, getMonthName } from '../../utils/month';
import { useRegistryLabels } from '../../hooks/useRegistryLabels';
import { usePrivacyMode } from '../../contexts/privacyMode';
import BlockHeader from '../../components/BlockHeader';
import OutflowRow from '../outflows/OutflowRow';
import CashFlowCard from './CashFlowCard';
import SavingsTrend from './SavingsTrend';

/** The plan bar's colour per pace level. */
const BAR_COLOR: Record<PlanPaceLevel, string> = {
  under: 'bg-green-500',
  ahead: 'bg-amber-500',
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
 * It gathers the four things the household looks at together: the income/outflows
 * picture (the shared `CashFlowCard` — the Outflows screen's Income Total and
 * Outflows Total as a single bar filled by the outflows toward the income and
 * composed of the month's confirmed/unconfirmed Payments and Investments, plus
 * Account Net, with the heading and the over-income caption the card shows only
 * here), the Spending Plan's progress (Plan Total and Total Spent as a filled
 * bar, coloured against how far through the month we are, with an over-plan
 * callout), the Outflows still open to pay, each with a paid toggle, and the
 * savings trend (the rolling 12-month stacked chart, its own `SavingsTrend`
 * block). No numbers are stored here: the totals come from the control-loop
 * utilities, the pace from `planPace`, the bar from `cashFlowBar`, its slices
 * from `cashFlowSlices`, and the list from the same order and paid action the
 * Outflows screen uses. History review stays on the month-scoped screens, so the
 * Dashboard never navigates months.
 */
export default function DashboardScreen({ now = new Date() }: DashboardScreenProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const month = getCurrentMonth(now);
  // Every amount on the Dashboard is a display value: Privacy Mode masks them
  // without touching the derived numbers the control loop computes.
  const { masked, mask } = usePrivacyMode();
  const money = (amount: number) =>
    formatDisplayAmount(amount, i18n.language, masked, mask);

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

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <p className="text-sm font-medium text-gray-500">{getMonthName(month, i18n.language)}</p>

      {showCashFlow && (
        <CashFlowCard
          month={month}
          income={incomeValue}
          outflows={outflowsValue}
          net={net}
          bar={cashFlow}
          slices={cashFlowSlices(month, outflows)}
          label={t('home.cashFlow')}
          showHeading
          showOverCaption
        />
      )}

      {showPlan && (
        <section aria-label={t('plan.title')} className="mt-4 rounded-lg bg-white p-4 shadow-sm">
          <BlockHeader
            label={t('plan.title')}
            onClick={() => navigate(`/plan/${month}`)}
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-gray-700">{t('plan.total')}</span>
            <span className="text-sm font-medium text-gray-900">{money(target)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">{t('plan.totalSpentSoFar')}</span>
            <span className="text-sm font-medium text-gray-900">{money(spent)}</span>
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
              {t('home.planAhead', { amount: money(pace.headroom) })}
            </button>
          )}
          {pace.level === 'over' && (
            <button
              type="button"
              onClick={() => navigate(`/plan/${month}`)}
              className="mt-2 text-left text-sm font-medium text-red-700"
            >
              {t('home.planOver', { amount: money(-pace.headroom) })}
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
                masked={masked}
                mask={mask}
                onTogglePaid={(id) => dispatch(toggleOutflowPaid(id))}
                onEdit={(id) => navigate(`/outflows/edit/${id}`)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* The savings trend is the last block; it hides itself when the household
          has no pots or no recorded history (ADR-0011). */}
      <SavingsTrend now={now} />
    </div>
  );
}
