import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../store/hooks';

/**
 * Resolve a Bill's Payer and Bank references to display names, with the same
 * fallbacks for an unset reference and a since-removed registry entry. Shared by
 * the Bills screen and the Dashboard so both label a bill identically.
 */
export function useRegistryLabels() {
  const { t } = useTranslation();
  const banks = useAppSelector((state) => state.banks.items);
  const payers = useAppSelector((state) => state.payers.items);

  const payerNames = new Map(payers.map((payer) => [payer.id, payer.name]));
  const bankNames = new Map(banks.map((bank) => [bank.id, bank.name]));

  const payerLabel = (id: string) =>
    id ? (payerNames.get(id) ?? t('bills.removedPayer')) : t('bills.unassignedPayer');
  const bankLabel = (id: string) =>
    id ? (bankNames.get(id) ?? t('bills.removedBank')) : t('bills.unassignedBank');

  return { payerLabel, bankLabel };
}
