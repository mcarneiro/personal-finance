import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import MonthScaffold from '../../components/MonthScaffold';
import AmountInput from '../plan/AmountInput';
import NeedsPotRegistryNotice from './NeedsPotRegistryNotice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { deleteSavingsBalance, upsertSavingsBalance } from '../../store/savingsSlice';
import { potBalance, savingsDelta, totalSaved } from '../../utils/savings';
import { formatCurrency } from '../../utils/currency';
import { getMonthName, isValidMonth } from '../../utils/month';

/**
 * The Savings screen for one month: the Total Saved headline, then every active
 * pot with an inline editable Savings Balance, the same check-in pattern as the
 * card totals and remaining estimates. Committing a value upserts the month's
 * `savings_balances` row for that pot; clearing the field deletes that month's
 * row so carry-forward resumes; an explicit `0` is a recorded zero (ADR-0011).
 * A pot with no record in the browsed month shows its carried balance, marked
 * with the earlier month it came from; a pot recorded in no month at all shows
 * an empty field and no value is ever fabricated. Pots are a Settings registry —
 * there is no add affordance or editor here.
 *
 * Total Saved is derived live by `totalSaved` from the active pots' carried
 * balances and never stored (ADR-0011): it drops by a pot's carried balance the
 * moment that pot is retired, and falls back to the carried value the moment a
 * month's record is cleared. Below it, `savingsDelta` shows how the total moved
 * from the previous month — percentage and absolute value, green when growing
 * and red when falling — with the percentage omitted when the previous month had
 * no savings to compare against. There is deliberately no target or goal
 * progress, and a short line states that savings are independent of income,
 * outflows and Account Net.
 */
export default function SavingsScreen() {
  const { t, i18n } = useTranslation();
  const { month } = useParams<{ month: string }>();
  const dispatch = useAppDispatch();
  const pots = useAppSelector((state) => state.savings.items);
  const balances = useAppSelector((state) => state.savings.balances);

  if (!isValidMonth(month)) {
    // MonthScaffold owns the redirect; nothing to list until it settles.
    return <MonthScaffold basePath="/savings" />;
  }

  if (pots.length === 0) {
    return (
      <MonthScaffold basePath="/savings">
        <NeedsPotRegistryNotice />
      </MonthScaffold>
    );
  }

  const total = totalSaved(month, pots, balances);

  // The headline's month-over-month change, also pure and never stored. Nothing
  // is shown until the household has a balance somewhere: with both months empty
  // there is no comparison to make. When the previous month was itself empty the
  // percentage is undefined and only the absolute change is shown.
  const delta = savingsDelta(month, pots, balances);
  const hasComparison = delta.percent !== null || delta.absolute !== 0;
  const deltaDirection = Math.sign(delta.absolute);
  const deltaTone =
    deltaDirection > 0
      ? 'text-green-600'
      : deltaDirection < 0
        ? 'text-red-600'
        : 'text-gray-500';
  const deltaArrow = deltaDirection > 0 ? '↑' : deltaDirection < 0 ? '↓' : '→';
  const deltaDirectionLabel =
    deltaDirection > 0
      ? t('savings.increase')
      : deltaDirection < 0
        ? t('savings.decrease')
        : t('savings.noChange');
  const deltaAmount = formatCurrency(Math.abs(delta.absolute), i18n.language);
  const deltaPercent =
    delta.percent === null
      ? null
      : new Intl.NumberFormat(i18n.language, {
          style: 'percent',
          maximumFractionDigits: 1,
        }).format(Math.abs(delta.percent) / 100);

  return (
    <MonthScaffold basePath="/savings">
      {/* Total Saved is a derived number: never stored in state or the sheet,
          summed from the active pots' carried balances (ADR-0011). The scope
          line keeps savings from being read as part of the account ledger. */}
      <section
        aria-label={t('savings.summary')}
        className="mt-4 rounded-lg bg-white p-4 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{t('savings.total')}</span>
          <span data-testid="savings-total" className="text-lg font-bold text-gray-900">
            {formatCurrency(total, i18n.language)}
          </span>
        </div>
        {/* The change from the previous month, derived by `savingsDelta` on the
            same carried balances as the headline. The arrow and the screen-reader
            direction word carry the sign; the amount is shown unsigned so it is
            never double-signed. */}
        {hasComparison && (
          <p data-testid="savings-delta" className={`mt-1 text-sm font-medium ${deltaTone}`}>
            <span className="sr-only">{deltaDirectionLabel}</span>
            <span aria-hidden="true">{deltaArrow}</span>{' '}
            {deltaPercent ? `${deltaPercent} · ` : ''}
            {deltaAmount}{' '}
            <span className="font-normal text-gray-500">{t('savings.vsPrevious')}</span>
          </p>
        )}
        <p className="mt-2 text-xs leading-tight text-gray-500">{t('savings.independent')}</p>
      </section>

      <section
        aria-label={t('savings.title')}
        className="mt-4 rounded-lg bg-white p-4 shadow-sm"
      >
        <ul className="divide-y divide-gray-100">
          {pots.map((pot) => {
            const record = balances.find(
              (row) => row.month === month && row.potId === pot.id
            );
            const carried = potBalance(month, pot.id, balances);
            const carriedForward = carried !== undefined && carried.sourceMonth !== month;
            return (
              <li key={pot.id} className="flex items-start justify-between gap-2 py-2">
                <span className="min-w-0 flex-1 truncate pt-2 text-sm text-gray-900">
                  {pot.name}
                </span>
                <div className="flex flex-col items-end gap-1">
                  <AmountInput
                    id={`savings-balance-${pot.id}`}
                    label={t('savings.balanceLabel', { name: pot.name })}
                    value={carried?.balance ?? 0}
                    hasValue={carried !== undefined}
                    onCommit={(balance) =>
                      dispatch(upsertSavingsBalance({ month, potId: pot.id, balance }))
                    }
                    onClear={() => {
                      if (record) dispatch(deleteSavingsBalance(record.id));
                    }}
                  />
                  {/* Name the earlier month the carried value came from; the
                      browsed month's own record is not marked. */}
                  {carriedForward && carried && (
                    <span className="text-[11px] leading-tight text-gray-500">
                      {t('savings.lastUpdated', {
                        month: getMonthName(carried.sourceMonth, i18n.language),
                      })}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </MonthScaffold>
  );
}
