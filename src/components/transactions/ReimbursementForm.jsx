import { useData } from '../../context/DataContext';
import { useOwners } from '../../hooks/useOwners';
import { usePeople } from '../../hooks/useReportData';
import { formatINR } from '../../utils/formatters';
import Select from '../common/Select';
import AccountPicker from '../forms/AccountPicker';
import DateField from '../forms/DateField';
import PersonInput from '../forms/PersonInput';
import { inputClass, labelClass, errorClass, categoryOptions } from '../../utils/formStyles';
import {
  validateAmount,
  validateDate,
  validateRequired,
  collectErrors,
} from '../../utils/formValidators';
import { D, ZERO, round2 } from '../../utils/money';
import {
  balanceOf, balanceSentence, settlingAmount, SETTLE_GROUPS, SETTLE_MODES,
} from '../../utils/people';

// The People form: one movement in a person's running balance (positive:
// they owe you). Money sent, paid for them, and a write-off of what you owe
// are payouts; the rest are reimbursements.

const AMOUNT_LABELS = {
  money: 'Amount Received',
  money_out: 'Amount Sent',
  paid_for_me: 'Amount They Paid For You',
  paid_for_them: 'Amount You Paid For Them',
  write_off: 'Amount to Write Off',
};

export default function ReimbursementForm({ values, errors, dispatch, onSubmit, isEditing }) {
  const { accounts, categories, receivables } = useData();
  const { owners } = useOwners();
  const people = usePeople();

  const lostAndFound = categories.find((c) => c.role === 'adjustment' && c.type === 'expense') ?? null;
  const spendCategories = categories.filter((c) => c.type === 'expense' && !c.role);
  // Edit loads a category settlement as 'category'; Lost & Found means a write-off.
  const mode = values.settle_mode === 'category'
    ? (String(values.category_id) === String(lostAndFound?.id) ? 'write_off' : 'paid_for_me')
    : (values.settle_mode || 'money');

  const assetAccounts = accounts.filter((a) => a.type === 'asset' && a.is_active !== false);
  // Paying for someone can go on a card too.
  const payingAccounts = accounts.filter(
    (a) => (a.type === 'asset' || a.type === 'liability') && a.is_active !== false,
  );
  const receivableAccounts = accounts.filter((a) => a.type === 'receivable');

  const personName = (values.person_name ?? '').trim();
  const balance = personName ? balanceOf(receivables, personName) : ZERO;
  const fullAmount = settlingAmount(mode, balance);

  function setField(name, value) {
    dispatch({ type: 'SET_FIELD', name, value });
  }

  function setMode(next) {
    setField('settle_mode', next);
    if (next === 'write_off') setField('category_id', lostAndFound ? String(lostAndFound.id) : '');
    else if (next === 'paid_for_me' && mode === 'write_off') setField('category_id', '');
    dispatch({ type: 'CLEAR_ERRORS' });
  }

  function validate() {
    const errs = collectErrors({
      person_name: validateRequired(personName, { message: 'Enter who the money is with.' }),
      amount: validateAmount(values.amount),
      date: validateDate(values.date),
      to_account_id: mode === 'money'
        ? validateRequired(values.to_account_id, { message: 'Select the account the money came into.' })
        : null,
      from_account_id: mode === 'money_out' || mode === 'paid_for_them'
        ? validateRequired(values.from_account_id, { message: 'Select the account the money left from.' })
        : null,
      category_id: mode === 'paid_for_me'
        ? validateRequired(values.category_id, { message: 'Select what they paid for.' })
        : null,
    });
    if (mode === 'write_off' && !lostAndFound) errs.submit = 'No Lost & Found category found.';
    // Only a new write-off is capped; an edit already counts in the balance.
    if (!isEditing && mode === 'write_off' && !errs.amount && D(values.amount).minus(fullAmount).gt('0.001')) {
      errs.amount = `The balance with ${personName} is ${formatINR(fullAmount)}.`;
    }
    if (receivableAccounts.length === 0) errs.submit = 'No receivable account found in your accounts.';
    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      dispatch({ type: 'SET_ERRORS', errors: errs });
      return;
    }

    const target = {
      money: { to_account_id: parseInt(values.to_account_id) },
      money_out: { from_account_id: parseInt(values.from_account_id) },
      paid_for_me: { category_id: parseInt(values.category_id) },
      paid_for_them: { from_account_id: parseInt(values.from_account_id) },
      write_off: { category_id: parseInt(lostAndFound?.id) },
    }[mode];
    // What a payment for them was for: optional, and never spending.
    const forCategory = mode === 'paid_for_them' && values.for_category_id
      ? parseInt(values.for_category_id)
      : null;

    if (!isEditing) {
      // TransactionForm sends this to /receivables/settle/, which picks the
      // type and the write-off direction from the balance.
      onSubmit({
        type: 'reimbursement',
        person_name: personName,
        mode,
        amount: round2(D(values.amount)).toString(),
        date: values.date,
        ...target,
        ...(forCategory ? { category_id: forCategory } : {}),
        owner: values.owner,
        notes: (values.notes ?? '').trim(),
      });
      return;
    }

    // A write-off keeps the direction it was recorded with.
    const type = SETTLE_MODES.find((m) => m.value === mode).group === 'out'
      || (mode === 'write_off' && values.settle_type === 'payout')
      ? 'payout'
      : 'reimbursement';
    const receivableAccount = receivableAccounts.find((a) => String(a.id) === String(values.receivable_account_id))
      ?? receivableAccounts.find((a) => a.owner && a.owner === values.owner)
      ?? receivableAccounts[0];
    onSubmit({
      type,
      person_name: personName,
      amount: round2(D(values.amount)).toString(),
      date: values.date,
      ...target,
      ...(forCategory ? { for_category_id: forCategory } : {}),
      receivable_account_id: receivableAccount.id,
      owner: values.owner,
      platform: (values.platform ?? '').trim(),
      notes: (values.notes ?? '').trim(),
    });
  }

  const modeInfo = SETTLE_MODES.find((m) => m.value === mode);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="txn-person" className={labelClass}>Who</label>
        <PersonInput
          id="txn-person"
          placeholder="Person name"
          value={values.person_name ?? ''}
          onChange={(name) => setField('person_name', name)}
          people={people}
        />
        {personName && !isEditing && <p className="mt-1 text-[11px] text-gray-400">{balanceSentence(personName, balance)}</p>}
        {errors.person_name && <p className={errorClass}>{errors.person_name}</p>}
      </div>

      <div>
        <label className={labelClass}>What Happened</label>
        <div className="space-y-2">
          {SETTLE_GROUPS.map(([group, heading]) => (
            <div key={group} className="grid grid-cols-[5.5rem_1fr_1fr] items-center gap-2">
              <span className="text-[11px] font-medium text-gray-400">{heading}</span>
              {SETTLE_MODES.filter((m) => m.group === group).map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={`rounded-xl border py-2.5 text-xs font-semibold transition-colors ${
                    mode === m.value
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400">{modeInfo.help}</p>
      </div>

      <div>
        <label htmlFor="txn-amount" className={labelClass}>{AMOUNT_LABELS[mode]}</label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">₹</span>
          <input
            id="txn-amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={values.amount}
            onChange={(e) => setField('amount', e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-10 pr-4 py-4 text-2xl font-bold text-gray-900 transition-colors focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 placeholder-gray-300"
          />
        </div>
        {!isEditing && fullAmount.gt(0) && (
          <button
            type="button"
            onClick={() => setField('amount', fullAmount.toString())}
            className="mt-1 text-xs text-accent hover:underline"
          >
            Fill full balance ({formatINR(fullAmount)})
          </button>
        )}
        {errors.amount && <p className={errorClass}>{errors.amount}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DateField value={values.date} onChange={(v) => setField('date', v)} error={errors.date} />
        {mode === 'money' && (
          <AccountPicker
            value={values.to_account_id}
            accounts={assetAccounts}
            label="Received Into"
            error={errors.to_account_id}
            onChange={(accountId, owner) => {
              setField('to_account_id', accountId);
              setField('owner', owner);
            }}
          />
        )}
        {mode === 'money_out' && (
          <AccountPicker
            value={values.from_account_id}
            accounts={assetAccounts}
            label="Sent From"
            error={errors.from_account_id}
            onChange={(accountId, owner) => {
              setField('from_account_id', accountId);
              setField('owner', owner);
            }}
          />
        )}
        {mode === 'paid_for_them' && (
          <AccountPicker
            value={values.from_account_id}
            accounts={payingAccounts}
            label="Paid From"
            error={errors.from_account_id}
            onChange={(accountId, owner) => {
              setField('from_account_id', accountId);
              setField('owner', owner);
            }}
          />
        )}
        {mode === 'paid_for_them' && (
          <div>
            <label className={labelClass}>What For (Optional)</label>
            <Select
              value={values.for_category_id}
              onChange={(e) => setField('for_category_id', e.target.value)}
              options={categoryOptions(spendCategories)}
              placeholder="Not recorded"
            />
          </div>
        )}
        {mode === 'paid_for_me' && (
          <div>
            <label className={labelClass}>What They Paid For</label>
            <Select
              value={values.category_id}
              onChange={(e) => setField('category_id', e.target.value)}
              options={categoryOptions(spendCategories)}
              placeholder="Select category"
            />
            {errors.category_id && <p className={errorClass}>{errors.category_id}</p>}
          </div>
        )}
      </div>

      {/* Money modes take the owner from the account picked. */}
      {owners.length > 0 && (isEditing || mode === 'paid_for_me' || mode === 'write_off') && (
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

      {isEditing && (
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
      )}

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

      {errors.submit && (
        <p className="text-sm text-red-500 text-center">{errors.submit}</p>
      )}

      <button
        type="submit"
        className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold
                   text-white shadow-sm hover:bg-brand-hover focus:outline-none
                   focus:ring-2 focus:ring-accent/30 transition-colors"
      >
        {isEditing ? 'Update' : 'Save'}
      </button>
    </form>
  );
}
