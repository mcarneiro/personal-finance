import type { ReactElement } from 'react';
import { PrivacyModeProvider } from '../contexts/PrivacyModeProvider';

/**
 * Wraps a screen under test in the privacy-mode provider, the way the real app
 * does at its root. Screens read Privacy Mode to decide whether to mask money
 * values, so a test that renders one — even to assert it never masks — must
 * supply the provider, exactly as `main.tsx` does. The provider reads its state
 * from `localStorage`, so a test can seed a remembered mode with `localStorage`.
 */
export function withPrivacyMode(ui: ReactElement): ReactElement {
  return <PrivacyModeProvider>{ui}</PrivacyModeProvider>;
}
