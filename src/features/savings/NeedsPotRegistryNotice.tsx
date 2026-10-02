import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * The highlighted callout shown where savings balances cannot be recorded yet
 * because the pot registry is empty. It points at Settings and offers a shortcut
 * straight there, mirroring the Outflows registry notice.
 */
export default function NeedsPotRegistryNotice() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div role="note" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm text-amber-800">{t('savings.emptyRegistry')}</p>
      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="mt-2 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
      >
        {t('savings.emptyRegistryCta')}
      </button>
    </div>
  );
}
