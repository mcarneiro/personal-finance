import { useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ConfirmRemoveDialog from '../../components/ConfirmRemoveDialog';
import PageHeader from '../../components/PageHeader';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addBill, deleteBill, updateBill } from '../../store/billsSlice';
import { generateId } from '../../utils/id';
import { isValidMonth } from '../../utils/month';
import BillForm from './BillForm';

/**
 * The full-screen create/edit page for one bill — the same header-and-no-nav
 * shape as Settings. Create mode reads the month from the route and saves an
 * open bill; edit mode finds the bill by id and preserves its month and paid
 * status. The four required fields live in BillForm; the red Remove action
 * sits below it and always confirms before deleting.
 */
export default function BillEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { month, id } = useParams<{ month?: string; id?: string }>();
  const bills = useAppSelector((state) => state.bills.items);
  const payers = useAppSelector((state) => state.payers.items);
  const banks = useAppSelector((state) => state.banks.items);
  const [showConfirm, setShowConfirm] = useState(false);
  // Set synchronously when we delete, so the not-found guard below does not
  // fire during the store update that removes the bill mid-navigation.
  const deletingRef = useRef(false);

  const isEdit = !!id;
  const bill = isEdit ? bills.find((entry) => entry.id === id) : undefined;

  // A bill that was deleted elsewhere has no editor to show.
  if (isEdit && !bill) {
    return deletingRef.current ? null : <Navigate to="/bills" replace />;
  }
  // Creating needs a month to attach the bill to.
  if (!isEdit && !isValidMonth(month)) {
    return <Navigate to="/bills" replace />;
  }

  const backMonth = isEdit ? bill!.month : month!;
  const registryReady = payers.length > 0 && banks.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={t(isEdit ? 'bills.editTitle' : 'bills.newTitle')}
        onBack={() => navigate(`/bills/${backMonth}`)}
      />

      <div className="mx-auto w-full max-w-md px-4 py-6">
        {registryReady ? (
          <BillForm
            formId={isEdit ? `edit-${id}` : 'new-bill'}
            payers={payers}
            banks={banks}
            nameLabel={t('bills.nameLabel')}
            amountLabel={t('bills.amountLabel')}
            submitLabel={t('bills.saveButton')}
            initialName={bill?.name}
            initialAmount={bill?.amount}
            initialPayerId={bill?.payerId}
            initialBankId={bill?.bankId}
            autoFocusName={!isEdit}
            onSubmit={(draft) => {
              if (isEdit && bill) {
                dispatch(updateBill({ ...bill, ...draft }));
                navigate(`/bills/${bill.month}`);
              } else if (month) {
                dispatch(addBill({ id: generateId(), month, isPaid: false, ...draft }));
                navigate(`/bills/${month}`);
              }
            }}
          />
        ) : (
          <p className="text-sm text-gray-600">{t('bills.needsRegistry')}</p>
        )}

        {isEdit && bill && registryReady && (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="mt-4 w-full rounded-lg bg-red-600 py-3 font-semibold text-white transition-colors hover:bg-red-700"
          >
            {t('bills.removeButton')}
          </button>
        )}
      </div>

      {showConfirm && bill && (
        <ConfirmRemoveDialog
          title={t('bills.confirmRemove')}
          message={t('bills.removeWarning')}
          confirmLabel={t('bills.yesRemove')}
          cancelLabel={t('common.cancel')}
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => {
            deletingRef.current = true;
            dispatch(deleteBill(bill.id));
            navigate(`/bills/${bill.month}`);
          }}
        />
      )}
    </div>
  );
}
