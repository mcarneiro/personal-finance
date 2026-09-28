import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generateId } from '../utils/id';

export interface RegistryItem {
  id: string;
  name: string;
}

interface NameRegistryProps {
  /** Stable id prefix for the add field, independent of the localized title. */
  nameFieldId: string;
  title: string;
  emptyText: string;
  items: RegistryItem[];
  nameLabel: string;
  namePlaceholder: string;
  addLabel: string;
  renameFieldLabel: string;
  onAdd: (item: RegistryItem) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}

/**
 * A reusable name registry: a list of named entries that can be added, renamed
 * in place, and removed. Used for the household's cards, banks and payers — the
 * vocabulary the rest of the app picks from. Removal only drops the entry from
 * the registry; screens that reference it fall back gracefully, so historical
 * data is never corrupted (mirrors ADR-0002).
 */
export default function NameRegistry({
  nameFieldId,
  title,
  emptyText,
  items,
  nameLabel,
  namePlaceholder,
  addLabel,
  renameFieldLabel,
  onAdd,
  onRename,
  onRemove,
}: NameRegistryProps) {
  const { t } = useTranslation();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onAdd({ id: generateId(), name });
    setNewName('');
  };

  const handleRename = (event: FormEvent, id: string) => {
    event.preventDefault();
    const name = editingName.trim();
    if (!name) return;
    onRename(id, name);
    setEditingId(null);
    setEditingName('');
  };

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>

      {items.length === 0 ? (
        <p className="mt-1 text-sm text-gray-600">{emptyText}</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100">
          {items.map((item) => (
            <li key={item.id} className="py-2">
              {editingId === item.id ? (
                <form
                  onSubmit={(event) => handleRename(event, item.id)}
                  className="flex items-center gap-2"
                >
                  <label htmlFor={`rename-${item.id}`} className="sr-only">
                    {renameFieldLabel}
                  </label>
                  <input
                    id={`rename-${item.id}`}
                    type="text"
                    autoFocus
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!editingName.trim()}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {t('settings.saveRename')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
                  >
                    {t('settings.cancelRename')}
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-900">{item.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditingName(item.name);
                      }}
                      aria-label={t('settings.renameNamed', { name: item.name })}
                      className="rounded-lg px-2 py-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
                    >
                      {t('settings.rename')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      aria-label={t('settings.removeNamed', { name: item.name })}
                      className="rounded-lg px-2 py-1 text-sm font-medium text-red-600 transition-colors hover:text-red-700"
                    >
                      {t('settings.remove')}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="mt-4 space-y-3">
        <label htmlFor={nameFieldId} className="block text-sm font-medium text-gray-700">
          {nameLabel}
        </label>
        <input
          id={nameFieldId}
          type="text"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder={namePlaceholder}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {addLabel}
        </button>
      </form>
    </section>
  );
}
