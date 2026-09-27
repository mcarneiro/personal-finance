import { ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import MonthNavigation from './MonthNavigation';
import { getCurrentMonth, isValidMonth } from '../utils/month';

interface MonthScaffoldProps {
  /** Base route the month is scoped to, e.g. `/plan`. */
  basePath: string;
  title: string;
  children?: ReactNode;
}

/**
 * Shared month-scoped screen chrome: title plus prev/next month navigation that
 * pushes the adjacent month onto the route. A malformed `:month` param redirects
 * to the current month.
 */
export default function MonthScaffold({ basePath, title, children }: MonthScaffoldProps) {
  const { month } = useParams<{ month: string }>();
  const navigate = useNavigate();

  if (!isValidMonth(month)) {
    return <Navigate to={`${basePath}/${getCurrentMonth()}`} replace />;
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-6">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <MonthNavigation
        currentMonth={month}
        onMonthChange={(nextMonth) => navigate(`${basePath}/${nextMonth}`)}
      />
      {children}
    </div>
  );
}
