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
}

/**
 * How an amount reads in the field; a zero shows as an empty field with a
 * placeholder. Grouping is off on purpose — a grouped `2.899` would read back as
 * two-point-eight-nine-nine through `parseAmount`.
 */
function toDraft(value: number, locale: string): string {
  if (value === 0) return '';
  return new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 20 }).format(
    value
  );
}

/**
 * A small money field for live edits — card check-ins and remaining estimates.
 * The text is held as a draft so pt-BR comma decimals survive mid-typing (e.g.
 * `2,5`), and every parseable keystroke is committed immediately so the
 * projection moves as you type. A blank field committed on blur means zero.
 */
export default function AmountInput({ id, label, value, onCommit }: AmountInputProps) {
  const { i18n } = useTranslation();
  const [draft, setDraft] = useState(() => toDraft(value, i18n.language));
  // The amount this field last sent up; used to tell an outside change (month
  // switch, copy) apart from the echo of our own commit.
  const committed = useRef(value);

  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setDraft(toDraft(value, i18n.language));
    }
  }, [value, i18n.language]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setDraft(next);
    const parsed = parseAmount(next);
    if (parsed !== null && parsed !== committed.current) {
      committed.current = parsed;
      onCommit(parsed);
    }
  };

  const handleBlur = () => {
    if (parseAmount(draft) !== null) return;
    if (draft.trim() === '') {
      if (value !== 0) {
        committed.current = 0;
        onCommit(0);
      }
      setDraft('');
      return;
    }
    // Unparseable text is dropped; the field falls back to the committed amount.
    setDraft(toDraft(value, i18n.language));
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={draft}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="0"
      className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-right text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
    />
  );
}
