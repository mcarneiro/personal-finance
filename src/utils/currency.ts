/**
 * Money formatting and parsing for the app. Amounts are plain numbers in the
 * household's single currency — BRL, as the spec fixes it (no multi-currency) —
 * and are formatted per the active language so digits read naturally in pt-BR
 * (`R$ 10.750,00`) and en-US (`R$ 10,750.00`).
 */

const CURRENCY = 'BRL';

/** Format an amount as localized BRL currency, e.g. `R$ 10.750,00`. */
export function formatCurrency(amount: number, locale: string = 'pt-BR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: CURRENCY,
  }).format(amount);
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
