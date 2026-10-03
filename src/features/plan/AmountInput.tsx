import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseAmount } from '../../utils/currency';

interface AmountInputProps {
  /** Unique field id, so the field is a proper named form control. */
  id: string;
  /** Accessible name, e.g. the card or bucket this amount belongs to. */
  label: string;
  /** The committed amount from state. */
  value: number;
  /** Called with every parseable amount as the user types, so the screen updates live. */
  onCommit: (value: number) => void;
  /**
   * When given, clearing the field and leaving it calls `onClear` instead of
   * committing `0`. A screen where "no value recorded" and an explicit `0` are
   * different — the savings check-in (ADR-0011) — uses this to remove the
   * browsed month's record so carry-forward resumes.
   */
  onClear?: () => void;
  /**
   * Whether `0` is a real recorded amount rendered as `0`, rather than an absent
   * one rendered blank. Defaults to false (the live check-ins, where a zero is
   * simply "nothing yet").
   */
  hasValue?: boolean;
  /**
   * When Privacy Mode is on, the field shows the mask and is read-only: a hidden
   * value is never edited blind. Leaving the mode restores the normal field.
   */
  masked?: boolean;
  /** The localized mask to draw while `masked`. */
  mask?: string;
}

/**
 * How an amount reads in the field; a zero shows as an empty field with a
 * placeholder unless the caller says the zero is a real value. Grouping is off
 * on purpose — a grouped `2.899` would read back as two-point-eight-nine-nine
 * through `parseAmount`.
 */
function toDraft(value: number, locale: string, hasValue: boolean): string {
  if (value === 0) return hasValue ? '0' : '';
  return new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 20 }).format(
    value
  );
}

/**
 * A small money field for live edits — card check-ins, remaining estimates and
 * the monthly savings balances. The text is held as a draft so pt-BR comma
 * decimals survive mid-typing (e.g. `2,5`), and every parseable keystroke is
 * committed immediately so the totals move as you type. A blank field committed
 * on blur means zero, unless the caller provides `onClear` (savings), where it
 * means "remove this month's record" and a typed `0` is a real recorded zero.
 */
export default function AmountInput({
  id,
  label,
  value,
  onCommit,
  onClear,
  hasValue = false,
  masked = false,
  mask = 'R$ ••••',
}: AmountInputProps) {
  const { i18n } = useTranslation();
  const [draft, setDraft] = useState(() => toDraft(value, i18n.language, hasValue));
  // The value (and zero-ness) this field last rendered or sent. An outside
  // change — a month switch, a copy, a commit that lands — is adopted from the
  // parent; our own edits are already recorded here so they are never clobbered
  // mid-typing.
  const synced = useRef({ value, hasValue });

  useEffect(() => {
    if (value !== synced.current.value || hasValue !== synced.current.hasValue) {
      synced.current = { value, hasValue };
      setDraft(toDraft(value, i18n.language, hasValue));
    }
  }, [value, hasValue, i18n.language]);

  const commit = (next: number) => {
    synced.current = { value: next, hasValue };
    onCommit(next);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setDraft(next);
    const parsed = parseAmount(next);
    if (parsed === null) return;
    // Commit the new number; the one exception is a typed `0` against a field
    // the parent says has no value yet (savings), where zero is a real record.
    const isNewZero = parsed === 0 && onClear !== undefined && !synced.current.hasValue;
    if (parsed === synced.current.value && !isNewZero) return;
    commit(parsed);
  };

  const handleBlur = () => {
    if (parseAmount(draft) !== null) return;
    if (draft.trim() === '') {
      if (onClear) {
        onClear();
        // Show what the parent decides next (the carried value, or blank): the
        // ref is reset so a re-render, even to an equal value, is adopted.
        synced.current = { value, hasValue };
        setDraft(toDraft(value, i18n.language, hasValue));
        return;
      }
      if (value !== 0) commit(0);
      else setDraft('');
      return;
    }
    // Unparseable text is dropped; the field falls back to the committed amount.
    setDraft(toDraft(value, i18n.language, hasValue));
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      aria-label={masked ? `${label} — ${mask}` : label}
      value={masked ? mask : draft}
      readOnly={masked}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="0"
      className={`w-28 rounded-lg border border-gray-300 px-3 py-2 text-right text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 ${
        masked ? 'bg-gray-100 text-gray-500' : ''
      }`}
    />
  );
}
