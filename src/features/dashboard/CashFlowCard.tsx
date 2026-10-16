import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { formatDisplayAmount } from '../../utils/currency';
import {
  type CashFlowBar,
  type CashFlowLevel,
  type CashFlowSlice,
} from '../../utils/cashFlowBar';
import { usePrivacyMode } from '../../contexts/privacyMode';

/**
 * The cash-flow bar's slice colours. A Payment takes the bar's own green,
 * turning red once the month is over income; an Investment is the app's button
 * blue; an unconfirmed slice is the lighter tint of its kind's colour. Held here
 * with `sliceColor`, the way `potPalette` holds the savings palette.
 */
const CASH_FLOW_SLICE_COLOR = {
  paymentUnder: 'bg-green-500',
  paymentOver: 'bg-red-600',
  paymentUnderUnconfirmed: 'bg-green-300',
  paymentOverUnconfirmed: 'bg-red-300',
  investment: 'bg-blue-600',
  investmentUnconfirmed: 'bg-blue-300',
} as const;

/** The bar class for one slice, given the month's under/over level. */
function sliceColor(slice: CashFlowSlice, level: CashFlowLevel): string {
  if (slice.kind === 'investment') {
    return slice.confirmed
      ? CASH_FLOW_SLICE_COLOR.investment
      : CASH_FLOW_SLICE_COLOR.investmentUnconfirmed;
  }
  if (level === 'over') {
    return slice.confirmed
      ? CASH_FLOW_SLICE_COLOR.paymentOver
      : CASH_FLOW_SLICE_COLOR.paymentOverUnconfirmed;
  }
  return slice.confirmed
    ? CASH_FLOW_SLICE_COLOR.paymentUnder
    : CASH_FLOW_SLICE_COLOR.paymentUnderUnconfirmed;
}

/** The translation key naming one slice by its kind and confirmation state. */
function sliceLabelKey(slice: CashFlowSlice): string {
  if (slice.kind === 'investment') {
    return slice.confirmed ? 'outflows.barInvestmentConfirmed' : 'outflows.barInvestmentUnconfirmed';
  }
  return slice.confirmed ? 'outflows.barPaymentConfirmed' : 'outflows.barPaymentUnconfirmed';
}

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
  /**
   * The bar's composition, computed by the caller from the month's outflows:
   * the four kind-and-state slices in their fixed order, zero slices already
   * dropped. Each slice's width is its share of the Outflows Total, so the
   * slices always fill the drawn bar whether the month is under or over income.
   */
  slices: CashFlowSlice[];
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
 * The bar is the month's outflow composition — up to four slices, confirmed
 * Payments then unconfirmed Payments then confirmed Investments then
 * unconfirmed Investments, each sized by its share of the Outflows Total — while
 * the fill's own width stays Outflows / Income, capped at the whole income.
 * The Dashboard renders it as its own block with the heading and the
 * over-income caption; the Outflows page renders the same numbers and the same
 * bar with no heading (its page already names the month) and no caption (it
 * would link to the screen it is on), taking the children slot for the Replicate
 * button and the copy notices. Income leads, then outflows, then the bar, then
 * Account Net, on both screens. The bar and its slices are computed by the caller
 * and only their percentages and colours are derived here; the bar's accessible
 * label names the composition, and there is deliberately no visible legend. Every
 * amount is a display value, so Privacy Mode masks them without touching the
 * numbers behind them; the bar's proportions stay real. No other derived number
 * is computed or stored here.
 */
export default function CashFlowCard({
  month,
  income,
  outflows,
  net,
  bar,
  slices,
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

  // The bar's accessible name spells out the month's composition; with no slices
  // (an empty month) it falls back to the plain Outflows Total label.
  const barLabel =
    slices.length === 0
      ? t('outflows.outflowsTotal')
      : t('outflows.barComposition', {
          parts: slices
            .map((slice) => `${t(sliceLabelKey(slice))} ${Math.round(slice.share * 100)}%`)
            .join(', '),
        });

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

      {/* The fill is Outflows / Income, capped at the whole income; the slices
          inside it are each kind-and-state's share of the Outflows Total, so
          they always add up to the drawn bar. */}
      <div
        role="progressbar"
        aria-label={barLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={fillPercent}
        className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100"
      >
        <div
          className="flex h-full overflow-hidden rounded-full"
          style={{ width: `${fillPercent}%` }}
        >
          {slices.map((slice) => (
            <div
              key={`${slice.kind}-${slice.confirmed}`}
              className={sliceColor(slice, bar.level)}
              style={{ width: `${slice.share * 100}%` }}
            />
          ))}
        </div>
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
