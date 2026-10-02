import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import BlockHeader from '../../components/BlockHeader';
import { useAppSelector } from '../../store/hooks';
import { formatCurrency } from '../../utils/currency';
import { getCurrentMonth, getMonthName, getShortMonthName } from '../../utils/month';
import { potTrendSeries, trendMaxTotals, trendTotal, trendWindow } from '../../utils/savingsTrend';
import { POT_PALETTE } from './potPalette';

interface SavingsTrendProps {
  /**
   * The clock the window ends on. Defaults to the real now; injectable so tests
   * can pin the current month.
   */
  now?: Date;
}

/**
 * The last Dashboard block: the household's savings trend over the rolling
 * 12 months ending with the current month, one stacked column per month, oldest
 * first, coloured by pot. Every number comes from `utils/savingsTrend` — this
 * component computes nothing but bar percentages — and the column height always
 * equals the Savings screen's Total Saved (ADR-0011), retired pots included in
 * neither.
 *
 * The section hides when there are no active pots or no recorded balance
 * anywhere in the window, the way the plan block hides when Plan Total is
 * zero: an empty household sees nothing rather than twelve invented columns.
 * The header is the only link and always opens the current month, so the
 * Dashboard stays current-month-only; there is no chart library, no y-axis, no
 * gridlines and no legend.
 */
export default function SavingsTrend({ now = new Date() }: SavingsTrendProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const month = getCurrentMonth(now);

  const pots = useAppSelector((state) => state.savings.items);
  const balances = useAppSelector((state) => state.savings.balances);

  const window = trendWindow(month);
  const maxTotals = trendMaxTotals(window, pots, balances);

  // No pots to chart, or nothing recorded to chart yet.
  if (pots.length === 0 || maxTotals === 0) return null;

  return (
    <section aria-label={t('home.savingsTrend')} className="mt-4 rounded-lg bg-white p-4 shadow-sm">
      <BlockHeader label={t('home.savingsTrend')} onClick={() => navigate(`/savings/${month}`)} />

      {/* 12 zero-based stacked columns, plain CSS/flex like the other Dashboard
          bars. Heights are percentages over the tallest stacked total, so the
          tallest column fills the track and no segment overflows its column. */}
      <div className="mt-4 flex h-24 items-end gap-1">
        {window.map((trendMonth) => {
          const total = trendTotal(trendMonth, pots, balances);
          const segments = potTrendSeries(trendMonth, pots, balances);
          // `total` never exceeds `maxTotals` and each segment never exceeds
          // `total`, so the column and its segments are already within bounds;
          // the clamp and the fill's `overflow-hidden` just make that explicit.
          const columnPercent = Math.min(100, (total / maxTotals) * 100);
          const label = t('home.savingsColumn', {
            month: getMonthName(trendMonth, i18n.language),
            amount: formatCurrency(total, i18n.language),
          });

          return (
            <div
              key={trendMonth}
              role="img"
              aria-label={label}
              className="flex h-full flex-1 flex-col justify-end"
            >
              <div
                data-column-fill
                className="flex w-full flex-col-reverse overflow-hidden rounded-sm"
                style={{ height: `${columnPercent}%` }}
              >
                {segments.map((segment, index) => (
                  <div
                    key={segment.potId}
                    data-testid="trend-segment"
                    className={POT_PALETTE[index % POT_PALETTE.length]}
                    style={{ height: total > 0 ? `${(segment.value / total) * 100}%` : '0%' }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Short month labels under the columns, oldest to newest. */}
      <div className="mt-1 flex gap-1">
        {window.map((trendMonth) => (
          <span key={trendMonth} className="flex-1 text-center text-[10px] text-gray-500">
            {getShortMonthName(trendMonth, i18n.language)}
          </span>
        ))}
      </div>
    </section>
  );
}
