import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useOwners } from '../../hooks/useOwners';
import { useApiResource } from '../../hooks/useApiResource';
import api from '../../api/client';
import LoadingSpinner from '../common/LoadingSpinner';
import TypeSelector from './TypeSelector';
import ExpenseForm from './ExpenseForm';
import IncomeForm from './IncomeForm';
import TransferForm from './TransferForm';
import BillPaymentForm from './BillPaymentForm';
import InvestmentForm from './InvestmentForm';
import SplitExpenseForm from './SplitExpenseForm';
import ReimbursementForm from './ReimbursementForm';
import Card from '../common/Card';
import {
  transactionFormReducer,
  makeInitialState,
} from './transactionFormReducer';
import { makePersonId } from './PeopleList';

const PREDEFINED_BENEFICIARIES = ['self', 'family'];

// The detail endpoint returns entries with `account`/`category` FK ids and the
// transaction with `category`; the form helpers below expect the in-app
// `account_id`/`category_id` shape, so normalize once here.
function normalizeDetail(detail) {
  if (!detail) return null;
  return {
    ...detail,
    category_id: detail.category_id ?? detail.category ?? null,
    entries: (detail.entries ?? []).map((e) => ({
      ...e,
      account_id: e.account ?? e.account_id ?? null,
      category_id: e.category ?? e.category_id ?? null,
      transaction_id: e.transaction ?? e.transaction_id,
    })),
  };
}

// Transaction rows hold type/date/notes only; amounts and account refs live
// in the Entry rows. This rebuilds the form-shaped object for edit mode.
function buildInitialData(transaction, entries, accounts, receivables) {
  if (!transaction) return null;

  const txnEntries = entries.filter((e) => e.transaction_id === transaction.id);
  const txnReceivables = (receivables ?? []).filter(
    (r) => r.transaction === transaction.id || r.transaction_id === transaction.id,
  );

  const accountEntries = txnEntries.filter((e) => e.account_id != null);
  const categoryEntries = txnEntries.filter((e) => e.category_id != null);

  const debitAccountEntry = accountEntries.find((e) => e.entry_type === 'DEBIT');
  const creditAccountEntry = accountEntries.find((e) => e.entry_type === 'CREDIT');
  const debitCategoryEntry = categoryEntries.find((e) => e.entry_type === 'DEBIT');
  const creditCategoryEntry = categoryEntries.find((e) => e.entry_type === 'CREDIT');

  const amount = txnEntries[0]?.amount ?? '';

  const base = { ...transaction, amount };

  switch (transaction.type) {
    case 'expense':
      return {
        ...base,
        from_account_id: creditAccountEntry?.account_id ?? '',
        category_id: transaction.category_id ?? debitCategoryEntry?.category_id ?? '',
      };
    case 'income':
      return {
        ...base,
        to_account_id: debitAccountEntry?.account_id ?? '',
        category_id: transaction.category_id ?? creditCategoryEntry?.category_id ?? '',
        source_transaction_id: transaction.source_transaction ?? null,
      };
    case 'transfer':
    case 'bill_payment':
    case 'investment':
      return {
        ...base,
        from_account_id: creditAccountEntry?.account_id ?? '',
        to_account_id: debitAccountEntry?.account_id ?? '',
      };
    case 'split_expense': {
      const totalAmount = creditAccountEntry?.amount ?? '';
      const myShare = debitCategoryEntry?.amount ?? '';
      return {
        ...base,
        from_account_id: creditAccountEntry?.account_id ?? '',
        category_id: transaction.category_id ?? debitCategoryEntry?.category_id ?? '',
        total_amount: totalAmount,
        my_share: myShare,
        receivables: txnReceivables,
      };
    }
    case 'reimbursement':
      return {
        ...base,
        to_account_id: debitAccountEntry?.account_id ?? '',
      };
    default:
      return base;
  }
}

// Flattens a typed initialData object (per-type field names) into the
// reducer's unified values bag, which is shared across types so state
// survives type-switches.
function valuesFromInitialData(initialData, ctx = {}) {
  if (!initialData) return null;
  const v = {};

  if (initialData.amount !== undefined && initialData.amount !== '') {
    v.amount = String(initialData.amount);
  }
  if (initialData.date) v.date = initialData.date;
  if (initialData.notes != null) v.notes = initialData.notes;
  if (initialData.platform != null) v.platform = initialData.platform;
  if (initialData.tags != null) v.tags = initialData.tags;
  if (initialData.owner != null) v.owner = initialData.owner;

  // ExpenseForm splits beneficiary into a type + custom-text pair; IncomeForm
  // reads the raw string. Maintain both so either form can edit.
  if (initialData.beneficiary != null) {
    v.beneficiary = initialData.beneficiary;
    if (PREDEFINED_BENEFICIARIES.includes(initialData.beneficiary)) {
      v.beneficiary_type = initialData.beneficiary;
      v.custom_beneficiary = '';
    } else if (initialData.beneficiary) {
      v.beneficiary_type = 'custom';
      v.custom_beneficiary = initialData.beneficiary;
    }
  }

  if (initialData.from_account_id != null && initialData.from_account_id !== '') {
    v.from_account_id = String(initialData.from_account_id);
  }
  if (initialData.to_account_id != null && initialData.to_account_id !== '') {
    v.to_account_id = String(initialData.to_account_id);
  }
  if (initialData.category_id != null && initialData.category_id !== '') {
    v.category_id = String(initialData.category_id);
  }

  if (initialData.source_transaction_id !== undefined) {
    v.source_transaction_id = initialData.source_transaction_id;
  }

  if (initialData.fee !== undefined && initialData.fee !== '') {
    v.fee = String(initialData.fee);
  }
  if (initialData.fee_category_id !== undefined && initialData.fee_category_id !== '') {
    v.fee_category_id = String(initialData.fee_category_id);
  }

  if (initialData.total_amount != null && initialData.total_amount !== '') {
    v.amount = String(initialData.total_amount);
  }
  if (initialData.my_share != null && initialData.my_share !== '') {
    v.custom_my_share = String(initialData.my_share);
    v.my_share_type = 'custom';
  }
  if (Array.isArray(initialData.receivables) && initialData.receivables.length > 0) {
    v.other_people = initialData.receivables.map((r) => ({
      id: makePersonId(),
      name: r.person_name ?? '',
      amount: String(r.amount_owed ?? ''),
    }));
    v.total_people = String(initialData.receivables.length + 1);
  }

  // Heuristic — match by amount_settled within rounding tolerance, since the
  // settled-receivable id isn't stored on the transaction directly.
  if (
    initialData.type === 'reimbursement' &&
    ctx.receivables &&
    initialData.amount != null
  ) {
    const settled = parseFloat(initialData.amount);
    const match = (ctx.receivables ?? []).find(
      (r) => r.amount_settled > 0 && Math.abs(r.amount_settled - settled) < 0.01,
    );
    if (match) v.selected_receivable_id = String(match.id);
  }

  return v;
}

export default function TransactionForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const refundOfId = searchParams.get('refund_of');
  const fromSmsId = searchParams.get('from_sms');
  const {
    accounts, categories, receivables,
    addTransaction, updateTransaction,
  } = useData();
  const { getAccountOwner } = useOwners();
  const toast = useToast();

  const isEditing = Boolean(id);

  // Edit/refund source rows are fetched on demand (no longer in memory).
  const { data: editDetailRaw, isLoading: editLoading } = useApiResource(
    () => api.getTransaction(id), [id], { skip: !id },
  );
  const { data: refundDetailRaw } = useApiResource(
    () => api.getTransaction(refundOfId), [refundOfId], { skip: !refundOfId },
  );
  const editDetail = useMemo(() => normalizeDetail(editDetailRaw), [editDetailRaw]);
  const refundDetail = useMemo(() => normalizeDetail(refundDetailRaw), [refundDetailRaw]);

  // SMS isn't in DataContext (list can grow large); fetched on demand here.
  const [fromSms, setFromSms] = useState(null);
  useEffect(() => {
    if (!fromSmsId) return;
    let cancelled = false;
    api.getSMSMessage(fromSmsId)
      .then((data) => { if (!cancelled) setFromSms(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fromSmsId]);

  const editInitialData = useMemo(() => {
    if (!editDetail) return null;
    return buildInitialData(editDetail, editDetail.entries, accounts, editDetail.receivables);
  }, [editDetail, accounts]);

  const refundInitialData = useMemo(() => {
    if (!refundDetail) return null;
    const refundCategory = categories.find((c) => c.role === 'refund');
    if (!refundCategory) return null;

    const creditEntry = (refundDetail.entries ?? []).find(
      (e) => e.entry_type === 'CREDIT' && e.account_id,
    );

    return {
      type: 'income',
      date: new Date().toISOString().slice(0, 10),
      amount: creditEntry?.amount ?? '',
      to_account_id: creditEntry?.account_id ?? '',
      owner: refundDetail.owner || (creditEntry?.account_id ? getAccountOwner(creditEntry.account_id) : ''),
      beneficiary: refundDetail.beneficiary ?? '',
      platform: refundDetail.platform ?? '',
      tags: refundDetail.tags ?? '',
      category_id: refundCategory.id,
      source_transaction_id: refundDetail.id,
    };
  }, [refundDetail, categories, getAccountOwner]);

  // null until the SMS fetch resolves; the effect below dispatches
  // LOAD_INITIAL once it does.
  const fromSmsInitialData = useMemo(() => {
    if (!fromSms) return null;
    const txnType = fromSms.parsed_direction === 'credit' ? 'income' : 'expense';
    const base = {
      type: txnType,
      date: fromSms.parsed_date ?? new Date().toISOString().slice(0, 10),
      amount: fromSms.parsed_amount ?? '',
      category_id: fromSms.parsed_category ?? '',
      beneficiary: fromSms.parsed_beneficiary ?? '',
      notes: fromSms.body ?? '',
    };
    if (txnType === 'income') {
      base.to_account_id = fromSms.parsed_account ?? '';
    } else {
      base.from_account_id = fromSms.parsed_account ?? '';
    }
    return base;
  }, [fromSms]);

  // Edit and refund flows seed the initial state synchronously; SMS prefill
  // arrives later via the effect below (async fetch).
  const [state, dispatch] = useReducer(transactionFormReducer, null, () => {
    const initial = editInitialData ?? refundInitialData ?? null;
    if (initial) {
      return makeInitialState({
        type: initial.type,
        initialValues: valuesFromInitialData(initial, { receivables }) ?? undefined,
      });
    }
    return makeInitialState();
  });

  // Edit/refund initial data is fetched by id (async), so load it into the
  // reducer once it resolves. A ref guards against re-firing when accounts/
  // receivables refetch (which would clobber in-progress edits).
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    const initial = editInitialData ?? refundInitialData;
    if (!initial) return;
    initializedRef.current = true;
    dispatch({
      type: 'LOAD_INITIAL',
      payload: {
        type: initial.type,
        values: valuesFromInitialData(initial, { receivables }) ?? {},
      },
    });
  }, [editInitialData, refundInitialData, receivables]);

  // Don't overwrite edit/refund prefill with SMS data (those URL params
  // combined with ?from_sms would be contradictory).
  useEffect(() => {
    if (!fromSmsInitialData) return;
    if (isEditing || refundInitialData) return;
    dispatch({
      type: 'LOAD_INITIAL',
      payload: {
        type: fromSmsInitialData.type,
        values: valuesFromInitialData(fromSmsInitialData) ?? {},
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromSmsInitialData]);

  async function handleSubmit(transactionData) {
    if (state.submitting) return;
    dispatch({ type: 'SUBMITTING', value: true });

    // Backend links and confirms the SMS when sms_id is present.
    const payload = fromSmsId
      ? { ...transactionData, sms_id: parseInt(fromSmsId, 10) }
      : transactionData;

    try {
      if (isEditing) {
        await updateTransaction(parseInt(id), payload);
        toast.success('Transaction updated');
      } else {
        await addTransaction(payload);
        toast.success(fromSmsId ? 'Transaction created and SMS confirmed' : 'Transaction saved');
      }
      navigate(fromSmsId ? '/sms' : '/transactions');
    } catch (err) {
      console.error('TransactionForm: submit failed', err);
      toast.error(err.message || 'Failed to save transaction.');
      dispatch({ type: 'SUBMITTING', value: false });
    }
  }

  const subFormProps = {
    values: state.values,
    errors: state.errors,
    dispatch,
    onSubmit: handleSubmit,
    isEditing,
  };

  function renderSubForm() {
    switch (state.type) {
      case 'expense':       return <ExpenseForm {...subFormProps} />;
      case 'income':        return <IncomeForm {...subFormProps} />;
      case 'transfer':      return <TransferForm {...subFormProps} />;
      case 'bill_payment':  return <BillPaymentForm {...subFormProps} />;
      case 'investment':    return <InvestmentForm {...subFormProps} />;
      case 'split_expense': return <SplitExpenseForm {...subFormProps} />;
      case 'reimbursement': return <ReimbursementForm {...subFormProps} />;
      default:              return null;
    }
  }

  if (isEditing && editLoading) {
    return (
      <div className="max-w-2xl mx-auto py-20 flex justify-center">
        <LoadingSpinner size="h-10 w-10" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-10">
      {/* Back link */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-4"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to Transactions
      </button>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Transaction' : 'New Transaction'}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {isEditing ? 'Update the details of this transaction.' : 'Record a new entry into your finances.'}
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Transaction type card */}
      <Card className="p-5 mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Transaction Type</p>
        <TypeSelector
          value={state.type}
          onChange={(t) => dispatch({ type: 'SET_TYPE', value: t })}
        />
      </Card>

      {/* Form card */}
      <Card className="p-6">
        {state.submitting ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 rounded-full border-[3px] border-brand border-t-transparent animate-spin" />
          </div>
        ) : (
          renderSubForm()
        )}
      </Card>
    </div>
  );
}
