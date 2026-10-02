import type { Month } from '../types';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** True when `value` is a well-formed `YYYY-MM` month. */
export function isValidMonth(value: string | undefined): value is Month {
  return typeof value === 'string' && MONTH_PATTERN.test(value);
}

/**
 * True when `month` lies before the current calendar month. Past months are
 * history: the plan screen headlines their final Plan Result rather than a live
 * projection (spec: past months show the Plan Result as the headline).
 */
export function isPastMonth(month: Month, now: Date = new Date()): boolean {
  return month < formatMonth(now);
}

/** Format a local Date as `YYYY-MM` using the local calendar month. */
export function formatMonth(date: Date): Month {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** The current local month as `YYYY-MM`. */
export function getCurrentMonth(now: Date = new Date()): Month {
  return formatMonth(now);
}

/**
 * Parse a `YYYY-MM` string into a Date pinned to noon UTC on the first of the
 * month, avoiding timezone drift when shifting or formatting.
 */
export function parseMonth(month: Month): Date {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthIndex - 1, 1, 12, 0, 0));
}

/** Shift a month by `delta` months (negative for earlier). */
export function shiftMonth(month: Month, delta: number): Month {
  const date = parseMonth(month);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

/** Localized month name, e.g. "junho de 2026" (pt-BR) or "June 2026" (en-US). */
export function getMonthName(month: Month, locale: string = 'pt-BR'): string {
  return parseMonth(month).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Localized short month label, e.g. "jun." (pt-BR) or "Jun" (en-US). The
 * Dashboard savings trend uses it under each column, matching the locale style
 * of `getMonthName` (same parser, same locale source) at chart-label size.
 */
export function getShortMonthName(month: Month, locale: string = 'pt-BR'): string {
  return parseMonth(month).toLocaleDateString(locale, { month: 'short' });
}
