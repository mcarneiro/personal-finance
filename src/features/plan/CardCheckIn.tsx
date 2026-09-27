import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setCardSpendingTotal } from '../../store/planSlice';
import type { Month } from '../../types';
import { totalSpent } from '../../utils/controlLoop';
import { formatCurrency } from '../../utils/currency';
import AmountInput from './AmountInput';

interface CardCheckInProps {
  month: Month;
}

/**
 * The weekly card check-in for one month: one current-total input per registered
 * card, and the Total Spent they sum to, labeled "so far" so it is never
 * mistaken for a final result. Each edit overwrites that card's total in place —
 * deliberately no snapshot history (ADR-0002) — and syncs to the card_spending
 * tab through the debounced middleware.
 */
export default function CardCheckIn({ month }: CardCheckInProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const cards = useAppSelector((state) => state.cards.items);
  const cardSpending = useAppSelector((state) => state.plan.cardSpending);

  return (
    <section
      aria-label={t('plan.checkIn')}
      className="mt-4 rounded-lg border border-gray-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-gray-900">{t('plan.checkIn')}</h2>

      {cards.length === 0 ? (
        <p className="mt-1 text-sm text-gray-600">{t('plan.noCards')}</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100">
          {cards.map((card) => {
            const entry = cardSpending.find(
              (row) => row.month === month && row.cardId === card.id
            );
            return (
              <li key={card.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{card.name}</span>
                <AmountInput
                  id={`card-spending-${card.id}`}
                  label={t('plan.cardSpending', { name: card.name })}
                  value={entry ? entry.total : 0}
                  onCommit={(total) =>
                    dispatch(setCardSpendingTotal({ month, cardId: card.id, total }))
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-sm font-medium text-gray-700">{t('plan.totalSpentSoFar')}</span>
        <span className="text-sm font-semibold text-gray-900">
          {formatCurrency(totalSpent(month, cardSpending), i18n.language)}
        </span>
      </div>
    </section>
  );
}
