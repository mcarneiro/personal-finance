import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OutflowFilter, OutflowFilterOptions } from '../../utils/outflowFilter';

interface OutflowFilterDrawerProps {
  options: OutflowFilterOptions;
  /** The filter currently applied to the list; seeds the drawer's draft. */
  value: OutflowFilter;
  /** Resolve a payer id to its display name (with unset/removed fallbacks). */
  payerLabel: (id: string) => string;
  /** Resolve a bank id to its display name (with unset/removed fallbacks). */
  bankLabel: (id: string) => string;
  onApply: (filter: OutflowFilter) => void;
  onClose: () => void;
}

/** Add or remove an id from a facet's selection. */
function toggle(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((selected) => selected !== id) : [...ids, id];
}

/**
 * The Outflows list filter, on a right-side drawer over a dimmed backdrop. It edits
 * a draft so half-made selections never reorder the list behind it: Apply
 * commits the draft and closes, while tapping the backdrop (or Escape) discards
 * it. The checkboxes are the payers and banks that actually appear on the
 * month's outflows, so every one of them changes the list.
 */
export default function OutflowFilterDrawer({
  options,
  value,
  payerLabel,
  bankLabel,
  onApply,
  onClose,
}: OutflowFilterDrawerProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<OutflowFilter>(value);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        id="outflow-filter"
        aria-modal="true"
        aria-label={t('outflows.filterTitle')}
        className="flex h-full w-80 max-w-full flex-col bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="border-b border-gray-200 px-4 py-3 text-lg font-bold text-gray-900">
          {t('outflows.filterTitle')}
        </h2>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <fieldset>
            <legend className="text-sm font-semibold text-gray-700">
              {t('outflows.payerLabel')}
            </legend>
            <ul className="mt-2 space-y-2">
              {options.payerIds.map((id) => (
                <li key={id || '__unassigned-payer__'}>
                  <label className="flex items-center gap-2 text-sm text-gray-900">
                    <input
                      type="checkbox"
                      checked={draft.payerIds.includes(id)}
                      onChange={() =>
                        setDraft((current) => ({ ...current, payerIds: toggle(current.payerIds, id) }))
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    {payerLabel(id)}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-gray-700">
              {t('outflows.bankLabel')}
            </legend>
            <ul className="mt-2 space-y-2">
              {options.bankIds.map((id) => (
                <li key={id || '__unassigned-bank__'}>
                  <label className="flex items-center gap-2 text-sm text-gray-900">
                    <input
                      type="checkbox"
                      checked={draft.bankIds.includes(id)}
                      onChange={() =>
                        setDraft((current) => ({ ...current, bankIds: toggle(current.bankIds, id) }))
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    {bankLabel(id)}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </div>

        <div className="flex gap-3 border-t border-gray-200 px-4 py-3">
          <button
            type="button"
            onClick={() => setDraft({ payerIds: [], bankIds: [] })}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {t('outflows.filterClear')}
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            {t('outflows.filterApply')}
          </button>
        </div>
      </div>
    </div>
  );
}
