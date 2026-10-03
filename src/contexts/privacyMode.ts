import { createContext, useContext } from 'react';

/**
 * What every screen reads from Privacy Mode: whether values are hidden, how to
 * flip the mode, and the two localized strings that go with it.
 */
export interface PrivacyModeValue {
  /** True while the household has hidden money values on this device. */
  masked: boolean;
  /** Flip the mode. */
  toggle: () => void;
  /**
   * The placeholder to draw in place of a value, translated for the active
   * language. Screens pass it through `formatDisplayAmount` so the mask reads
   * naturally in pt-BR and en-US without the util importing i18n.
   */
  mask: string;
  /** The accessible label announcing that a value is hidden. */
  hiddenLabel: string;
}

/**
 * The context itself. It lives beside the hook rather than the provider so the
 * provider file exports only a component — which keeps Fast Refresh working —
 * while the hook and its type stay importable from one place.
 */
export const PrivacyModeContext = createContext<PrivacyModeValue | undefined>(undefined);

/**
 * Read Privacy Mode. Screens that render a money value call this and pass
 * `masked` plus `mask` to `formatDisplayAmount`; editable inputs use `masked` to
 * render read-only so a hidden value is never edited blind.
 */
export function usePrivacyMode(): PrivacyModeValue {
  const value = useContext(PrivacyModeContext);
  if (value === undefined) {
    throw new Error('usePrivacyMode must be used within a PrivacyModeProvider');
  }
  return value;
}
