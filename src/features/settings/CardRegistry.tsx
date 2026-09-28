import { useTranslation } from 'react-i18next';
import NameRegistry from '../../components/NameRegistry';
import { addCard, deleteCard, updateCard } from '../../store/cardsSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

/**
 * The household's credit-card registry — the source of the per-card check-in
 * inputs. Removing a card only drops it from the registry (see `cardsSlice`);
 * Card Spending already recorded for past months is left untouched (ADR-0002).
 */
export default function CardRegistry() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const cards = useAppSelector((state) => state.cards.items);

  return (
    <NameRegistry
      nameFieldId="newCardName"
      title={t('settings.registries.cards.title')}
      emptyText={t('settings.registries.cards.empty')}
      items={cards}
      nameLabel={t('settings.registries.cards.nameLabel')}
      namePlaceholder={t('settings.registries.cards.namePlaceholder')}
      addLabel={t('settings.registries.cards.add')}
      renameFieldLabel={t('settings.registries.cards.renameFieldLabel')}
      onAdd={(card) => dispatch(addCard(card))}
      onRename={(id, name) => dispatch(updateCard({ id, name }))}
      onRemove={(id) => dispatch(deleteCard(id))}
    />
  );
}
