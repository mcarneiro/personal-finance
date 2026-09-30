import { useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ConfirmRemoveDialog from '../../components/ConfirmRemoveDialog';
import PageHeader from '../../components/PageHeader';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addIncomeEntry, deleteIncomeEntry, updateIncomeEntry } from '../../store/incomeSlice';
import { generateId } from '../../utils/id';
import { isValidMonth } from '../../utils/month';
import IncomeEntryForm from './IncomeEntryForm';

/**
 * The full-screen create/edit page for one income entry — the same
 * header-and-no-nav shape as Settings. Create mode reads the month from the
 * route and saves an amount-only entry (the source note is optional); edit mode
 * finds the entry by id and preserves its month. The red Remove action sits below
 * the form and always confirms before deleting.
 */
export default function IncomeEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { month, id } = useParams<{ month?: string; id?: string }>();
  const items = useAppSelector((state) => state.income.items);
  const [showConfirm, setShowConfirm] = useState(false);
  // Set synchronously when we delete, so the not-found guard below does not
  // fire during the store update that removes the entry mid-navigation.
  const deletingRef = useRef(false);

  const isEdit = !!id;
  const entry = isEdit ? items.find((item) => item.id === id) : undefined;

  // An entry that was deleted elsewhere has no editor to show.
  if (isEdit && !entry) {
    return deletingRef.current ? null : <Navigate to="/income" replace />;
  }
  // Creating needs a month to attach the entry to.
  if (!isEdit && !isValidMonth(month)) {
    return <Navigate to="/income" replace />;
  }

  const backMonth = isEdit ? entry!.month : month!;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={t(isEdit ? 'income.editTitle' : 'income.newTitle')}
        onBack={() => navigate(`/income/${backMonth}`)}
      />

      <div className="mx-auto w-full max-w-md px-4 py-6">
        <IncomeEntryForm
          formId={isEdit ? `edit-${id}` : 'new-income'}
          amountLabel={t('income.amountLabel')}
          sourceLabel={t('income.sourceLabel')}
          submitLabel={t('income.saveButton')}
          initialAmount={entry?.amount}
          initialSource={entry?.source ?? ''}
          autoFocusAmount={!isEdit}
          onSubmit={(amount, source) => {
            if (isEdit && entry) {
              dispatch(updateIncomeEntry({ ...entry, amount, source }));
              navigate(`/income/${entry.month}`);
            } else if (month) {
              dispatch(addIncomeEntry({ id: generateId(), month, amount, source }));
              navigate(`/income/${month}`);
            }
          }}
        />

        {isEdit && entry && (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="mt-4 w-full rounded-lg bg-red-600 py-3 font-semibold text-white transition-colors hover:bg-red-700"
          >
            {t('income.removeButton')}
          </button>
        )}
      </div>

      {showConfirm && entry && (
        <ConfirmRemoveDialog
          title={t('income.confirmRemove')}
          message={t('income.removeWarning')}
          confirmLabel={t('income.yesRemove')}
          cancelLabel={t('common.cancel')}
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => {
            deletingRef.current = true;
            dispatch(deleteIncomeEntry(entry.id));
            navigate(`/income/${entry.month}`);
          }}
        />
      )}
    </div>
  );
}
