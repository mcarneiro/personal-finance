import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import MonthScaffold from '../../components/MonthScaffold';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addIncomeEntries } from '../../store/incomeSlice';
import type { IncomeEntry } from '../../types';
import { incomeTotal } from '../../utils/controlLoop';
import { formatCurrency } from '../../utils/currency';
import { copyIncomeEntries } from '../../utils/incomeCopy';
import { isValidMonth, shiftMonth } from '../../utils/month';

/**
 * The Income screen for one month: entries with an amount and an optional
 * source note, each row opening the full-screen editor, with the month total
 * displayed. The replicate-last-month button copies last month's entries so a
 * recurring salary never has to be retyped. The total is derived by the
 * control-loop utility and never stored; every mutation syncs through the
 * debounced middleware onto the income tab.
 */
export default function IncomeScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { month } = useParams<{ month: string }>();
  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.income.items);

  if (!isValidMonth(month)) {
    // MonthScaffold owns the redirect; nothing to list until it settles.
    return <MonthScaffold basePath="/income" />;
  }

  const monthEntries = items.filter((entry) => entry.month === month);
  const lastMonthEntries = items.filter((entry) => entry.month === shiftMonth(month, -1));

  /** The entry's readable name: its source note, or the amount when unlabeled. */
  const entryLabel = (entry: IncomeEntry) =>
    entry.source || formatCurrency(entry.amount, i18n.language);

  return (
    <MonthScaffold basePath="/income">
      <section
        aria-label={t('income.summary')}
        className="mt-4 rounded-lg bg-white p-4 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{t('income.total')}</span>
          <span className="text-lg font-bold text-gray-900">
            {formatCurrency(incomeTotal(month, items), i18n.language)}
          </span>
        </div>
        {/* Replicate only into an empty month: on a month that already has
            entries it would silently duplicate the whole list. */}
        {lastMonthEntries.length > 0 && monthEntries.length === 0 && (
          <button
            type="button"
            onClick={() => dispatch(addIncomeEntries(copyIncomeEntries(lastMonthEntries, month)))}
            className="mt-3 w-full rounded-lg border border-blue-600 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
          >
            {t('income.copyLastMonth')}
          </button>
        )}
      </section>

      {monthEntries.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">{t('income.empty')}</p>
      )}

      {monthEntries.length > 0 && (
        <section className="mt-4 rounded-lg bg-white p-4 shadow-sm">
          <ul className="divide-y divide-gray-100">
            {monthEntries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/income/edit/${entry.id}`)}
                  aria-label={t('income.edit', { name: entryLabel(entry) })}
                  className="flex w-full items-center justify-between gap-2 py-2 text-left"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                    {entry.source || t('income.noSource')}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(entry.amount, i18n.language)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </MonthScaffold>
  );
}
