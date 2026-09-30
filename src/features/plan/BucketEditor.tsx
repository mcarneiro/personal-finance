import { useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ConfirmRemoveDialog from '../../components/ConfirmRemoveDialog';
import NameAmountForm from '../../components/NameAmountForm';
import PageHeader from '../../components/PageHeader';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addPlanItem, deletePlanItem, updatePlanItem } from '../../store/planSlice';
import { generateId } from '../../utils/id';
import { isValidMonth } from '../../utils/month';

/**
 * The full-screen create/edit page for one spending bucket — the same
 * header-and-no-nav shape as Settings. Create mode reads the month from the
 * route and saves a bucket at zero remaining estimate; edit mode finds the
 * bucket by id and preserves its month and estimate. Name and cap live in the
 * shared NameAmountForm; the red Remove action confirms before deleting.
 */
export default function BucketEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { month, id } = useParams<{ month?: string; id?: string }>();
  const items = useAppSelector((state) => state.plan.items);
  const [showConfirm, setShowConfirm] = useState(false);
  // Set synchronously when we delete, so the not-found guard below does not
  // fire during the store update that removes the bucket mid-navigation.
  const deletingRef = useRef(false);

  const isEdit = !!id;
  const item = isEdit ? items.find((entry) => entry.id === id) : undefined;

  // A bucket that was deleted elsewhere has no editor to show.
  if (isEdit && !item) {
    return deletingRef.current ? null : <Navigate to="/plan" replace />;
  }
  // Creating needs a month to attach the bucket to.
  if (!isEdit && !isValidMonth(month)) {
    return <Navigate to="/plan" replace />;
  }

  const backMonth = isEdit ? item!.month : month!;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={t(isEdit ? 'plan.editTitle' : 'plan.newTitle')}
        onBack={() => navigate(`/plan/${backMonth}`)}
      />

      <div className="mx-auto w-full max-w-md px-4 py-6">
        <NameAmountForm
          formId={isEdit ? `edit-${id}` : 'new-bucket'}
          nameLabel={t('plan.bucketNameLabel')}
          amountLabel={t('plan.bucketAmountLabel')}
          submitLabel={t('plan.saveButton')}
          initialName={item?.name}
          initialAmount={item?.amount}
          autoFocusName={!isEdit}
          onSubmit={(name, amount) => {
            if (isEdit && item) {
              dispatch(updatePlanItem({ ...item, name, amount }));
              navigate(`/plan/${item.month}`);
            } else if (month) {
              dispatch(
                addPlanItem({
                  id: generateId(),
                  month,
                  name,
                  amount,
                  remainingEstimate: 0,
                })
              );
              navigate(`/plan/${month}`);
            }
          }}
        />

        {isEdit && item && (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="mt-4 w-full rounded-lg bg-red-600 py-3 font-semibold text-white transition-colors hover:bg-red-700"
          >
            {t('plan.removeButton')}
          </button>
        )}
      </div>

      {showConfirm && item && (
        <ConfirmRemoveDialog
          title={t('plan.confirmRemove')}
          message={t('plan.removeWarning')}
          confirmLabel={t('plan.yesRemove')}
          cancelLabel={t('common.cancel')}
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => {
            deletingRef.current = true;
            dispatch(deletePlanItem(item.id));
            navigate(`/plan/${item.month}`);
          }}
        />
      )}
    </div>
  );
}
