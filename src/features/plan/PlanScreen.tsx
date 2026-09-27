import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import MonthScaffold from '../../components/MonthScaffold';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addPlanItem, addPlanItems, deletePlanItem, updatePlanItem } from '../../store/planSlice';
import type { PlanItemKind } from '../../types';
import { planResult, planTotal, projectedResult } from '../../utils/controlLoop';
import { formatCurrency } from '../../utils/currency';
import { generateId } from '../../utils/id';
import { isPastMonth, isValidMonth, shiftMonth } from '../../utils/month';
import { copyPlanItems } from '../../utils/planCopy';
import AmountInput from './AmountInput';
import CardCheckIn from './CardCheckIn';
import PlanItemForm from './PlanItemForm';

const SECTION_KINDS = ['fixed', 'variable'] as const;

/**
 * Per-kind labels for the two sections. Kept as one map instead of repeated
 * ternaries so adding a kind is a single edit.
 */
const SECTION_COPY: Record<
  PlanItemKind,
  { title: string; nameLabel: string; amountLabel: string; submitLabel: string }
> = {
  fixed: {
    title: 'plan.fixedCharges',
    nameLabel: 'plan.fixedNameLabel',
    amountLabel: 'plan.fixedAmountLabel',
    submitLabel: 'plan.addFixedCharge',
  },
  variable: {
    title: 'plan.buckets',
    nameLabel: 'plan.bucketNameLabel',
    amountLabel: 'plan.bucketAmountLabel',
    submitLabel: 'plan.addBucket',
  },
};

/**
 * The Spending Plan screen for one month — the live control loop. It composes
 * the plan (fixed charges, buckets), takes one current-total check-in per card,
 * holds one editable Remaining Estimate per bucket, and headlines the month's
 * result: the live Projected Result for the current month, the final Plan
 * Result for past months. Every derived number comes from the control-loop
 * utilities and is never stored; every mutation syncs through the debounced
 * middleware onto the sheet.
 */
export default function PlanScreen() {
  const { t, i18n } = useTranslation();
  const { month } = useParams<{ month: string }>();
  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.plan.items);
  const cardSpending = useAppSelector((state) => state.plan.cardSpending);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!isValidMonth(month)) {
    // MonthScaffold owns the redirect; nothing to compose until it settles.
    return <MonthScaffold basePath="/plan" title={t('plan.title')} />;
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
    <MonthScaffold basePath="/plan" title={t('plan.title')}>
      <section
        aria-label={headlineLabel}
        className="mt-4 rounded-lg border border-gray-200 bg-white p-4 text-center"
      >
        <span className="text-sm font-medium text-gray-700">{headlineLabel}</span>
        <p
          className={`mt-1 text-3xl font-bold ${
            headlineValue < 0 ? 'text-red-600' : 'text-green-600'
          }`}
        >
          {formatCurrency(headlineValue, i18n.language)}
        </p>
      </section>

      <section
        aria-label={t('plan.summary')}
        className="mt-4 rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{t('plan.total')}</span>
          <span className="text-lg font-bold text-gray-900">
            {formatCurrency(planTotal(month, items), i18n.language)}
          </span>
        </div>
        {/* Seed only an empty month: on a month that already has items a copy
            would silently duplicate the whole plan. */}
        {lastMonthItems.length > 0 && monthItems.length === 0 && (
          <button
            type="button"
            onClick={() => dispatch(addPlanItems(copyPlanItems(lastMonthItems, month)))}
            className="mt-3 w-full rounded-lg border border-blue-600 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
          >
            {t('plan.copyLastMonth')}
          </button>
        )}
      </section>

      <CardCheckIn month={month} />

      {monthItems.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">{t('plan.empty')}</p>
      )}

      {SECTION_KINDS.map((kind: PlanItemKind) => {
        const sectionItems = monthItems.filter((item) => item.kind === kind);
        const copy = SECTION_COPY[kind];

        return (
          <section key={kind} className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">{t(copy.title)}</h2>

            {sectionItems.length > 0 && (
              <ul className="mt-2 divide-y divide-gray-100">
                {sectionItems.map((item) => (
                  <li key={item.id} className="py-2">
                    {editingId === item.id ? (
                      <PlanItemForm
                        formId={`edit-${item.id}`}
                        nameLabel={t('plan.itemNameLabel')}
                        amountLabel={t('plan.itemAmountLabel')}
                        submitLabel={t('plan.save')}
                        initialName={item.name}
                        initialAmount={item.amount}
                        autoFocusName
                        onSubmit={(name, amount) => {
                          dispatch(updatePlanItem({ ...item, name, amount }));
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                            {item.name}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(item.amount, i18n.language)}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingId(item.id)}
                              aria-label={t('plan.edit', { name: item.name })}
                              className="rounded-lg px-2 py-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
                            >
                              {t('plan.editAction')}
                            </button>
                            <button
                              type="button"
                              onClick={() => dispatch(deletePlanItem(item.id))}
                              aria-label={t('plan.remove', { name: item.name })}
                              className="rounded-lg px-2 py-1 text-sm font-medium text-red-600 transition-colors hover:text-red-700"
                            >
                              {t('plan.removeAction')}
                            </button>
                          </div>
                        </div>

                        {item.kind === 'variable' && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-gray-500">
                              {t('plan.remainingEstimateLabel')}
                            </span>
                            <AmountInput
                              id={`estimate-${item.id}`}
                              label={t('plan.remainingEstimate', { name: item.name })}
                              value={item.remainingEstimate}
                              onCommit={(remainingEstimate) =>
                                dispatch(updatePlanItem({ ...item, remainingEstimate }))
                              }
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className={sectionItems.length > 0 ? 'mt-4 border-t border-gray-100 pt-4' : 'mt-3'}>
              <PlanItemForm
                formId={`add-${kind}`}
                nameLabel={t(copy.nameLabel)}
                amountLabel={t(copy.amountLabel)}
                submitLabel={t(copy.submitLabel)}
                onSubmit={(name, amount) =>
                  dispatch(
                    addPlanItem({
                      id: generateId(),
                      month,
                      kind,
                      name,
                      amount,
                      remainingEstimate: 0,
                    })
                  )
                }
              />
            </div>
          </section>
        );
      })}
    </MonthScaffold>
  );
}
