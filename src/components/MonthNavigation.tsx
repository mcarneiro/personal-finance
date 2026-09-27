import { useTranslation } from 'react-i18next';
import { getMonthName, shiftMonth } from '../utils/month';

interface MonthNavigationProps {
  currentMonth: string;
  onMonthChange: (month: string) => void;
}

export default function MonthNavigation({ currentMonth, onMonthChange }: MonthNavigationProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex items-center justify-center gap-3 py-4">
      <button
        type="button"
        onClick={() => onMonthChange(shiftMonth(currentMonth, -1))}
        aria-label={t('common.previousMonth')}
        className="rounded-lg p-2 transition-colors hover:bg-gray-100"
      >
        <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>

      <h2 className="min-w-[200px] text-center text-lg font-bold capitalize text-gray-900">
        {getMonthName(currentMonth, i18n.language)}
      </h2>

      <button
        type="button"
        onClick={() => onMonthChange(shiftMonth(currentMonth, 1))}
        aria-label={t('common.nextMonth')}
        className="rounded-lg p-2 transition-colors hover:bg-gray-100"
      >
        <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
