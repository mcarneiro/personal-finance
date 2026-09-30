import { ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import MonthNavigation from './MonthNavigation';
import { getCurrentMonth, isValidMonth } from '../utils/month';

interface MonthScaffoldProps {
  /** Base route the month is scoped to, e.g. `/plan`. */
  basePath: string;
  children?: ReactNode;
}

/**
 * Shared month-scoped screen chrome: prev/next month navigation that pushes the
 * adjacent month onto the route. The screen's name lives in the Layout top bar,
 * so the scaffold only owns the month switcher and the content column. A
 * malformed `:month` param redirects to the current month.
 */
export default function MonthScaffold({ basePath, children }: MonthScaffoldProps) {
  const { month } = useParams<{ month: string }>();
  const navigate = useNavigate();

  if (!isValidMonth(month)) {
    return <Navigate to={`${basePath}/${getCurrentMonth()}`} replace />;
  }

  return (
    <div className="mx-auto w-full max-w-md px-4">
      <MonthNavigation
        currentMonth={month}
        onMonthChange={(nextMonth) => navigate(`${basePath}/${nextMonth}`)}
      />
      {children}
    </div>
  );
}
