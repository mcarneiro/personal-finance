import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../store/hooks';

/**
 * Resolve a Outflow's Payer and Bank references to display names, with the same
 * fallbacks for an unset reference and a since-removed registry entry. Shared by
 * the Outflows screen and the Dashboard so both label a outflow identically.
 */
export function useRegistryLabels() {
  const { t } = useTranslation();
  const banks = useAppSelector((state) => state.banks.items);
  const payers = useAppSelector((state) => state.payers.items);

  const payerNames = new Map(payers.map((payer) => [payer.id, payer.name]));
  const bankNames = new Map(banks.map((bank) => [bank.id, bank.name]));

  const payerLabel = (id: string) =>
    id ? (payerNames.get(id) ?? t('outflows.removedPayer')) : t('outflows.unassignedPayer');
  const bankLabel = (id: string) =>
    id ? (bankNames.get(id) ?? t('outflows.removedBank')) : t('outflows.unassignedBank');

  return { payerLabel, bankLabel };
}
