import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import MonthScaffold from '../../components/MonthScaffold';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addPlanItems, updatePlanItem } from '../../store/planSlice';
import { planResult, planTotal, projectedResult } from '../../utils/controlLoop';
import { formatDisplayAmount } from '../../utils/currency';
import { isPastMonth, isValidMonth, shiftMonth } from '../../utils/month';
import { copyPlanItems } from '../../utils/planCopy';
import { useCopyGuard } from '../../hooks/useCopyGuard';
import { usePrivacyMode } from '../../contexts/privacyMode';
import AmountInput from './AmountInput';
import CardCheckIn from './CardCheckIn';

/**
 * The Spending Plan screen for one month — the live control loop. It composes
 * the month's spending buckets, takes one current-total check-in per card, holds
 * one editable Remaining Estimate per bucket, and headlines the month's result:
 * the live Projected Result for the current month, the final Plan Result for
 * past months. Every derived number comes from the control-loop utilities and is
 * never stored; every mutation syncs through the debounced middleware onto the
 * sheet.
 */
export default function PlanScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { month } = useParams<{ month: string }>();
  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.plan.items);
  const cardSpending = useAppSelector((state) => state.plan.cardSpending);
  // Re-read the target month right before copying so a plan another member
  // already seeded is never duplicated (ADR-0008).
  const { blocked: copyBlocked, checkFailed: copyCheckFailed, canCopy } = useCopyGuard(
    'plan',
    month
  );
  const { masked, mask } = usePrivacyMode();
  const money = (amount: number) => formatDisplayAmount(amount, i18n.language, masked, mask);

  if (!isValidMonth(month)) {
    // MonthScaffold owns the redirect; nothing to compose until it settles.
    return <MonthScaffold basePath="/plan" />;
  }

  const monthItems = items.filter((item) => item.month === month);
  const lastMonthItems = items.filter((item) => item.month === shiftMonth(month, -1));

  // Past months are history: their headline is the final Plan Result, so stale
  // remaining estimates can never distort it. The current (and future) months
  // show the live Projected Result.
  const isHistory = isPastMonth(month);
  const headlineLabel = t(isHistory ? 'plan.planResult' : 'plan.projectedResult');
  const headlineValue = isHistory
    ? planResult(month, items, cardSpending)
    : projectedResult(month, items, cardSpending);

  return (
    <MonthScaffold basePath="/plan">
      <section
        aria-label={headlineLabel}
        className="mt-4 rounded-lg bg-white p-4 shadow-sm text-center"
      >
        <span className="text-sm font-medium text-gray-700">{headlineLabel}</span>
        <p
          className={`mt-1 text-3xl font-bold ${
            headlineValue < 0 ? 'text-red-600' : 'text-green-600'
          }`}
        >
          {money(headlineValue)}
        </p>
      </section>

      <section
        aria-label={t('plan.summary')}
        className="mt-4 rounded-lg bg-white p-4 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{t('plan.total')}</span>
          <span className="text-lg font-bold text-gray-900">
            {money(planTotal(month, items))}
          </span>
        </div>
        {/* Seed only an empty month: on a month that already has items a copy
            would silently duplicate the whole plan. The re-read below guards
            against another member's copy landing first. */}
        {lastMonthItems.length > 0 && monthItems.length === 0 && (
          <button
            type="button"
            onClick={async () => {
              // Work out what would be copied BEFORE the await: a pull or a
              // re-render during the re-read must not change this list under us.
              const toCopy = copyPlanItems(lastMonthItems, month);
              if (!(await canCopy())) return;
              dispatch(addPlanItems(toCopy));
            }}
            className="mt-3 w-full rounded-lg border border-blue-600 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
          >
            {t('plan.copyLastMonth')}
          </button>
        )}
        {copyBlocked && (
          <p role="alert" className="mt-2 text-sm text-amber-700">
            {t('common.copyBlocked')}
          </p>
        )}
        {copyCheckFailed && (
          <p role="alert" className="mt-2 text-sm text-amber-700">
            {t('common.copyCheckFailed')}
          </p>
        )}
      </section>

      <CardCheckIn month={month} />

      <section className="mt-4 rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">{t('plan.buckets')}</h2>

        {monthItems.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">{t('plan.empty')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {monthItems.map((item) => (
              <li key={item.id} className="flex flex-col gap-1 py-2">
                <button
                  type="button"
                  onClick={() => navigate(`/plan/edit/${item.id}`)}
                  aria-label={t('plan.edit', { name: item.name })}
                  className="flex items-center justify-between gap-2 text-left"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                    {item.name}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {money(item.amount)}
                  </span>
                </button>

                {/* The remaining-estimate check-in is the core control loop, so
                    it stays inline — a sibling of the row button, never nested
                    inside it. */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500">{t('plan.remainingEstimateLabel')}</span>
                  <AmountInput
                    id={`estimate-${item.id}`}
                    label={t('plan.remainingEstimate', { name: item.name })}
                    value={item.remainingEstimate}
                    masked={masked}
                    mask={mask}
                    onCommit={(remainingEstimate) =>
                      dispatch(updatePlanItem({ ...item, remainingEstimate }))
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </MonthScaffold>
  );
}
