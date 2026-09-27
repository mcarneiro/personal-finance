import { useTranslation } from 'react-i18next';
import MonthScaffold from '../../components/MonthScaffold';

export default function PlanScreen() {
  const { t } = useTranslation();

  return (
    <MonthScaffold basePath="/plan" title={t('plan.title')}>
      <p className="text-sm text-gray-500">{t('plan.empty')}</p>
    </MonthScaffold>
  );
}
