import { useData } from '../../context/DataContext';
import { useOwners } from '../../hooks/useOwners';
import Select from '../common/Select';
import AmountInput from '../forms/AmountInput';
import AccountPicker from '../forms/AccountPicker';
import DateField from '../forms/DateField';
import { inputClass, labelClass } from '../../utils/formStyles';
import {
  validateAmount,
  validateDate,
  validateRequired,
  collectErrors,
} from '../../utils/formValidators';
import { D, round2 } from '../../utils/money';

export default function BillPaymentForm({ values, errors, dispatch, onSubmit, isEditing }) {
  const { accounts } = useData();
  const { owners } = useOwners();

  const bankAccounts = accounts.filter((a) => a.type === 'asset' && a.is_active !== false);
  const liabilityAccounts = accounts.filter((a) => a.type === 'liability' && a.is_active !== false);

  function setField(name, value) {
    dispatch({ type: 'SET_FIELD', name, value });
  }

  function validate() {
    return collectErrors({
      amount: validateAmount(values.amount),
      date: validateDate(values.date),
      from_account_id: validateRequired(values.from_account_id, { message: 'Select the bank/asset account.' }),
      to_account_id: validateRequired(values.to_account_id, { message: 'Select the credit card/liability account.' }),
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      dispatch({ type: 'SET_ERRORS', errors: errs });
      return;
    }

    onSubmit({
      type: 'bill_payment',
      amount: round2(D(values.amount)).toString(),
      date: values.date,
      from_account_id: parseInt(values.from_account_id),
      to_account_id: parseInt(values.to_account_id),
      owner: values.owner,
      platform: (values.platform ?? '').trim(),
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
          accounts={bankAccounts}
          label="Paid From (Bank / Asset Account)"
          placeholder="Select bank account"
          error={errors.from_account_id}
          onChange={(accountId, owner) => {
            setField('from_account_id', accountId);
            setField('owner', owner);
          }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AccountPicker
          value={values.to_account_id}
          accounts={liabilityAccounts}
          label="Paid To (Credit Card / Liability)"
          placeholder="Select liability account"
          error={errors.to_account_id}
          onChange={(accountId) => setField('to_account_id', accountId)}
        />

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
      </div>

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
        {isEditing ? 'Update Bill Payment' : 'Save Bill Payment'}
      </button>
    </form>
  );
}
