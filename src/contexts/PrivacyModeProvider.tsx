import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { usePersistentToggle } from '../hooks/usePersistentToggle';
import { PrivacyModeContext } from './privacyMode';

/**
 * The device-local key Privacy Mode is remembered under, alongside the other
 * view preferences (the outflow filter, the summary toggles).
 */
const STORAGE_KEY = 'planyoo:privacy';

/**
 * Holds Privacy Mode for the whole app. It is a view preference, not data: it
 * lives on the device in `localStorage` (ADR-0001) and is read synchronously on
 * mount, so the first paint is already masked — no real value flashes before the
 * stored preference is applied.
 *
 * A remembered mode can be surprising, so the engaged state is always made
 * visible through the slashed, filled eye in the top bar; there is no toast.
 */
export function PrivacyModeProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [masked, toggle] = usePersistentToggle(STORAGE_KEY);

  return (
    <PrivacyModeContext.Provider
      value={{
        masked,
        toggle,
        mask: t('privacy.mask'),
        hiddenLabel: t('privacy.hiddenValue'),
      }}
    >
      {children}
    </PrivacyModeContext.Provider>
  );
}
