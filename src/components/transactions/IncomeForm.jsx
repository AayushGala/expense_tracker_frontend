import { useEffect, useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { useOwners } from '../../hooks/useOwners';
import CalendarPicker from '../common/CalendarPicker';
import Select from '../common/Select';
import SourceTransactionPicker from './SourceTransactionPicker';
import { inputClass, labelClass, errorClass, accountOption, categoryOptions } from '../../utils/formStyles';

/**
 * Form for recording an income transaction.
 *
 * Special handling: when the user picks the "Refund" category (identified by
 * role='refund'), a source-transaction picker appears. After picking a source,
 * amount and to_account auto-fill from the source. The category sent to the
 * backend stays the Refund category, but the entry generator credits the
 * source's category for the offset (split-brain).
 */
export default function IncomeForm({ onSubmit, initialData }) {
  const { accounts, categories, transactions, entries } = useData();
  const { owners, getAccountOwner } = useOwners();

  // Income normally lands in an asset account, but refunds can come back to a
  // credit card (liability). Allow both.
  const receivingAccounts = accounts.filter(
    (a) => (a.type === 'asset' || a.type === 'liability') && a.is_active !== false,
  );
  const incomeCategories = categories.filter((c) => c.type === 'income');

  // Lookup helpers for the role-tagged refund category.
  const refundCategory = useMemo(
    () => categories.find((c) => c.role === 'refund'),
    [categories]
  );
  const refundCategoryId = refundCategory ? String(refundCategory.id) : null;

  const today = new Date().toISOString().slice(0, 10);

  const [amount, setAmount] = useState(initialData?.amount ?? '');
  const [date, setDate] = useState(initialData?.date ?? today);
  const [toAccountId, setToAccountId] = useState(String(initialData?.to_account_id ?? ''));
  const [categoryId, setCategoryId] = useState(String(initialData?.category_id ?? ''));
  const [sourceTransactionId, setSourceTransactionId] = useState(initialData?.source_transaction_id ?? null);
  const [owner, setOwner] = useState(initialData?.owner ?? '');
  const [platform, setPlatform] = useState(initialData?.platform ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [errors, setErrors] = useState({});

  const isRefundMode = refundCategoryId !== null && categoryId === refundCategoryId;

  // Quick lookup map for entries grouped by transaction id (used for source detail display)
  const entriesByTxn = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      if (!map.has(e.transaction_id)) map.set(e.transaction_id, []);
      map.get(e.transaction_id).push(e);
    }
    return map;
  }, [entries]);

  const sourceTxn = useMemo(() => {
    if (!sourceTransactionId) return null;
    return transactions.find((t) => t.id === sourceTransactionId) ?? null;
  }, [transactions, sourceTransactionId]);

  const sourceCategoryName = useMemo(() => {
    if (!sourceTxn) return '';
    const cat = categories.find((c) => c.id === sourceTxn.category_id);
    return cat?.name ?? '';
  }, [sourceTxn, categories]);

  // When user switches OUT of refund mode, clear the source link
  useEffect(() => {
    if (!isRefundMode && sourceTransactionId) {
      setSourceTransactionId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRefundMode]);

  // Auto-fill amount and account from the picked source. Driven by the picker's
  // onChange so it runs only on user action — never on edit-form mount, which
  // would clobber a saved partial-refund amount.
  function handleSourceChange(id) {
    setSourceTransactionId(id);
    if (!id) {
      setAmount('');
      handleToAccountChange('');
      return;
    }
    const creditEntry = (entriesByTxn.get(id) ?? [])
      .find((e) => e.entry_type === 'CREDIT' && e.account_id);
    if (creditEntry) {
      setAmount(String(creditEntry.amount));
      handleToAccountChange(String(creditEntry.account_id));
    }
  }

  function handleToAccountChange(accountId) {
    setToAccountId(accountId);
    setOwner(getAccountOwner(accountId));
  }

  function validate() {
    const errs = {};
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      errs.amount = 'Enter a valid positive amount.';
    }
    if (!date) errs.date = 'Date is required.';
    if (!toAccountId) errs.toAccountId = 'Select a destination account.';
    if (!categoryId) errs.categoryId = 'Select an income category.';
    if (isRefundMode && !sourceTransactionId) {
      errs.sourceTransactionId = 'Pick the original expense being refunded.';
    }
    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const parsedAmount = parseFloat(amount);

    const payload = {
      type: 'income',
      amount: parsedAmount,
      date,
      to_account_id: parseInt(toAccountId),
      category_id: parseInt(categoryId),
      owner,
      platform: platform.trim(),
      notes: notes.trim(),
    };

    if (sourceTransactionId) {
      payload.source_transaction_id = sourceTransactionId;
    }

    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Amount */}
      <div>
        <label htmlFor="txn-amount" className={labelClass}>Amount</label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">₹</span>
          <input
            id="txn-amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-10 pr-4 py-4 text-2xl font-bold text-gray-900 transition-colors focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 placeholder-gray-300"
          />
        </div>
        {isRefundMode && (
          <p className="text-[11px] text-gray-400 mt-1">
            Auto-filled from the source. Edit for partial refunds.
          </p>
        )}
        {errors.amount && <p className={errorClass}>{errors.amount}</p>}
      </div>

      {/* Date + Received Into */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Date</label>
          <CalendarPicker value={date} onChange={(val) => setDate(val)} className="w-full" />
          {errors.date && <p className={errorClass}>{errors.date}</p>}
        </div>

        <div>
          <label className={labelClass}>Received Into</label>
          <Select
            value={toAccountId}
            onChange={(e) => handleToAccountChange(e.target.value)}
            options={receivingAccounts.map(accountOption)}
            placeholder="Select account"
          />
          {isRefundMode && (
            <p className="text-[11px] text-gray-400 mt-1">
              Defaults to source's account. Override if refunded elsewhere.
            </p>
          )}
          {errors.toAccountId && <p className={errorClass}>{errors.toAccountId}</p>}
        </div>
      </div>

      {/* Category + Owner */}
      {owners.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Income Category</label>
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={categoryOptions(incomeCategories)}
              placeholder="Select category"
            />
            {errors.categoryId && <p className={errorClass}>{errors.categoryId}</p>}
          </div>

          <div>
            <label className={labelClass}>Owner</label>
            <Select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              options={owners.map((o) => ({ value: o, label: o }))}
              placeholder="Unassigned"
            />
          </div>
        </div>
      ) : (
        <div>
          <label className={labelClass}>Income Category</label>
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={categoryOptions(incomeCategories)}
            placeholder="Select category"
          />
          {errors.categoryId && <p className={errorClass}>{errors.categoryId}</p>}
        </div>
      )}

      {/* Refund-specific section */}
      {isRefundMode && (
        <div className="space-y-3 p-4 rounded-xl bg-accent-light/40 border border-accent/30">
          <div>
            <label className={labelClass}>Original Transaction</label>
            <SourceTransactionPicker
              value={sourceTransactionId}
              onChange={handleSourceChange}
            />
            {errors.sourceTransactionId && <p className={errorClass}>{errors.sourceTransactionId}</p>}
          </div>
          {sourceTxn && sourceCategoryName && (
            <div>
              <label className={labelClass}>Refund Of (Category)</label>
              <div className="w-full rounded-xl border border-gray-200 bg-gray-100 px-3 py-2.5 text-sm text-gray-700">
                {sourceCategoryName}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Platform */}
      <div>
        <label htmlFor="txn-platform" className={labelClass}>Platform</label>
        <input
          id="txn-platform"
          type="text"
          placeholder="e.g. Swiggy, Amazon, Flipkart"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="txn-notes" className={labelClass}>Notes</label>
        <textarea
          id="txn-notes"
          rows={3}
          placeholder="Optional notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
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
        {initialData?.id ? (isRefundMode ? 'Update Refund' : 'Update Income') : (isRefundMode ? 'Save Refund' : 'Save Income')}
      </button>
    </form>
  );
}
