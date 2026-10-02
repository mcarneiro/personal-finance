import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * The highlighted callout shown where outflows cannot be created yet because the
 * payer or bank registry is empty. It points at Settings and offers a shortcut
 * straight there, so the user is never stuck on a form with nothing to select.
 */
export default function NeedsRegistryNotice() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm text-amber-800">{t('outflows.needsRegistry')}</p>
      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="mt-2 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
      >
        {t('outflows.needsRegistryCta')}
      </button>
    </div>
  );
}