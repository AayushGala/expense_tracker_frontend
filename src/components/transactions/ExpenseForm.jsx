import { useData } from '../../context/DataContext';
import { useOwners } from '../../hooks/useOwners';
import Select from '../common/Select';
import AmountInput from '../forms/AmountInput';
import AccountPicker from '../forms/AccountPicker';
import CategoryPicker from '../forms/CategoryPicker';
import DateField from '../forms/DateField';
import { inputClass, labelClass, errorClass } from '../../utils/formStyles';
import {
  validateAmount,
  validateDate,
  validateRequired,
  collectErrors,
} from '../../utils/formValidators';
import { D, round2 } from '../../utils/money';

const PREDEFINED_BENEFICIARIES = ['self', 'family'];

export default function ExpenseForm({ values, errors, dispatch, onSubmit, isEditing }) {
  const { accounts, categories } = useData();
  const { owners } = useOwners();

  const payableAccounts = accounts.filter(
    (a) => (a.type === 'asset' || a.type === 'liability') && a.is_active !== false,
  );
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  function setField(name, value) {
    dispatch({ type: 'SET_FIELD', name, value });
  }

  function validate() {
    return collectErrors({
      amount: validateAmount(values.amount),
      date: validateDate(values.date),
      from_account_id: validateRequired(values.from_account_id, { message: 'Select an account.' }),
      category_id: validateRequired(values.category_id, { message: 'Select a category.' }),
      custom_beneficiary: values.beneficiary_type === 'custom'
        ? validateRequired((values.custom_beneficiary ?? '').trim(), { message: 'Enter a beneficiary name.' })
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

    // Send amount as a string preserving 2-decimal precision. Backend's
    // DecimalField re-parses; using Decimal here avoids the float round-trip.
    const amountStr = round2(D(values.amount)).toString();
    const beneficiary =
      values.beneficiary_type === 'custom'
        ? values.custom_beneficiary.trim()
        : values.beneficiary_type;

    onSubmit({
      type: 'expense',
      amount: amountStr,
      date: values.date,
      from_account_id: parseInt(values.from_account_id),
      category_id: parseInt(values.category_id),
      beneficiary,
      owner: values.owner,
      platform: (values.platform ?? '').trim(),
      tags: (values.tags ?? '').trim(),
      notes: (values.notes ?? '').trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <AmountInput
        value={values.amount}
        onChange={(v) => setField('amount', v)}
        error={errors.amount}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DateField value={values.date} onChange={(v) => setField('date', v)} error={errors.date} />
        <AccountPicker
          value={values.from_account_id}
          accounts={payableAccounts}
          label="Paid From"
          error={errors.from_account_id}
          onChange={(accountId, owner) => {
            setField('from_account_id', accountId);
            setField('owner', owner);
          }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CategoryPicker
          value={values.category_id}
          onChange={(v) => setField('category_id', v)}
          categories={expenseCategories}
          error={errors.category_id}
        />
        <div>
          <label className={labelClass}>Beneficiary</label>
          <Select
            value={values.beneficiary_type}
            onChange={(e) => setField('beneficiary_type', e.target.value)}
            options={[
              ...PREDEFINED_BENEFICIARIES.map((b) => ({
                value: b,
                label: b.charAt(0).toUpperCase() + b.slice(1),
              })),
              { value: 'custom', label: 'Other (custom)' },
            ]}
          />
          {values.beneficiary_type === 'custom' && (
            <div className="mt-2">
              <input
                id="txn-custom-beneficiary"
                type="text"
                placeholder="Enter name"
                value={values.custom_beneficiary}
                onChange={(e) => setField('custom_beneficiary', e.target.value)}
                className={inputClass}
              />
              {errors.custom_beneficiary && (
                <p className={errorClass}>{errors.custom_beneficiary}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {owners.length > 0 && (
        <div>
          <label className={labelClass}>Owner</label>
          <Select
            value={values.owner}
            onChange={(e) => setField('owner', e.target.value)}
            options={owners.map((o) => ({ value: o, label: o }))}
            placeholder="Unassigned"
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="txn-platform" className={labelClass}>Platform</label>
          <input id="txn-platform" type="text" placeholder="e.g. Swiggy, Amazon" value={values.platform} onChange={(e) => setField('platform', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="txn-tags" className={labelClass}>Tags (comma-separated)</label>
          <input id="txn-tags" type="text" placeholder="food, travel, utilities" value={values.tags} onChange={(e) => setField('tags', e.target.value)} className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="txn-notes" className={labelClass}>Notes (optional)</label>
        <textarea
          id="txn-notes"
          rows={3}
          placeholder="Add a short description of this transaction..."
          value={values.notes}
          onChange={(e) => setField('notes', e.target.value)}
          className={`${inputClass} resize-none`}
        />
      </div>

      {errors.submit && (
        <p className="text-sm text-rose-500 text-center font-medium">{errors.submit}</p>
      )}

      <button
        type="submit"
        className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold
                   text-white shadow-sm hover:bg-brand-hover focus:outline-none
                   focus:ring-2 focus:ring-accent/30 transition-colors active:bg-brand-deep"
      >
        {isEditing ? 'Update Expense' : 'Save Expense'}
      </button>
    </form>
  );
}
