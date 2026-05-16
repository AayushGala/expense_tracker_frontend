import { useData } from '../../context/DataContext';
import { useOwners } from '../../hooks/useOwners';
import Select from '../common/Select';
import AmountInput from '../forms/AmountInput';
import AccountPicker from '../forms/AccountPicker';
import DateField from '../forms/DateField';
import { inputClass, labelClass } from '../../utils/formStyles';
import { formatINR } from '../../utils/formatters';
import {
  validateAmount,
  validateOptionalAmount,
  validateDate,
  validateRequired,
  validateDifferentAccounts,
  collectErrors,
} from '../../utils/formValidators';
import { D, round2 } from '../../utils/money';

export default function TransferForm({ values, errors, dispatch, onSubmit, isEditing }) {
  const { accounts, categories } = useData();
  const { owners } = useOwners();

  const eligibleAccounts = accounts.filter(
    (a) => (a.type === 'asset' || a.type === 'liability') && a.is_active !== false,
  );
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  function setField(name, value) {
    dispatch({ type: 'SET_FIELD', name, value });
  }

  function validate() {
    const feeDec = D(values.fee);
    return collectErrors({
      amount: validateAmount(values.amount),
      date: validateDate(values.date),
      from_account_id: validateRequired(values.from_account_id, { message: 'Select the source account.' }),
      to_account_id:
        validateRequired(values.to_account_id, { message: 'Select the destination account.' }) ??
        validateDifferentAccounts(values.from_account_id, values.to_account_id),
      fee: validateOptionalAmount(values.fee),
      fee_category_id: feeDec.gt(0)
        ? validateRequired(values.fee_category_id, { message: 'Select a category for the fee.' })
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

    const amountStr = round2(D(values.amount)).toString();
    const feeDec = D(values.fee);

    const payload = {
      type: 'transfer',
      amount: amountStr,
      date: values.date,
      from_account_id: parseInt(values.from_account_id),
      to_account_id: parseInt(values.to_account_id),
      owner: values.owner,
      platform: (values.platform ?? '').trim(),
      notes: (values.notes ?? '').trim(),
    };

    if (feeDec.gt(0) && values.fee_category_id) {
      payload.fee = round2(feeDec).toString();
      payload.fee_category_id = parseInt(values.fee_category_id);
    }

    onSubmit(payload);
  }

  const parsedAmount = D(values.amount);
  const parsedFee = D(values.fee);
  const totalDebited = parsedAmount.plus(parsedFee);

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
          accounts={eligibleAccounts}
          label="From Account"
          placeholder="Select source account"
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
          accounts={eligibleAccounts}
          label="To Account"
          placeholder="Select destination account"
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AmountInput
          id="txn-fee"
          label={<>Fee / Surcharge <span className="text-gray-400 font-normal">(optional)</span></>}
          variant="compact"
          value={values.fee}
          onChange={(v) => setField('fee', v)}
          error={errors.fee}
        />
        <div>
          <label className={labelClass}>Fee Category</label>
          <Select
            value={values.fee_category_id}
            onChange={(e) => setField('fee_category_id', e.target.value)}
            options={expenseCategories.map((c) => ({ value: String(c.id), label: c.name }))}
            placeholder="Select fee category"
          />
          {errors.fee_category_id && (
            <p className="mt-1.5 text-xs text-rose-500 font-medium">{errors.fee_category_id}</p>
          )}
        </div>
      </div>

      {parsedFee.gt(0) && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <span className="font-medium">Total debited:</span> {formatINR(totalDebited)} ({formatINR(parsedAmount)} transfer + {formatINR(parsedFee)} fee)
        </div>
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
        {isEditing ? 'Update Transfer' : 'Save Transfer'}
      </button>
    </form>
  );
}
