import { useEffect, useMemo, useReducer } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import api from '../../api/client';
import CalendarPicker from '../common/CalendarPicker';
import Select from '../common/Select';
import SMSStatusBadge from './SMSStatusBadge';
import {
  inputClass, labelClass, errorClass, accountOption, categoryOptions,
} from '../../utils/formStyles';
import { formatDate, formatINR } from '../../utils/formatters';
import { effectiveSmsStatus } from '../../utils/sms';
import { D, round2 } from '../../utils/money';

const PREDEFINED_BENEFICIARIES = ['self', 'family'];

function deriveBeneficiaryFields(raw) {
  // LLM usually parses a merchant name ("Swiggy") which is neither 'self' nor
  // 'family' — surface that under "custom" with the value pre-filled.
  const value = (raw ?? '').trim();
  if (PREDEFINED_BENEFICIARIES.includes(value)) {
    return { beneficiary_type: value, custom_beneficiary: '' };
  }
  if (!value) {
    return { beneficiary_type: 'self', custom_beneficiary: '' };
  }
  return { beneficiary_type: 'custom', custom_beneficiary: value };
}

function initialStateFromSms(sms) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    values: {
      type: sms?.parsed_direction === 'credit' ? 'income' : 'expense',
      amount: sms?.parsed_amount ?? '',
      date: sms?.parsed_date ?? today,
      account_id: String(sms?.parsed_account ?? ''),
      category_id: String(sms?.parsed_category ?? ''),
      ...deriveBeneficiaryFields(sms?.parsed_beneficiary),
      notes: '',
    },
    errors: {},
    submitting: false,
    actionBusy: false,
  };
}

function drawerReducer(state, action) {
  switch (action.type) {
    case 'RESET_FROM_SMS':
      return initialStateFromSms(action.sms);

    case 'SET_FIELD': {
      const { name, value } = action;
      const nextErrors = { ...state.errors };
      if (name in nextErrors) delete nextErrors[name];
      return {
        ...state,
        values: { ...state.values, [name]: value },
        errors: nextErrors,
      };
    }

    case 'SET_TYPE': {
      // Expense and income use different category sets, so the old id is
      // rarely valid for the new type.
      const nextErrors = { ...state.errors };
      delete nextErrors.category_id;
      return {
        ...state,
        values: { ...state.values, type: action.value, category_id: '' },
        errors: nextErrors,
      };
    }

    case 'SET_ERRORS':
      return { ...state, errors: action.errors ?? {} };

    case 'SUBMITTING':
      return { ...state, submitting: Boolean(action.value) };

    case 'ACTION_BUSY':
      return { ...state, actionBusy: Boolean(action.value) };

    default:
      return state;
  }
}

/**
 * Detail + confirm modal for an SMS. Shows the original body, the masked
 * version sent to the LLM (for audit), and the parsed fields. When the SMS
 * is parsed and not yet linked, an editable confirm form lets the user
 * commit it as a transaction.
 */
export default function SMSDetailDrawer({ sms, onSuccess, onClose, onViewLinkedTransaction }) {
  const { accounts, categories, confirmSMS } = useData();
  const navigate = useNavigate();
  const toast = useToast();

  const usableAccounts = accounts.filter(
    (a) => (a.type === 'asset' || a.type === 'liability') && a.is_active !== false,
  );

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const isLinked = !!sms?.transaction;
  const canConfirm = !isLinked && sms?.parsed_amount != null;

  const [state, dispatch] = useReducer(drawerReducer, sms, initialStateFromSms);
  const { values, errors, submitting, actionBusy } = state;

  // Re-sync when the user opens a different SMS without closing the modal.
  useEffect(() => {
    if (!sms) return;
    dispatch({ type: 'RESET_FROM_SMS', sms });
  }, [sms?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === values.type),
    [categories, values.type],
  );

  function setField(name, value) {
    dispatch({ type: 'SET_FIELD', name, value });
  }

  function validate() {
    const errs = {};
    const parsed = D(values.amount);
    if (!values.amount || parsed.lte(0)) errs.amount = 'Enter a positive amount.';
    if (!values.date) errs.date = 'Date is required.';
    if (!values.account_id) errs.account_id = 'Select an account.';
    if (!values.category_id) errs.category_id = 'Select a category.';
    if (values.beneficiary_type === 'custom' && !(values.custom_beneficiary ?? '').trim()) {
      errs.custom_beneficiary = 'Enter a beneficiary name.';
    }
    return errs;
  }

  async function handleConfirm() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      dispatch({ type: 'SET_ERRORS', errors: errs });
      return;
    }
    dispatch({ type: 'SUBMITTING', value: true });
    dispatch({ type: 'SET_ERRORS', errors: {} });
    const beneficiary = values.beneficiary_type === 'custom'
      ? values.custom_beneficiary.trim()
      : values.beneficiary_type;
    try {
      await confirmSMS(sms.id, {
        type: values.type,
        amount: round2(D(values.amount)).toString(),
        date: values.date,
        from_account_id: parseInt(values.account_id, 10),
        category_id: parseInt(values.category_id, 10),
        beneficiary,
        notes: values.notes,
      });
      toast.success('SMS confirmed as transaction');
      onSuccess?.();
    } catch (err) {
      const msg = err.message || 'Failed to confirm SMS.';
      dispatch({ type: 'SET_ERRORS', errors: { submit: msg } });
      toast.error(msg);
    } finally {
      dispatch({ type: 'SUBMITTING', value: false });
    }
  }

  async function handleReparse() {
    dispatch({ type: 'ACTION_BUSY', value: true });
    try {
      await api.reparseSMS(sms.id);
      toast.success('SMS reparsed');
      onSuccess?.();
    } catch (err) {
      const msg = err.message || 'Reparse failed.';
      dispatch({ type: 'SET_ERRORS', errors: { submit: msg } });
      toast.error(msg);
    } finally {
      dispatch({ type: 'ACTION_BUSY', value: false });
    }
  }

  function handleViewLinkedTxn() {
    if (onViewLinkedTransaction) {
      onViewLinkedTransaction(sms.transaction);
    }
  }

  function handleUseFullForm() {
    // For types the inline confirm form can't express (transfer, bill_payment,
    // investment, refund, split) — TransactionForm reads `?from_sms` and the
    // backend links the SMS on save via `sms_id`.
    onClose?.();
    navigate(`/transactions/new?from_sms=${sms.id}`);
  }

  if (!sms) return null;

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
        <SMSStatusBadge status={effectiveSmsStatus(sms)} />
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

      {canConfirm && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-3">
            Confirm as transaction
          </p>

          {/* Type radio */}
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_TYPE', value: 'expense' })}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                values.type === 'expense'
                  ? 'bg-brand text-white border-brand'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_TYPE', value: 'income' })}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                values.type === 'income'
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
                  value={values.amount}
                  onChange={(e) => setField('amount', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-8 pr-3 py-2.5 text-sm font-semibold text-gray-900 focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              {errors.amount && <p className={errorClass}>{errors.amount}</p>}
            </div>

            <div>
              <label className={labelClass}>Date</label>
              <CalendarPicker value={values.date} onChange={(val) => setField('date', val)} className="w-full" />
              {errors.date && <p className={errorClass}>{errors.date}</p>}
            </div>
          </div>

          {/* Account */}
          <div className="mb-4">
            <label className={labelClass}>{values.type === 'income' ? 'Received Into' : 'Paid From'}</label>
            <Select
              value={values.account_id}
              onChange={(e) => setField('account_id', e.target.value)}
              options={usableAccounts.map(accountOption)}
              placeholder="Select account"
            />
            {errors.account_id && <p className={errorClass}>{errors.account_id}</p>}
          </div>

          {/* Category */}
          <div className="mb-4">
            <label className={labelClass}>Category</label>
            <Select
              value={values.category_id}
              onChange={(e) => setField('category_id', e.target.value)}
              options={categoryOptions(filteredCategories)}
              placeholder="Select category"
            />
            {errors.category_id && <p className={errorClass}>{errors.category_id}</p>}
          </div>

          {/* Beneficiary + Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div>
              <label className={labelClass}>Notes</label>
              <input
                type="text"
                value={values.notes}
                onChange={(e) => setField('notes', e.target.value)}
                className={inputClass}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>
      )}

      {errors.submit && (
        <p className="text-sm text-rose-500 text-center">{errors.submit}</p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
        {isLinked && (
          <button
            type="button"
            onClick={handleViewLinkedTxn}
            className="flex-1 min-w-[120px] rounded-xl bg-accent-light text-brand py-2.5 text-sm font-semibold hover:bg-accent/30 transition-colors"
          >
            View Linked Transaction
          </button>
        )}
        {!isLinked && (
          <button
            type="button"
            onClick={handleReparse}
            disabled={actionBusy}
            className="flex-1 min-w-[100px] rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            ↻ Reparse
          </button>
        )}
        {!isLinked && (
          <button
            type="button"
            onClick={handleUseFullForm}
            className="flex-1 min-w-[120px] rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Use full form
          </button>
        )}
        {canConfirm && (
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
