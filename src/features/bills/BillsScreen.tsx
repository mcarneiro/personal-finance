import { useTranslation } from 'react-i18next';
import MonthScaffold from '../../components/MonthScaffold';

export default function BillsScreen() {
  const { t } = useTranslation();

  return (
    <MonthScaffold basePath="/bills" title={t('bills.title')}>
      <p className="text-sm text-gray-500">{t('bills.empty')}</p>
    </MonthScaffold>
  );
}
