import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import BlockHeader from '../../components/BlockHeader';
import { useAppSelector } from '../../store/hooks';
import type { Month } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { getCurrentMonth, getMonthName, getShortMonthName } from '../../utils/month';
import { potTrendSeries, trendMaxTotals, trendTotal, trendWindow } from '../../utils/savingsTrend';
import { potPaletteClass } from './potPalette';

/** The id the expanded column points at with `aria-controls`. */
const READOUT_ID = 'savings-trend-readout';

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
 * Each column is a button: tapping it toggles a readout beneath the chart for
 * that month — the full month name, its Total Saved, and one row per active pot
 * (swatch, name, carried balance) in registry order, so the readout doubles as
 * the legend the stack deliberately omits. A pot contributing `0` still lists,
 * muted, because the registry is the household's list of pots; a carried month
 * is shown indistinguishably (an accepted residual of the spec). The readout is
 * display-only — it never navigates, and the header stays the only link — so the
 * Dashboard remains current-month-only.
 *
 * The section hides when there are no active pots or no recorded balance
 * anywhere in the window, the way the plan block hides when Plan Total is
 * zero: an empty household sees nothing rather than twelve invented columns.
 * There is no chart library, no y-axis, no gridlines and no separate legend.
 */
export default function SavingsTrend({ now = new Date() }: SavingsTrendProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const month = getCurrentMonth(now);

  const pots = useAppSelector((state) => state.savings.items);
  const balances = useAppSelector((state) => state.savings.balances);

  const [selectedMonth, setSelectedMonth] = useState<Month | null>(null);

  const window = trendWindow(month);
  const maxTotals = trendMaxTotals(window, pots, balances);

  // No pots to chart, or nothing recorded to chart yet.
  if (pots.length === 0 || maxTotals === 0) return null;

  const potNames = new Map(pots.map((pot) => [pot.id, pot.name]));
  const selectedSegments = selectedMonth ? potTrendSeries(selectedMonth, pots, balances) : [];

  return (
    <section aria-label={t('home.savingsTrend')} className="mt-4 rounded-lg bg-white p-4 shadow-sm">
      <BlockHeader label={t('home.savingsTrend')} onClick={() => navigate(`/savings/${month}`)} />

      {/* 12 zero-based stacked columns, plain CSS/flex like the other Dashboard
          bars. Heights are percentages over the tallest stacked total, so the
          tallest column fills the track and no segment overflows its column.
          Each column is a button that toggles the month readout below. */}
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
          const isSelected = selectedMonth === trendMonth;

          return (
            <button
              key={trendMonth}
              type="button"
              data-testid="trend-column"
              aria-label={label}
              aria-expanded={isSelected}
              aria-controls={isSelected ? READOUT_ID : undefined}
              onClick={() =>
                setSelectedMonth((current) => (current === trendMonth ? null : trendMonth))
              }
              className="flex h-full flex-1 flex-col justify-end"
            >
              <span
                data-column-fill
                className="flex w-full flex-col-reverse overflow-hidden rounded-sm"
                style={{ height: `${columnPercent}%` }}
              >
                {segments.map((segment, index) => (
                  <span
                    key={segment.potId}
                    data-testid="trend-segment"
                    className={potPaletteClass(index)}
                    style={{ height: total > 0 ? `${(segment.value / total) * 100}%` : '0%' }}
                  />
                ))}
              </span>
            </button>
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

      {/* The tapped month's readout, beneath the chart. Display-only: it is the
          per-pot breakdown the stack is made of, and the legend the chart does
          not draw. A carried month is indistinguishable here by design. */}
      {selectedMonth && (
        <div
          id={READOUT_ID}
          data-testid="readout"
          role="group"
          aria-label={t('home.savingsReadout', {
            month: getMonthName(selectedMonth, i18n.language),
          })}
          className="mt-3 border-t border-gray-100 pt-3"
        >
          <h3 className="text-sm font-semibold text-gray-900">
            {getMonthName(selectedMonth, i18n.language)}
          </h3>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{t('savings.total')}</span>
            <span data-testid="readout-total" className="text-lg font-bold text-gray-900">
              {formatCurrency(trendTotal(selectedMonth, pots, balances), i18n.language)}
            </span>
          </div>
          <ul className="mt-2 divide-y divide-gray-100">
            {selectedSegments.map((segment, index) => {
              // A registered pot with no record yet still lists, muted, rather
              // than silently vanishing from the household's registry.
              const muted = segment.value === 0;
              return (
                <li
                  key={segment.potId}
                  data-testid="readout-row"
                  className="flex items-center justify-between gap-2 py-1.5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      data-testid="readout-swatch"
                      aria-hidden="true"
                      className={`h-3 w-3 shrink-0 rounded-sm ${potPaletteClass(index)}`}
                    />
                    <span className="truncate text-sm text-gray-900">
                      {potNames.get(segment.potId)}
                    </span>
                  </span>
                  <span
                    data-testid="readout-value"
                    className={`shrink-0 text-sm font-medium ${
                      muted ? 'text-gray-400' : 'text-gray-900'
                    }`}
                  >
                    {formatCurrency(segment.value, i18n.language)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
