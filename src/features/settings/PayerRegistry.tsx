import { useTranslation } from 'react-i18next';
import NameRegistry from '../../components/NameRegistry';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addPayer, deletePayer, updatePayer } from '../../store/payersSlice';

/**
 * The household's payer registry — who pays a Outflow. Removing a payer only drops
 * it from the registry (see `payersSlice`); outflows that reference it keep their
 * amount and fall back to a neutral label.
 */
export default function PayerRegistry() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const payers = useAppSelector((state) => state.payers.items);

  return (
    <NameRegistry
      nameFieldId="newPayerName"
      title={t('settings.registries.payers.title')}
      emptyText={t('settings.registries.payers.empty')}
      items={payers}
      nameLabel={t('settings.registries.payers.nameLabel')}
      namePlaceholder={t('settings.registries.payers.namePlaceholder')}
      addLabel={t('settings.registries.payers.add')}
      renameFieldLabel={t('settings.registries.payers.renameFieldLabel')}
      onAdd={(payer) => dispatch(addPayer(payer))}
      onRename={(id, name) => dispatch(updatePayer({ id, name }))}
      onRemove={(id) => dispatch(deletePayer(id))}
    />
  );
}
