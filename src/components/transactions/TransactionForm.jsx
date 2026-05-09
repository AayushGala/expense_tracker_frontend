import { useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useOwners } from '../../hooks/useOwners';
import TypeSelector from './TypeSelector';
import ExpenseForm from './ExpenseForm';
import IncomeForm from './IncomeForm';
import TransferForm from './TransferForm';
import BillPaymentForm from './BillPaymentForm';
import InvestmentForm from './InvestmentForm';
import SplitExpenseForm from './SplitExpenseForm';
import ReimbursementForm from './ReimbursementForm';
import Card from '../common/Card';

/**
 * Reconstruct form-friendly fields from a transaction + its entries.
 * The Transaction model only stores type/date/notes/etc.
 * The amounts and account references live in the Entry objects.
 */
function buildInitialData(transaction, entries, accounts, receivables) {
  if (!transaction) return null;

  const txnEntries = entries.filter(
    (e) => e.transaction_id === transaction.id
  );
  const txnReceivables = (receivables ?? []).filter(
    (r) => r.transaction === transaction.id || r.transaction_id === transaction.id
  );

  // Separate entries into account entries and category entries
  const accountEntries = txnEntries.filter((e) => e.account_id != null);
  const categoryEntries = txnEntries.filter((e) => e.category_id != null);

  const debitAccountEntry = accountEntries.find((e) => e.entry_type === 'DEBIT');
  const creditAccountEntry = accountEntries.find((e) => e.entry_type === 'CREDIT');
  const debitCategoryEntry = categoryEntries.find((e) => e.entry_type === 'DEBIT');
  const creditCategoryEntry = categoryEntries.find((e) => e.entry_type === 'CREDIT');

  // Amount from any entry (they should all have the same absolute amount)
  const amount = txnEntries[0]?.amount ?? '';

  const base = {
    ...transaction,
    amount,
  };

  switch (transaction.type) {
    case 'expense':
      // CREDIT account = from_account, DEBIT category = category
      return {
        ...base,
        from_account_id: creditAccountEntry?.account_id ?? '',
        category_id: transaction.category_id ?? debitCategoryEntry?.category_id ?? '',
      };

    case 'income':
      // DEBIT account = to_account, CREDIT category = entry category (may be source's category for refunds)
      return {
        ...base,
        to_account_id: debitAccountEntry?.account_id ?? '',
        category_id: transaction.category_id ?? creditCategoryEntry?.category_id ?? '',
        source_transaction_id: transaction.source_transaction ?? null,
      };

    case 'transfer':
    case 'bill_payment':
    case 'investment':
      // DEBIT account = to_account, CREDIT account = from_account
      return {
        ...base,
        from_account_id: creditAccountEntry?.account_id ?? '',
        to_account_id: debitAccountEntry?.account_id ?? '',
      };

    case 'split_expense': {
      // CREDIT account entry = total_amount paid from bank
      // DEBIT category entry = my_share
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

export default function TransactionForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const refundOfId = searchParams.get('refund_of');
  const { transactions, entries, accounts, categories, receivables, addTransaction, updateTransaction } = useData();
  const { getAccountOwner } = useOwners();

  const isEditing = Boolean(id);

  // Find existing transaction and reconstruct form data from entries
  const initialData = useMemo(() => {
    if (!id) return null;
    const txn = transactions.find((t) => String(t.id) === String(id));
    if (!txn) return null;
    return buildInitialData(txn, entries, accounts, receivables);
  }, [id, transactions, entries, accounts, receivables]);

  // Refund-from-expense flow: ?refund_of=<txn_id> pre-populates a refund form
  const refundInitialData = useMemo(() => {
    if (!refundOfId) return null;
    const sourceTxn = transactions.find((t) => String(t.id) === String(refundOfId));
    if (!sourceTxn) return null;
    const refundCategory = categories.find((c) => c.role === 'refund');
    if (!refundCategory) return null;

    const sourceEntries = entries.filter((e) => e.transaction_id === sourceTxn.id);
    const creditEntry = sourceEntries.find((e) => e.entry_type === 'CREDIT' && e.account_id);

    return {
      type: 'income',
      date: new Date().toISOString().slice(0, 10),
      amount: creditEntry?.amount ?? '',
      to_account_id: creditEntry?.account_id ?? '',
      owner: creditEntry?.account_id ? getAccountOwner(creditEntry.account_id) : '',
      category_id: refundCategory.id,
      source_transaction_id: sourceTxn.id,
    };
  }, [refundOfId, transactions, entries, categories, getAccountOwner]);

  const [type, setType] = useState(
    refundInitialData?.type ?? initialData?.type ?? 'expense'
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(transactionData) {
    if (submitting) return;
    setSubmitting(true);

    try {
      if (isEditing) {
        await updateTransaction(parseInt(id), transactionData);
      } else {
        await addTransaction(transactionData);
      }
      navigate('/transactions');
    } catch (err) {
      console.error('TransactionForm: submit failed', err);
      setSubmitting(false);
    }
  }

  // When type changes during editing, only carry over shared fields
  const formInitialData = (() => {
    // Refund-from-expense flow takes precedence
    if (refundInitialData) return refundInitialData;
    if (!initialData) return null;
    if (type === initialData.type) return initialData;
    // Type changed — keep only shared fields, clear type-specific ones
    return {
      amount: initialData.amount,
      date: initialData.date,
      notes: initialData.notes,
      platform: initialData.platform,
      owner: initialData.owner,
      tags: initialData.tags,
      beneficiary: initialData.beneficiary,
    };
  })();

  const formProps = {
    onSubmit: handleSubmit,
    initialData: formInitialData,
  };

  function renderSubForm() {
    switch (type) {
      case 'expense':       return <ExpenseForm {...formProps} />;
      case 'income':        return <IncomeForm {...formProps} />;
      case 'transfer':      return <TransferForm {...formProps} />;
      case 'bill_payment':  return <BillPaymentForm {...formProps} />;
      case 'investment':    return <InvestmentForm {...formProps} />;
      case 'split_expense': return <SplitExpenseForm {...formProps} />;
      case 'reimbursement': return <ReimbursementForm {...formProps} />;
      default:              return null;
    }
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
        <TypeSelector value={type} onChange={setType} />
      </Card>

      {/* Form card */}
      <Card className="p-6">
        {submitting ? (
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
