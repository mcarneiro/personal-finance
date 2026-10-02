import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import MonthScaffold from '../../components/MonthScaffold';
import AmountInput from '../plan/AmountInput';
import NeedsPotRegistryNotice from './NeedsPotRegistryNotice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { deleteSavingsBalance, upsertSavingsBalance } from '../../store/savingsSlice';
import { potBalance } from '../../utils/savings';
import { getMonthName, isValidMonth } from '../../utils/month';

/**
 * The Savings screen for one month: every active pot with an inline editable
 * Savings Balance, the same check-in pattern as the card totals and remaining
 * estimates. Committing a value upserts the month's `savings_balances` row for
 * that pot; clearing the field deletes that month's row so carry-forward
 * resumes; an explicit `0` is a recorded zero (ADR-0011). A pot with no record
 * in the browsed month shows its carried balance, marked with the earlier month
 * it came from; a pot recorded in no month at all shows an empty field and no
 * value is ever fabricated. Pots are a Settings registry — there is no add
 * affordance or editor here. Derived numbers are not stored; the Total Saved
 * headline lands with ticket 05.
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

  return (
    <MonthScaffold basePath="/savings">
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
