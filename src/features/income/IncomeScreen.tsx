import { useTranslation } from 'react-i18next';
import MonthScaffold from '../../components/MonthScaffold';

export default function IncomeScreen() {
  const { t } = useTranslation();

  return (
    <MonthScaffold basePath="/income" title={t('income.title')}>
      <p className="text-sm text-gray-500">{t('income.empty')}</p>
    </MonthScaffold>
  );
}
