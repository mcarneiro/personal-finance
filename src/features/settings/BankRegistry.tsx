import { useTranslation } from 'react-i18next';
import NameRegistry from '../../components/NameRegistry';
import { addBank, deleteBank, updateBank } from '../../store/banksSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

/**
 * The household's bank registry — the list a Bill can be paid from. Removing a
 * bank only drops it from the registry (see `banksSlice`); bills that reference
 * it keep their amount and fall back to a neutral label.
 */
export default function BankRegistry() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const banks = useAppSelector((state) => state.banks.items);

  return (
    <NameRegistry
      nameFieldId="newBankName"
      title={t('settings.registries.banks.title')}
      emptyText={t('settings.registries.banks.empty')}
      items={banks}
      nameLabel={t('settings.registries.banks.nameLabel')}
      namePlaceholder={t('settings.registries.banks.namePlaceholder')}
      addLabel={t('settings.registries.banks.add')}
      renameFieldLabel={t('settings.registries.banks.renameFieldLabel')}
      onAdd={(bank) => dispatch(addBank(bank))}
      onRename={(id, name) => dispatch(updateBank({ id, name }))}
      onRemove={(id) => dispatch(deleteBank(id))}
    />
  );
}
