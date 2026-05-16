import { useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useOwners } from '../../hooks/useOwners';
import Select from '../common/Select';
import AmountInput from '../forms/AmountInput';
import AccountPicker from '../forms/AccountPicker';
import CategoryPicker from '../forms/CategoryPicker';
import DateField from '../forms/DateField';
import MyShareInput from './MyShareInput';
import PeopleList, { makePersonId } from './PeopleList';
import { inputClass, labelClass } from '../../utils/formStyles';
import {
  validateAmount,
  validateDate,
  validateRequired,
  collectErrors,
} from '../../utils/formValidators';
import { D, ZERO, sum, round2 } from '../../utils/money';

// `values.amount` holds the total bill (the field is labeled "Total Bill
// Amount" in the UI); `my_share` is computed and submitted separately.
export default function SplitExpenseForm({ values, errors, dispatch, onSubmit, isEditing }) {
  const { accounts, categories } = useData();
  const { owners } = useOwners();

  const payableAccounts = accounts.filter(
    (a) => (a.type === 'asset' || a.type === 'liability') && a.is_active !== false,
  );
  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const receivableAccount = accounts.find((a) => a.type === 'receivable') ?? null;

  function setField(name, value) {
    dispatch({ type: 'SET_FIELD', name, value });
  }

  // Seed one empty row on mount so the list is never empty in the UI.
  useEffect(() => {
    if ((values.other_people?.length ?? 0) === 0) {
      setField('other_people', [{ id: makePersonId(), name: '', amount: '' }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsedTotal = D(values.amount);
  const parsedTotalPeople = parseInt(values.total_people, 10) || 2;

  const computedMyShare =
    values.my_share_type === 'equal'
      ? parsedTotal.gt(0) && parsedTotalPeople > 0
        ? round2(parsedTotal.dividedBy(parsedTotalPeople))
        : ZERO
      : D(values.custom_my_share);

  const othersTotal = round2(parsedTotal.minus(computedMyShare));

  function validate() {
    const errs = collectErrors({
      amount: validateAmount(values.amount, { message: 'Enter a valid total amount.' }),
      date: validateDate(values.date),
      from_account_id: validateRequired(values.from_account_id, { message: 'Select the paying account.' }),
      category_id: validateRequired(values.category_id, { message: 'Select a category.' }),
    });
    if (!receivableAccount) {
      errs.submit = 'No receivable account found. Please add a receivable account first.';
    }
    if (values.my_share_type === 'custom') {
      const ms = D(values.custom_my_share);
      if (values.custom_my_share === '' || ms.lt(0)) errs.custom_my_share = 'Enter a valid share amount.';
      else if (ms.gt(parsedTotal)) errs.custom_my_share = 'My share cannot exceed the total amount.';
    }
    const people = values.other_people ?? [];
    people.forEach((p, idx) => {
      if (!p.name.trim()) errs[`person_name_${idx}`] = 'Name is required.';
      const amt = D(p.amount);
      if (p.amount === '' || amt.lt(0)) errs[`person_amount_${idx}`] = 'Enter a valid amount.';
    });
    const sumOthers = sum(people.map((p) => p.amount));
    if (parsedTotal.gt(0) && people.length > 0 && sumOthers.minus(othersTotal).abs().gt('0.02')) {
      errs.other_people = `Others' amounts (₹${sumOthers.toFixed(2)}) must add up to ₹${othersTotal.toFixed(2)}.`;
    }
    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      dispatch({ type: 'SET_ERRORS', errors: errs });
      return;
    }

    onSubmit({
      type: 'split_expense',
      total_amount: round2(parsedTotal).toString(),
      my_share: round2(computedMyShare).toString(),
      date: values.date,
      from_account_id: parseInt(values.from_account_id),
      category_id: parseInt(values.category_id),
      receivable_account_id: receivableAccount.id,
      owner: values.owner,
      platform: (values.platform ?? '').trim(),
      notes: (values.notes ?? '').trim(),
      receivables: (values.other_people ?? []).map((person) => ({
        person_name: person.name.trim(),
        amount_owed: round2(D(person.amount)).toString(),
      })),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <AmountInput
        label="Total Bill Amount"
        value={values.amount}
        onChange={(v) => setField('amount', v)}
        error={errors.amount}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DateField value={values.date} onChange={(v) => setField('date', v)} error={errors.date} />
        <AccountPicker
          value={values.from_account_id}
          accounts={payableAccounts}
          label="Paying Account"
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
          label="Expense Category"
          error={errors.category_id}
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
        <label htmlFor="txn-total-people" className={labelClass}>Total Number of People</label>
        <input
          id="txn-total-people"
          type="number"
          inputMode="numeric"
          min="2"
          step="1"
          value={values.total_people}
          onChange={(e) => setField('total_people', e.target.value)}
          className={inputClass}
        />
      </div>

      <MyShareInput
        myShareType={values.my_share_type}
        customMyShare={values.custom_my_share}
        totalPeople={parsedTotalPeople}
        parsedTotal={parsedTotal}
        computedMyShare={computedMyShare}
        error={errors.custom_my_share}
        onModeChange={(mode) => setField('my_share_type', mode)}
        onCustomChange={(v) => setField('custom_my_share', v)}
      />

      {parsedTotal.gt(0) && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
          Others owe you: <span className="font-bold">₹{othersTotal.toFixed(2)}</span>
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
          rows={2}
          placeholder="Optional notes"
          value={values.notes}
          onChange={(e) => setField('notes', e.target.value)}
          className={`${inputClass} resize-none`}
        />
      </div>

      <PeopleList
        people={values.other_people}
        errors={errors}
        listError={errors.other_people}
        onChange={(newPeople) => setField('other_people', newPeople)}
      />

      {errors.submit && (
        <p className="text-sm text-red-500 text-center">{errors.submit}</p>
      )}

      <button
        type="submit"
        className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold
                   text-white shadow-sm hover:bg-brand-hover focus:outline-none
                   focus:ring-2 focus:ring-accent/30 transition-colors"
      >
        {isEditing ? 'Update Split Expense' : 'Save Split Expense'}
      </button>
    </form>
  );
}
