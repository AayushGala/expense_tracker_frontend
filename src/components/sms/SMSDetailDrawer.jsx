import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import api from '../../api/client';
import CalendarPicker from '../common/CalendarPicker';
import Select from '../common/Select';
import SMSStatusBadge from './SMSStatusBadge';
import {
  inputClass, labelClass, errorClass, accountOption, categoryOptions,
} from '../../utils/formStyles';
import { formatDate, formatINR } from '../../utils/formatters';

/**
 * Detail + confirm modal for an SMS. Always shows the original body, the
 * masked version that was sent to the LLM (so the user can audit masking),
 * and the parsed fields. If the SMS is in `parsed` status, the editable
 * confirm form appears below for one-click confirmation.
 */
export default function SMSDetailDrawer({ sms, onSuccess, onClose, onViewLinkedTransaction }) {
  const navigate = useNavigate();
  const { accounts, categories, loadData } = useData();

  const usableAccounts = accounts.filter(
    (a) => (a.type === 'asset' || a.type === 'liability') && a.is_active !== false,
  );

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const today = new Date().toISOString().slice(0, 10);
  const initialType = sms?.parsed_direction === 'credit' ? 'income' : 'expense';
  const isParsed = sms?.status === 'parsed';
  const isConfirmed = sms?.status === 'confirmed';

  const [type, setType] = useState(initialType);
  const [amount, setAmount] = useState(sms?.parsed_amount ?? '');
  const [date, setDate] = useState(sms?.parsed_date ?? today);
  const [accountId, setAccountId] = useState(String(sms?.parsed_account ?? ''));
  const [categoryId, setCategoryId] = useState(String(sms?.parsed_category ?? ''));
  const [beneficiary, setBeneficiary] = useState(sms?.parsed_beneficiary ?? '');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  // Reset state when the sms prop changes
  useEffect(() => {
    if (!sms) return;
    const t = sms.parsed_direction === 'credit' ? 'income' : 'expense';
    setType(t);
    setAmount(sms.parsed_amount ?? '');
    setDate(sms.parsed_date ?? today);
    setAccountId(String(sms.parsed_account ?? ''));
    setCategoryId(String(sms.parsed_category ?? ''));
    setBeneficiary(sms.parsed_beneficiary ?? '');
    setNotes('');
    setErrors({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sms?.id]);

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => c.type === type);
  }, [categories, type]);

  function validate() {
    const errs = {};
    const parsed = parseFloat(amount);
    if (!amount || Number.isNaN(parsed) || parsed <= 0) errs.amount = 'Enter a positive amount.';
    if (!date) errs.date = 'Date is required.';
    if (!accountId) errs.accountId = 'Select an account.';
    if (!categoryId) errs.categoryId = 'Select a category.';
    return errs;
  }

  async function handleConfirm() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      await api.confirmSMS(sms.id, {
        type,
        amount: parseFloat(amount),
        date,
        from_account_id: parseInt(accountId, 10),
        category_id: parseInt(categoryId, 10),
        beneficiary,
        notes,
      });
      if (loadData) await loadData();
      onSuccess?.();
    } catch (err) {
      setErrors({ submit: err.message || 'Failed to confirm SMS.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReparse() {
    setActionBusy(true);
    try {
      await api.reparseSMS(sms.id);
      onSuccess?.();
    } catch (err) {
      setErrors({ submit: err.message || 'Reparse failed.' });
    } finally {
      setActionBusy(false);
    }
  }

  function handleOpenInForm() {
    navigate(`/transactions/new?from_sms=${sms.id}`);
    onClose?.();
  }

  function handleViewLinkedTxn() {
    if (onViewLinkedTransaction) {
      onViewLinkedTransaction(sms.transaction);
    }
  }

  if (!sms) return null;

  // Resolve parsed FK references to display names
  const parsedAccountName = sms.parsed_account ? accountMap.get(sms.parsed_account)?.name : null;
  const parsedCategoryName = sms.parsed_category ? categoryMap.get(sms.parsed_category)?.name : null;

  const hasParsedFields = (
    sms.parsed_amount != null ||
    sms.parsed_direction ||
    sms.parsed_account != null ||
    sms.parsed_category != null ||
    sms.parsed_beneficiary ||
    sms.parsed_date ||
    sms.parse_confidence
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">
            {sms.sender || 'Unknown sender'}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {sms.received_at && formatDate(sms.received_at)}
            {sms.device_identifier && <> · {sms.device_identifier}</>}
          </p>
        </div>
        <SMSStatusBadge status={sms.status} />
      </div>

      {/* Original SMS body */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1.5">
          Original message
        </p>
        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700 font-mono whitespace-pre-wrap break-words">
          {sms.body}
        </div>
      </div>

      {/* Masked body (what was sent to the LLM) */}
      {sms.llm_input_redacted && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1.5">
            Sent to LLM (PII redacted)
          </p>
          <div className="rounded-xl bg-accent-light/30 border border-accent/20 px-4 py-3 text-sm text-gray-700 font-mono whitespace-pre-wrap break-words">
            {sms.llm_input_redacted}
          </div>
        </div>
      )}

      {/* Parsed result */}
      {hasParsedFields && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1.5">
            Parsed result
          </p>
          <dl className="rounded-xl ring-1 ring-gray-100 divide-y divide-gray-50 text-sm">
            <ParsedRow label="Amount" value={sms.parsed_amount ? formatINR(sms.parsed_amount) : '—'} />
            <ParsedRow label="Direction" value={sms.parsed_direction || '—'} />
            <ParsedRow label="Account" value={parsedAccountName || '—'} />
            <ParsedRow label="Category" value={parsedCategoryName || '—'} />
            <ParsedRow label="Beneficiary" value={sms.parsed_beneficiary || '—'} />
            <ParsedRow label="Date" value={sms.parsed_date || '—'} />
            <ParsedRow label="Confidence" value={sms.parse_confidence || '—'} />
          </dl>
          {sms.parse_errors && (
            <p className="text-[11px] text-gray-400 mt-1.5 italic">
              LLM note: {sms.parse_errors}
            </p>
          )}
        </div>
      )}

      {/* Confirm form — only for parsed SMS */}
      {isParsed && (
        <>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-3">
              Confirm as transaction
            </p>

            {/* Type radio */}
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => { setType('expense'); setCategoryId(''); }}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                  type === 'expense'
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => { setType('income'); setCategoryId(''); }}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                  type === 'income'
                    ? 'bg-accent-light text-brand border-accent'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                Income
              </button>
            </div>

            {/* Amount + Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass}>Amount</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-300">₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-8 pr-3 py-2.5 text-sm font-semibold text-gray-900 focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                {errors.amount && <p className={errorClass}>{errors.amount}</p>}
              </div>

              <div>
                <label className={labelClass}>Date</label>
                <CalendarPicker value={date} onChange={(val) => setDate(val)} className="w-full" />
                {errors.date && <p className={errorClass}>{errors.date}</p>}
              </div>
            </div>

            {/* Account */}
            <div className="mb-4">
              <label className={labelClass}>{type === 'income' ? 'Received Into' : 'Paid From'}</label>
              <Select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                options={usableAccounts.map(accountOption)}
                placeholder="Select account"
              />
              {errors.accountId && <p className={errorClass}>{errors.accountId}</p>}
            </div>

            {/* Category */}
            <div className="mb-4">
              <label className={labelClass}>Category</label>
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                options={categoryOptions(filteredCategories)}
                placeholder="Select category"
              />
              {errors.categoryId && <p className={errorClass}>{errors.categoryId}</p>}
            </div>

            {/* Beneficiary + Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Beneficiary</label>
                <input
                  type="text"
                  value={beneficiary}
                  onChange={(e) => setBeneficiary(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={inputClass}
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {errors.submit && (
        <p className="text-sm text-rose-500 text-center">{errors.submit}</p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
        {isConfirmed && sms.transaction && (
          <button
            type="button"
            onClick={handleViewLinkedTxn}
            className="flex-1 min-w-[120px] rounded-xl bg-accent-light text-brand py-2.5 text-sm font-semibold hover:bg-accent/30 transition-colors"
          >
            View linked txn
          </button>
        )}
        {!isConfirmed && sms.status !== 'ignored' && (
          <button
            type="button"
            onClick={handleReparse}
            disabled={actionBusy}
            className="flex-1 min-w-[100px] rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            ↻ Reparse
          </button>
        )}
        {!isConfirmed && (
          <button
            type="button"
            onClick={handleOpenInForm}
            className="flex-1 min-w-[120px] rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Open transaction
          </button>
        )}
        {isParsed && (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 min-w-[120px] rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Confirming…' : 'Confirm'}
          </button>
        )}
      </div>
    </div>
  );
}

function ParsedRow({ label, value }) {
  return (
    <div className="grid grid-cols-3 gap-3 px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</dt>
      <dd className="col-span-2 text-sm text-gray-700 break-words">{value}</dd>
    </div>
  );
}
