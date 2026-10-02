import { useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ConfirmRemoveDialog from '../../components/ConfirmRemoveDialog';
import PageHeader from '../../components/PageHeader';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addOutflow, deleteOutflow, updateOutflow } from '../../store/outflowsSlice';
import { generateId } from '../../utils/id';
import { isValidMonth } from '../../utils/month';
import OutflowForm from './OutflowForm';
import NeedsRegistryNotice from './NeedsRegistryNotice';

/**
 * The full-screen create/edit page for one outflow — the same header-and-no-nav
 * shape as Settings. Create mode reads the month from the route and saves an
 * open outflow; edit mode finds the outflow by id and preserves its month and paid
 * status. The four required fields live in OutflowForm; the red Remove action
 * sits below it and always confirms before deleting.
 */
export default function OutflowEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { month, id } = useParams<{ month?: string; id?: string }>();
  const outflows = useAppSelector((state) => state.outflows.items);
  const payers = useAppSelector((state) => state.payers.items);
  const banks = useAppSelector((state) => state.banks.items);
  const [showConfirm, setShowConfirm] = useState(false);
  // Set synchronously when we delete, so the not-found guard below does not
  // fire during the store update that removes the outflow mid-navigation.
  const deletingRef = useRef(false);

  const isEdit = !!id;
  const outflow = isEdit ? outflows.find((entry) => entry.id === id) : undefined;

  // A outflow that was deleted elsewhere has no editor to show.
  if (isEdit && !outflow) {
    return deletingRef.current ? null : <Navigate to="/outflows" replace />;
  }
  // Creating needs a month to attach the outflow to.
  if (!isEdit && !isValidMonth(month)) {
    return <Navigate to="/outflows" replace />;
  }

  const backMonth = isEdit ? outflow!.month : month!;
  const registryReady = payers.length > 0 && banks.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={t(isEdit ? 'outflows.editTitle' : 'outflows.newTitle')}
        onBack={() => navigate(`/outflows/${backMonth}`)}
      />

      <div className="mx-auto w-full max-w-md px-4 py-6">
        {registryReady ? (
          <OutflowForm
            formId={isEdit ? `edit-${id}` : 'new-outflow'}
            payers={payers}
            banks={banks}
            nameLabel={t('outflows.nameLabel')}
            amountLabel={t('outflows.amountLabel')}
            submitLabel={t('outflows.saveButton')}
            initialName={outflow?.name}
            initialAmount={outflow?.amount}
            initialIsFinal={outflow?.isFinal}
            initialPayerId={outflow?.payerId}
            initialBankId={outflow?.bankId}
            autoFocusName={!isEdit}
            onSubmit={(draft) => {
              if (isEdit && outflow) {
                dispatch(updateOutflow({ ...outflow, ...draft }));
                navigate(`/outflows/${outflow.month}`);
              } else if (month) {
                dispatch(addOutflow({ id: generateId(), month, isPaid: false, ...draft }));
                navigate(`/outflows/${month}`);
              }
            }}
          />
        ) : (
          <NeedsRegistryNotice />
        )}

        {isEdit && outflow && registryReady && (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="mt-4 w-full rounded-lg bg-red-600 py-3 font-semibold text-white transition-colors hover:bg-red-700"
          >
            {t('outflows.removeButton')}
          </button>
        )}
      </div>

      {showConfirm && outflow && (
        <ConfirmRemoveDialog
          title={t('outflows.confirmRemove')}
          message={t('outflows.removeWarning')}
          confirmLabel={t('outflows.yesRemove')}
          cancelLabel={t('common.cancel')}
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => {
            deletingRef.current = true;
            dispatch(deleteOutflow(outflow.id));
            navigate(`/outflows/${outflow.month}`);
          }}
        />
      )}
    </div>
  );
}
