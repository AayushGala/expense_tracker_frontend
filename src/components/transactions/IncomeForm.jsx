import { useData } from '../../context/DataContext';
import { useOwners } from '../../hooks/useOwners';
import Select from '../common/Select';
import AmountInput from '../forms/AmountInput';
import AccountPicker from '../forms/AccountPicker';
import CategoryPicker from '../forms/CategoryPicker';
import DateField from '../forms/DateField';
import RefundFields from './RefundFields';
import { useRefundMode } from './useRefundMode';
import { inputClass, labelClass } from '../../utils/formStyles';
import {
  validateAmount,
  validateDate,
  validateRequired,
  collectErrors,
} from '../../utils/formValidators';
import { D, round2 } from '../../utils/money';

// Refund handling lives in useRefundMode + <RefundFields>.
export default function IncomeForm({ values, errors, dispatch, onSubmit, isEditing }) {
  const { accounts, categories } = useData();
  const { owners } = useOwners();

  const receivingAccounts = accounts.filter(
    (a) => (a.type === 'asset' || a.type === 'liability') && a.is_active !== false,
  );
  const incomeCategories = categories.filter((c) => c.type === 'income');

  const { isRefundMode, sourceTxn, sourceCategoryName, handleSourceChange } =
    useRefundMode(values, dispatch);

  function setField(name, value) {
    dispatch({ type: 'SET_FIELD', name, value });
  }

  function validate() {
    return collectErrors({
      amount: validateAmount(values.amount),
      date: validateDate(values.date),
      to_account_id: validateRequired(values.to_account_id, { message: 'Select a destination account.' }),
      category_id: validateRequired(values.category_id, { message: 'Select an income category.' }),
      source_transaction_id: isRefundMode
        ? validateRequired(values.source_transaction_id, { message: 'Pick the original expense being refunded.' })
        : null,
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      dispatch({ type: 'SET_ERRORS', errors: errs });
      return;
    }

    const payload = {
      type: 'income',
      amount: round2(D(values.amount)).toString(),
      date: values.date,
      to_account_id: parseInt(values.to_account_id),
      category_id: parseInt(values.category_id),
      owner: values.owner,
      platform: (values.platform ?? '').trim(),
      notes: (values.notes ?? '').trim(),
      beneficiary: values.beneficiary ?? '',
      tags: values.tags ?? '',
    };

    if (values.source_transaction_id) {
      payload.source_transaction_id = values.source_transaction_id;
    }

    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <AmountInput
        value={values.amount}
        onChange={(v) => setField('amount', v)}
        error={errors.amount}
        helperText={isRefundMode ? 'Auto-filled from the source. Edit for partial refunds.' : undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DateField value={values.date} onChange={(v) => setField('date', v)} error={errors.date} />
        <AccountPicker
          value={values.to_account_id}
          accounts={receivingAccounts}
          label="Received Into"
          error={errors.to_account_id}
          helperText={isRefundMode ? "Defaults to source's account. Override if refunded elsewhere." : undefined}
          onChange={(accountId, owner) => {
            setField('to_account_id', accountId);
            setField('owner', owner);
          }}
        />
      </div>

      {owners.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CategoryPicker
            value={values.category_id}
            onChange={(v) => setField('category_id', v)}
            categories={incomeCategories}
            label="Income Category"
            error={errors.category_id}
          />
          <div>
            <label className={labelClass}>Owner</label>
            <Select
              value={values.owner}
              onChange={(e) => setField('owner', e.target.value)}
              options={owners.map((o) => ({ value: o, label: o }))}
              placeholder="Unassigned"
            />
          </div>
        </div>
      ) : (
        <CategoryPicker
          value={values.category_id}
          onChange={(v) => setField('category_id', v)}
          categories={incomeCategories}
          label="Income Category"
          error={errors.category_id}
        />
      )}

      {isRefundMode && (
        <RefundFields
          sourceTransactionId={values.source_transaction_id}
          beneficiary={values.beneficiary}
          tags={values.tags}
          sourceTxn={sourceTxn}
          sourceCategoryName={sourceCategoryName}
          error={errors.source_transaction_id}
          onSourceChange={handleSourceChange}
        />
      )}

      <div>
        <label htmlFor="txn-platform" className={labelClass}>Platform</label>
        <input
          id="txn-platform"
          type="text"
          placeholder="e.g. Swiggy, Amazon, Flipkart"
          value={values.platform}
          onChange={(e) => setField('platform', e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="txn-notes" className={labelClass}>Notes</label>
        <textarea
          id="txn-notes"
          rows={3}
          placeholder="Optional notes"
          value={values.notes}
          onChange={(e) => setField('notes', e.target.value)}
          className={`${inputClass} resize-none`}
        />
      </div>

      {errors.submit && (
        <p className="text-sm text-red-500 text-center">{errors.submit}</p>
      )}

      <button
        type="submit"
        className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold
                   text-white shadow-sm hover:bg-brand-hover focus:outline-none
                   focus:ring-2 focus:ring-accent/30 transition-colors"
      >
        {isEditing ? (isRefundMode ? 'Update Refund' : 'Update Income') : (isRefundMode ? 'Save Refund' : 'Save Income')}
      </button>
    </form>
  );
}
