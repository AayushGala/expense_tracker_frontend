import { useMemo, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { useOwners } from '../../hooks/useOwners';
import { formatINR } from '../../utils/formatters';
import Select from '../common/Select';
import AccountPicker from '../forms/AccountPicker';
import DateField from '../forms/DateField';
import { inputClass, labelClass, errorClass, categoryOptions } from '../../utils/formStyles';
import {
  validateAmount,
  validateDate,
  validateRequired,
  collectErrors,
} from '../../utils/formValidators';
import { D, ZERO, round2 } from '../../utils/money';

const SETTLE_MODES = [
  { value: 'money', label: 'Money received' },
  { value: 'paid_for_me', label: 'Paid for me' },
  { value: 'write_off', label: 'Write off' },
];

const AMOUNT_LABELS = {
  money: 'Amount Received',
  paid_for_me: 'Amount They Paid For You',
  write_off: 'Amount to Write Off',
};

export default function ReimbursementForm({ values, errors, dispatch, onSubmit, isEditing }) {
  const { accounts, categories, receivables } = useData();
  const { owners } = useOwners();

  // A receivable settles with money, with an expense the person paid for you
  // (counts as your spending), or by a write-off into Lost & Found (excluded
  // from reports). The last two have no account side.
  const lostAndFound = categories.find((c) => c.role === 'adjustment' && c.type === 'expense') ?? null;
  const spendCategories = categories.filter((c) => c.type === 'expense' && !c.role);
  const mode = values.settle_mode === 'category'
    ? (String(values.category_id) === String(lostAndFound?.id) ? 'write_off' : 'paid_for_me')
    : (values.settle_mode || 'money');

  function setMode(next) {
    setField('settle_mode', next);
    if (next === 'write_off') setField('category_id', lostAndFound ? String(lostAndFound.id) : '');
    else if (next === 'paid_for_me' && mode === 'write_off') setField('category_id', '');
    dispatch({ type: 'CLEAR_ERRORS' });
  }

  const assetAccounts = accounts.filter((a) => a.type === 'asset' && a.is_active !== false);
  const receivableAccount = accounts.find((a) => a.type === 'receivable') ?? null;

  function setField(name, value) {
    dispatch({ type: 'SET_FIELD', name, value });
  }

  const availableReceivables = useMemo(
    () =>
      (receivables ?? []).filter(
        (r) => isEditing || r.status === 'pending' || r.status === 'partial',
      ),
    [receivables, isEditing],
  );

  // New: settle a person's total, oldest split first (server-side, may create
  // several reimbursements). Edit: an existing reimbursement settles one split.
  const people = useMemo(() => {
    const byKey = new Map();
    for (const r of availableReceivables) {
      const key = r.person_name.trim().toLowerCase();
      if (!byKey.has(key)) byKey.set(key, { key, name: r.person_name.trim(), outstanding: ZERO, splits: 0 });
      const p = byKey.get(key);
      p.outstanding = p.outstanding.plus(D(r.amount_owed).minus(D(r.amount_settled)));
      p.splits += 1;
    }
    return [...byKey.values()].filter((p) => p.outstanding.gt(0));
  }, [availableReceivables]);
  const selectedPerson = people.find((p) => p.key === values.selected_person) ?? null;

  // On edit, the outstanding-balance ceiling needs to add back this
  // transaction's *original* amount so the user can re-confirm or downsize
  // the same settlement without hitting "amount exceeds outstanding".
  // Captured via a ref on first mount; `values.amount` reflects edits only.
  const originalAmountRef = useRef(null);
  const originalReceivableIdRef = useRef(null);
  if (originalAmountRef.current === null) {
    originalAmountRef.current = isEditing ? D(values.amount) : ZERO;
    originalReceivableIdRef.current = isEditing ? String(values.selected_receivable_id ?? '') : '';
  }
  const previousAmount = originalAmountRef.current;
  const originalReceivableId = originalReceivableIdRef.current;

  const selectedReceivable = availableReceivables.find(
    (r) => String(r.id) === String(values.selected_receivable_id),
  ) ?? null;

  const currentOutstanding = selectedReceivable
    ? round2(D(selectedReceivable.amount_owed).minus(D(selectedReceivable.amount_settled)))
    : ZERO;
  const outstanding = isEditing
    ? round2(currentOutstanding.plus(previousAmount))
    : round2(selectedPerson?.outstanding ?? ZERO);

  function validate() {
    const errs = collectErrors({
      selected_receivable_id: isEditing
        ? validateRequired(values.selected_receivable_id, { message: 'Select a receivable to settle.' })
        : null,
      selected_person: isEditing
        ? null
        : validateRequired(values.selected_person, { message: 'Choose who is settling.' }),
      amount: validateAmount(values.amount),
      date: validateDate(values.date),
      to_account_id: mode === 'money'
        ? validateRequired(values.to_account_id, { message: 'Select the account receiving the payment.' })
        : null,
      category_id: mode === 'paid_for_me'
        ? validateRequired(values.category_id, { message: 'Select what they paid for.' })
        : null,
    });
    if (mode === 'write_off' && !lostAndFound) {
      errs.submit = 'No Lost & Found category found.';
    }
    // Amount-vs-outstanding ceiling: only check if base amount validation passed.
    if (!errs.amount) {
      const parsedAmount = D(values.amount);
      if (parsedAmount.minus(outstanding).gt('0.001')) {
        errs.amount = `Amount cannot exceed outstanding balance of ${formatINR(outstanding)}.`;
      }
    }
    if (isEditing && !receivableAccount) {
      errs.submit = 'No receivable account found in your accounts.';
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

    const target = mode === 'money'
      ? { to_account_id: parseInt(values.to_account_id) }
      : { category_id: parseInt(mode === 'write_off' ? lostAndFound.id : values.category_id) };

    if (!isEditing) {
      // TransactionForm sends this to /receivables/settle/.
      onSubmit({
        type: 'reimbursement',
        person_name: selectedPerson.name,
        mode,
        amount: round2(D(values.amount)).toString(),
        date: values.date,
        ...target,
        notes: (values.notes ?? '').trim(),
      });
      return;
    }

    onSubmit({
      type: 'reimbursement',
      amount: round2(D(values.amount)).toString(),
      date: values.date,
      ...target,
      receivable_account_id: receivableAccount.id,
      settle_receivable_id: parseInt(values.selected_receivable_id),
      owner: values.owner,
      platform: (values.platform ?? '').trim(),
      notes: (values.notes ?? '').trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {(isEditing ? availableReceivables.length === 0 : people.length === 0) ? (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          No pending receivables found.
        </div>
      ) : (
        <>
          {!isEditing ? (
            <div>
              <label className={labelClass}>Who</label>
              <Select
                value={values.selected_person}
                onChange={(e) => {
                  setField('selected_person', e.target.value);
                  setField('amount', '');
                  dispatch({ type: 'CLEAR_ERRORS' });
                }}
                options={people.map((p) => ({
                  value: p.key,
                  label: `${p.name} — ${formatINR(p.outstanding)} outstanding`
                    + (p.splits > 1 ? ` (${p.splits} splits)` : ''),
                }))}
                placeholder="Choose a person"
              />
              {errors.selected_person && <p className={errorClass}>{errors.selected_person}</p>}
            </div>
          ) : (
          <div>
            <label className={labelClass}>Select Receivable</label>
            <Select
              value={values.selected_receivable_id}
              onChange={(e) => {
                setField('selected_receivable_id', e.target.value);
                setField('amount', '');
                dispatch({ type: 'CLEAR_ERRORS' });
              }}
              options={availableReceivables.map((r) => {
                const owed = D(r.amount_owed ?? 0).minus(D(r.amount_settled ?? 0));
                const effective = isEditing && String(r.id) === originalReceivableId
                  ? round2(owed.plus(previousAmount))
                  : owed;
                return { value: String(r.id), label: `${r.person_name} — ${formatINR(effective)} outstanding` };
              })}
              placeholder="Choose a person"
            />
            {errors.selected_receivable_id && (
              <p className={errorClass}>{errors.selected_receivable_id}</p>
            )}
          </div>
          )}

          {isEditing && selectedReceivable && previousAmount.gt(0) && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-500">
              This reimbursement previously settled <span className="font-semibold text-gray-700">{formatINR(previousAmount)}</span>.
              Total outstanding including this transaction: <span className="font-semibold text-gray-700">{formatINR(outstanding)}</span>
            </div>
          )}

          <div>
            <label className={labelClass}>Settle With</label>
            <div className="grid grid-cols-3 gap-2">
              {SETTLE_MODES.map((m) => (
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
            <p className="mt-1.5 text-[11px] text-gray-400">
              {mode === 'money' && 'They paid you back into one of your accounts.'}
              {mode === 'paid_for_me' && 'They paid for something of yours instead. It counts as your spending and reduces what they owe.'}
              {mode === 'write_off' && 'You will not get this back. It moves to Lost & Found and does not count as spending.'}
            </p>
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
            {(isEditing ? selectedReceivable : selectedPerson) && (
              <button
                type="button"
                onClick={() => setField('amount', outstanding.toString())}
                className="mt-1 text-xs text-accent hover:underline"
              >
                Fill full outstanding ({formatINR(outstanding)})
              </button>
            )}
            {!isEditing && selectedPerson?.splits > 1 && (
              <p className="mt-1 text-[11px] text-gray-400">Settles the oldest splits first.</p>
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

          {/* New settlements take owner from each split, platform n/a. */}
          {isEditing && owners.length > 0 && (
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
            {isEditing ? 'Update Reimbursement' : 'Record Reimbursement'}
          </button>
        </>
      )}
    </form>
  );
}
