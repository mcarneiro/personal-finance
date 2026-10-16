import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { formatDisplayAmount } from '../../utils/currency';
import { type CashFlowBar, type CashFlowLevel } from '../../utils/cashFlowBar';
import { usePrivacyMode } from '../../contexts/privacyMode';

/** The cash-flow bar's colour per level. */
const CASH_FLOW_BAR_COLOR: Record<CashFlowLevel, string> = {
  under: 'bg-green-500',
  over: 'bg-red-600',
};

export interface CashFlowCardProps {
  /** The browsed month, carried by the two row shortcuts. */
  month: string;
  /** The month's Income Total. */
  income: number;
  /** The month's Outflows Total. */
  outflows: number;
  /** The month's Account Net (income − outflows). */
  net: number;
  /** The bar, computed by the caller; only its percentage and colour are worked out here. */
  bar: CashFlowBar;
  /** The card's accessible name; also drawn as the visible heading when `showHeading`. */
  label: string;
  /** Whether the label is drawn as a heading. The Dashboard shows it; the Outflows page omits it. */
  showHeading?: boolean;
  /** Whether the over-income caption shows under the bar when over. Dashboard-only. */
  showOverCaption?: boolean;
  /** Content placed just below the numbers (the Outflows page's Replicate and notices). */
  children?: ReactNode;
}

/**
 * The shared income-and-outflows card: the month's Income Total, its Outflows
 * Total, the bar filled by the outflows toward the income and the Account Net.
 * The Dashboard renders it as its own block with the heading and the
 * over-income caption; the Outflows page renders the same numbers and the same
 * bar with no heading (its page already names the month) and no caption (it
 * would link to the screen it is on), taking the children slot for the Replicate
 * button and the copy notices. Income leads, then outflows, then the bar, then
 * Account Net, on both screens. The bar is computed by the caller and only its
 * percentage and colour are derived here; every amount is a display value, so
 * Privacy Mode masks them without touching the numbers behind them. No other
 * derived number is computed or stored here.
 */
export default function CashFlowCard({
  month,
  income,
  outflows,
  net,
  bar,
  label,
  showHeading = false,
  showOverCaption = false,
  children,
}: CashFlowCardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  // Each amount is a display value: Privacy Mode masks it without touching the
  // derived numbers the caller computed.
  const { masked, mask } = usePrivacyMode();
  const money = (amount: number) => formatDisplayAmount(amount, i18n.language, masked, mask);

  const fillPercent = Math.round(bar.ratio * 100);
  const barColor = CASH_FLOW_BAR_COLOR[bar.level];

  return (
    <section aria-label={label} className="mt-4 rounded-lg bg-white p-4 shadow-sm">
      {showHeading && <h2 className="text-sm font-semibold text-gray-900">{label}</h2>}
      <div className={showHeading ? 'mt-3' : undefined}>
        <button
          type="button"
          onClick={() => navigate(`/income/${month}`)}
          aria-label={t('home.viewIncome')}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-sm text-gray-700">{t('outflows.incomeTotal')}</span>
          <span className="text-sm font-medium text-gray-900">{money(income)}</span>
        </button>
        <button
          type="button"
          onClick={() => navigate(`/outflows/${month}`)}
          aria-label={t('home.viewOutflows')}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-sm text-gray-700">{t('outflows.outflowsTotal')}</span>
          <span className="text-sm font-medium text-gray-900">{money(outflows)}</span>
        </button>
      </div>

      {/* The bar fills with the month's outflows toward the income ceiling and
          stops at it; it turns red and caps once outflows pass the income. */}
      <div
        role="progressbar"
        aria-label={t('outflows.outflowsTotal')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={fillPercent}
        className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100"
      >
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${fillPercent}%` }}
        />
      </div>

      {showOverCaption && bar.level === 'over' && (
        <button
          type="button"
          onClick={() => navigate(`/outflows/${month}`)}
          className="mt-2 text-left text-sm font-medium text-red-700"
        >
          {t('home.cashFlowOver', { amount: money(-net) })}
        </button>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-sm font-medium text-gray-700">{t('outflows.accountNet')}</span>
        <span className="text-lg font-bold text-gray-900">{money(net)}</span>
      </div>

      {children}
    </section>
  );
}
