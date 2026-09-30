import { useTranslation } from 'react-i18next';

/**
 * The app's entry point. The household dashboard is still to be designed, so
 * this is a placeholder shell: it holds the home route while the real dashboard
 * is built here. The page title and the Settings shortcut live in the Layout
 * top bar.
 */
export default function DashboardScreen() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{t('home.placeholderTitle')}</h2>
        <p className="mt-2 text-sm text-gray-600">{t('home.placeholderMessage')}</p>
      </section>
    </div>
  );
}
