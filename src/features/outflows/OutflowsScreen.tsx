import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import MonthScaffold from '../../components/MonthScaffold';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addOutflows, toggleOutflowPaid } from '../../store/outflowsSlice';
import { accountNet, outflowsTotal, incomeTotal } from '../../utils/controlLoop';
import { outflowsByPayerAndBank, type BankTotal, type PayerGroup } from '../../utils/outflowSummary';
import { orderOutflows } from '../../utils/outflowOrder';
import {
  EMPTY_OUTFLOW_FILTER,
  outflowFilterCount,
  outflowFilterOptions,
  filterOutflows,
  isOutflowFilterEmpty,
  parseOutflowFilter,
  type OutflowFilter,
} from '../../utils/outflowFilter';
import { copyOutflows } from '../../utils/outflowCopy';
import { formatCurrency } from '../../utils/currency';
import { isValidMonth, shiftMonth } from '../../utils/month';
import { useCopyGuard } from '../../hooks/useCopyGuard';
import { usePersistentState } from '../../hooks/usePersistentState';
import { usePersistentToggle } from '../../hooks/usePersistentToggle';
import { useRegistryLabels } from '../../hooks/useRegistryLabels';
import NeedsRegistryNotice from './NeedsRegistryNotice';
import OutflowFilterDrawer from './OutflowFilterDrawer';
import OutflowRow from './OutflowRow';

/**
 * The Outflows screen for one month: payment obligations added by hand (name,
 * amount, payer, bank — the card bill is just another outflow with its real
 * statement value), each with a paid toggle, plus the month's outflows total,
 * income total and the account net (income − outflows). The income total is a
 * shortcut to the same month on the Income screen. Below the totals sits the
 * by-payer spending summary, collapsed by default, then the month's outflows
 * ordered final-first, open-first and alphabetically. A outflow whose value is not
 * final is flagged with a warning before its name and sinks to the bottom, so a
 * replicated month gathers the variable amounts still needing review. A small
 * filter icon between the summary and the list opens a right-side drawer that
 * narrows the list by payer and/or bank (OR within a facet, AND across facets);
 * that filter is view state only — a device preference remembered locally, so
 * it is restored on the next visit and never touches the totals or the summary,
 * which always keep the full month. The applied filters are spelled out beside
 * the icon so the list is never silently narrowed. The by-payer summary's
 * expanded state and its swap of each payer's and bank's value to what is still
 * to pay are both remembered locally. The replicate-last-month button copies
 * last month's obligations so recurring outflows need no retyping; the copies
 * arrive open and not final (never pre-paid or pre-confirmed) and can be edited
 * freely. The derived numbers come from the control-loop utilities and the
 * outflow-summary utility and are never stored; every mutation syncs through the
 * debounced middleware onto the outflows tab.
 */
export default function OutflowsScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { month } = useParams<{ month: string }>();
  const dispatch = useAppDispatch();
  const outflows = useAppSelector((state) => state.outflows.items);
  const income = useAppSelector((state) => state.income.items);
  const banks = useAppSelector((state) => state.banks.items);
  const payers = useAppSelector((state) => state.payers.items);
  // The by-payer summary starts folded so the month's outflows — the thing being
  // checked off — lead the page; the totals stay visible as the section header.
  // Whether it is open is a device preference, so it is remembered locally.
  const [summaryOpen, toggleSummaryOpen] = usePersistentToggle('planyoo:outflows:summaryOpen');
  // The payer/bank filter is pure view state: it never reaches Redux or the
  // sheet. It is a device preference remembered locally, so a selection made in
  // one visit — or one month — is restored on the next.
  const [filter, setFilter] = usePersistentState<OutflowFilter>(
    'planyoo:outflows:filter',
    EMPTY_OUTFLOW_FILTER,
    parseOutflowFilter
  );
  const [filterOpen, setFilterOpen] = useState(false);
  // Whether the by-payer summary also shows what is still to pay per payer and
  // bank. A local display preference, not a derived number, so it is remembered
  // on this device only.
  const [showRemaining, toggleShowRemaining] = usePersistentToggle(
    'planyoo:outflows:showRemaining'
  );
  // Re-read the target month right before replicating so a copy another member
  // already made is never duplicated (ADR-0008).
  const { blocked: copyBlocked, checkFailed: copyCheckFailed, canCopy } = useCopyGuard(
    'outflows',
    month
  );
  // Resolve payer/bank names the same way the Dashboard does.
  const { payerLabel, bankLabel } = useRegistryLabels();

  if (!isValidMonth(month)) {
    // MonthScaffold owns the redirect; nothing to list until it settles.
    return <MonthScaffold basePath="/outflows" />;
  }

  const monthOutflows = outflows.filter((outflow) => outflow.month === month);
  const lastMonthOutflows = outflows.filter((outflow) => outflow.month === shiftMonth(month, -1));
  const net = accountNet(month, income, outflows);
  const spending = outflowsByPayerAndBank(month, outflows, banks, payers);
  const filterOptions = outflowFilterOptions(monthOutflows, banks, payers);
  const filterActive = !isOutflowFilterEmpty(filter);
  const visibleOutflows = orderOutflows(filterOutflows(monthOutflows, filter), i18n.language);

  // One line per active facet, naming every selected reference. Kept short and
  // stacked so the block stays no taller than the filter button beside it.
  const activeFilterLines: string[] = [];
  if (filter.payerIds.length > 0) {
    activeFilterLines.push(
      t('outflows.filterActivePayer', { names: filter.payerIds.map(payerLabel).join(', ') })
    );
  }
  if (filter.bankIds.length > 0) {
    activeFilterLines.push(
      t('outflows.filterActiveBank', { names: filter.bankIds.map(bankLabel).join(', ') })
    );
  }

  const registryReady = payers.length > 0 && banks.length > 0;

  return (
    <MonthScaffold basePath="/outflows">
      <section
        aria-label={t('outflows.summary')}
        className="mt-4 rounded-lg bg-white p-4 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{t('outflows.outflowsTotal')}</span>
          <span className="text-sm font-medium text-gray-900">
            {formatCurrency(outflowsTotal(month, outflows), i18n.language)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/income/${month}`)}
          aria-label={t('outflows.viewIncome')}
          className="mt-2 flex w-full items-center justify-between rounded-md text-left transition-colors hover:bg-gray-50"
        >
          <span className="text-sm text-gray-700">{t('outflows.incomeTotal')}</span>
          <span className="text-sm font-medium text-blue-600">
            {formatCurrency(incomeTotal(month, income), i18n.language)}
          </span>
        </button>
        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="text-sm font-medium text-gray-700">{t('outflows.accountNet')}</span>
          <span className="text-lg font-bold text-gray-900">
            {formatCurrency(net, i18n.language)}
          </span>
        </div>
        {/* Replicate only into an empty month: on a month that already has
            outflows it would silently duplicate the whole list. The re-read below
            guards against another member's copy landing first. */}
        {lastMonthOutflows.length > 0 && monthOutflows.length === 0 && (
          <button
            type="button"
            onClick={async () => {
              // Work out what would be copied BEFORE the await: a pull or a
              // re-render during the re-read must not change this list under us.
              const toCopy = copyOutflows(lastMonthOutflows, month);
              if (!(await canCopy())) return;
              dispatch(addOutflows(toCopy));
            }}
            className="mt-3 w-full rounded-lg border border-blue-600 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
          >
            {t('outflows.copyLastMonth')}
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

      <section
        aria-label={t('outflows.byPayerSummary')}
        className="mt-4 rounded-lg bg-white p-4 shadow-sm"
      >
        <h2>
          <button
            type="button"
            onClick={toggleSummaryOpen}
            aria-expanded={summaryOpen}
            aria-controls="by-payer-summary"
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="text-sm font-semibold text-gray-900">
              {t('outflows.byPayerSummary')}
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${
                summaryOpen ? 'rotate-180' : ''
              }`}
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </h2>

        {summaryOpen && (
          <div id="by-payer-summary">
            {spending.length === 0 ? (
              <p className="mt-1 text-sm text-gray-600">{t('outflows.byPayerEmpty')}</p>
            ) : (
              <>
                <ul className="mt-2 divide-y divide-gray-100">
                  {spending.map((group) => (
                    <li key={group.payerId || '__unassigned__'} className="py-2">
                      <PayerGroupRow
                        group={group}
                        locale={i18n.language}
                        payerLabel={payerLabel}
                        bankLabel={bankLabel}
                        showRemaining={showRemaining}
                      />
                    </li>
                  ))}
                </ul>
                <label className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={showRemaining}
                    onChange={toggleShowRemaining}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  {t('outflows.showRemaining')}
                </label>
              </>
            )}
          </div>
        )}
      </section>

      {monthOutflows.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">{t('outflows.empty')}</p>
      )}

      {monthOutflows.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-2">
          {/* The active filters sit on the left, stacked and small, so the row
              never grows past the filter button beside it. */}
          <div className="min-w-0 flex-1 space-y-0.5">
            {activeFilterLines.map((line) => (
              <p key={line} className="truncate text-[11px] leading-tight text-gray-500">
                {line}
              </p>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {filterActive && (
              <button
                type="button"
                onClick={() => setFilter(EMPTY_OUTFLOW_FILTER)}
                className="text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700"
              >
                {t('outflows.filterClearAll')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              aria-label={t('outflows.filterOpen')}
              aria-expanded={filterOpen}
              aria-controls="outflow-filter"
              className="relative rounded-lg border border-gray-300 bg-white p-2 text-gray-600 transition-colors hover:bg-gray-50"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M7 12h10M10 18h4"
                />
              </svg>
              {filterActive && (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white"
                >
                  {outflowFilterCount(filter)}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {monthOutflows.length > 0 && (
        <section aria-label={t('outflows.title')} className="mt-4 rounded-lg bg-white p-4 shadow-sm">
          {visibleOutflows.length === 0 ? (
            <p className="text-sm text-gray-500">{t('outflows.filterEmpty')}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {visibleOutflows.map((outflow) => (
                <OutflowRow
                  key={outflow.id}
                  outflow={outflow}
                  locale={i18n.language}
                  payerLabel={payerLabel}
                  bankLabel={bankLabel}
                  onTogglePaid={(id) => dispatch(toggleOutflowPaid(id))}
                  onEdit={(id) => navigate(`/outflows/edit/${id}`)}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {!registryReady && (
        <div className="mt-4">
          <NeedsRegistryNotice />
        </div>
      )}

      {filterOpen && (
        <OutflowFilterDrawer
          options={filterOptions}
          value={filter}
          payerLabel={payerLabel}
          bankLabel={bankLabel}
          onApply={(next) => {
            setFilter(next);
            setFilterOpen(false);
          }}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </MonthScaffold>
  );
}

/** One payer's line with its per-bank breakdown, optionally reading what is left to pay. */
function PayerGroupRow({
  group,
  locale,
  payerLabel,
  bankLabel,
  showRemaining,
}: {
  group: PayerGroup;
  locale: string;
  payerLabel: (id: string) => string;
  bankLabel: (id: string) => string;
  showRemaining: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">{payerLabel(group.payerId)}</span>
        <span className="text-sm font-medium text-gray-900">
          {formatCurrency(showRemaining ? group.remaining : group.total, locale)}
        </span>
      </div>
      <ul className="mt-1 space-y-1">
        {group.banks.map((line: BankTotal) => (
          <li
            key={line.bankId || '__nobank__'}
            className="flex items-center justify-between pl-4"
          >
            <span className="text-xs text-gray-600">{bankLabel(line.bankId)}</span>
            <span className="text-xs text-gray-600">
              {formatCurrency(showRemaining ? line.remaining : line.total, locale)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
