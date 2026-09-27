import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addCard, deleteCard, updateCard } from '../../store/cardsSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { generateId } from '../../utils/id';

/**
 * The household's credit-card registry — the source of the per-card check-in
 * inputs. Removing a card only drops it from the registry (see `cardsSlice`);
 * Card Spending already recorded for past months is left untouched (ADR-0002).
 */
export default function CardRegistry() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const cards = useAppSelector((state) => state.cards.items);

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    dispatch(addCard({ id: generateId(), name }));
    setNewName('');
  };

  const handleRename = (event: FormEvent, id: string) => {
    event.preventDefault();
    const name = editingName.trim();
    if (!name) return;
    dispatch(updateCard({ id, name }));
    setEditingId(null);
    setEditingName('');
  };

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">{t('settings.cards')}</h2>

      {cards.length === 0 ? (
        <p className="mt-1 text-sm text-gray-600">{t('settings.cardsEmpty')}</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100">
          {cards.map((card) => (
            <li key={card.id} className="py-2">
              {editingId === card.id ? (
                <form
                  onSubmit={(event) => handleRename(event, card.id)}
                  className="flex items-center gap-2"
                >
                  <label htmlFor={`rename-${card.id}`} className="sr-only">
                    {t('settings.renameCardLabel')}
                  </label>
                  <input
                    id={`rename-${card.id}`}
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
                  <span className="text-sm text-gray-900">{card.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(card.id);
                        setEditingName(card.name);
                      }}
                      aria-label={t('settings.renameCard', { name: card.name })}
                      className="rounded-lg px-2 py-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
                    >
                      {t('settings.rename')}
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatch(deleteCard(card.id))}
                      aria-label={t('settings.removeCard', { name: card.name })}
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
        <label htmlFor="newCardName" className="block text-sm font-medium text-gray-700">
          {t('settings.cardNameLabel')}
        </label>
        <input
          id="newCardName"
          type="text"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder={t('settings.cardNamePlaceholder')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {t('settings.addCard')}
        </button>
      </form>
    </section>
  );
}
