import { useTranslation } from 'react-i18next';
import NameRegistry from '../../components/NameRegistry';
import { addSavingsPot, deleteSavingsPot, updateSavingsPot } from '../../store/savingsSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

/**
 * The household's savings-pot registry — the named containers of money set
 * aside. A pot keeps one stable identity across months, so renaming it flows
 * through to every month's balance by id. Removing a pot **retires** it: it
 * drops out of the registry and stops appearing and counting everywhere,
 * including history, unlike a removed Payer or Bank (ADR-0011). Its balance
 * rows are deliberately left in the sheet.
 */
export default function SavingsPotRegistry() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const pots = useAppSelector((state) => state.savings.items);

  return (
    <NameRegistry
      nameFieldId="newSavingsPotName"
      title={t('settings.registries.pots.title')}
      helperText={t('settings.registries.pots.retireNotice')}
      emptyText={t('settings.registries.pots.empty')}
      items={pots}
      nameLabel={t('settings.registries.pots.nameLabel')}
      namePlaceholder={t('settings.registries.pots.namePlaceholder')}
      addLabel={t('settings.registries.pots.add')}
      renameFieldLabel={t('settings.registries.pots.renameFieldLabel')}
      onAdd={(pot) => dispatch(addSavingsPot(pot))}
      onRename={(id, name) => dispatch(updateSavingsPot({ id, name }))}
      onRemove={(id) => dispatch(deleteSavingsPot(id))}
    />
  );
}
