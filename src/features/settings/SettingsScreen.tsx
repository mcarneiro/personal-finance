import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../../components/LanguageSwitcher';

export default function SettingsScreen() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
      <LanguageSwitcher />
    </div>
  );
}
