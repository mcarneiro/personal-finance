/**
 * Money formatting and parsing for the app. Amounts are plain numbers in the
 * household's single currency — BRL, as the spec fixes it (no multi-currency) —
 * and are formatted per the active language so digits read naturally in pt-BR
 * (`R$ 10.750,00`) and en-US (`R$ 10,750.00`).
 */

const CURRENCY = 'BRL';

/**
 * The placeholder shown in place of a value while Privacy Mode is on. It keeps
 * the currency symbol but carries no magnitude or sign, so a masked screen never
 * leaks how much money is in play. The word is supplied by the caller (the UI
 * passes its translated mask) so the string lives in the locale files, not here.
 */
export const PRIVACY_MASK = 'R$ ••••';

/** Format an amount as localized BRL currency, e.g. `R$ 10.750,00`. */
export function formatCurrency(amount: number, locale: string = 'pt-BR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: CURRENCY,
  }).format(amount);
}

/**
 * Format an amount for display, honouring Privacy Mode. When `masked` is false
 * this is exactly `formatCurrency` — the same number, the same locale rules, so
 * nothing changes for an unengaged household. When `masked` is true the amount
 * is replaced by `mask`, which defaults to the app's own placeholder: callers
 * that translate it (every screen does) pass their localized string instead.
 *
 * It is deliberately a formatter, not a stateful component: masking is a
 * display concern, so it is applied at the call site and the derived numbers in
 * state are never touched (ADR-0001).
 */
export function formatDisplayAmount(
  amount: number,
  locale: string = 'pt-BR',
  masked = false,
  mask: string = PRIVACY_MASK
): string {
  return masked ? mask : formatCurrency(amount, locale);
}

/**
 * Parse a user-typed amount into a number. Accepts both pt-BR comma decimals
 * and en-US dot decimals; blank or unparseable input yields `null` so callers
 * can refuse it instead of silently recording a wrong number.
 */
export function parseAmount(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
