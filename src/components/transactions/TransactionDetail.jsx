import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useApiResource } from '../../hooks/useApiResource';
import api from '../../api/client';
import { isDateClosed } from '../../utils/bookClose';
import { formatDate, formatINR, transactionTypeLabel } from '../../utils/formatters';
import { D, sum } from '../../utils/money';
import Badge from '../common/Badge';

export default function TransactionDetail({
  transaction,
  entries: entriesProp,
  onClose,
  onDeleted,
  onSelectTransaction,
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { accounts, categories, deleteTransaction, dataVersion, book_closed_through } = useData();

  // Self-fetch the full detail (entries + refund chain + source) instead of
  // reading the global in-memory transactions/entries arrays.
  const { data: detail } = useApiResource(
    () => api.getTransaction(transaction.id),
    [transaction.id, dataVersion ?? 0],
  );
  const entries = detail?.entries ?? entriesProp ?? [];

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  function resolveEntryName(entry) {
    if (entry.account_id != null) return accountMap.get(entry.account_id)?.name ?? entry.account_id;
    if (entry.category_id != null) return categoryMap.get(entry.category_id)?.name ?? entry.category_id;
    return '—';
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      'Delete this transaction? This cannot be undone.'
    );
    if (!confirmed) return;
    try {
      await deleteTransaction(transaction.id);
      toast.success('Transaction deleted');
      onDeleted?.();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to delete transaction.');
    }
  }

  function handleEdit() {
    navigate(`/transactions/${transaction.id}/edit`);
    onClose();
  }

  function handleRefund() {
    navigate(`/transactions/new?refund_of=${transaction.id}`);
    onClose();
  }

  const sourceTxn = detail?.source_transaction_detail ?? null;

  // Transactions in a closed period are read-only — the server enforces it;
  // the UI hides the mutations. Refunds stay available (they're new
  // transactions in the open period).
  const txnDate = detail?.date ?? transaction.date;
  const inClosedBooks = isDateClosed(txnDate, book_closed_through);

  function handleOpenSource() {
    if (!sourceTxn) return;
    if (onSelectTransaction) {
      onSelectTransaction(sourceTxn);
    } else {
      navigate('/transactions');
      onClose();
    }
  }

  function handleOpenLinkedRefund(refund) {
    if (onSelectTransaction) {
      onSelectTransaction(refund);
    } else {
      navigate('/transactions');
      onClose();
    }
  }

  // Refund chain comes from the detail endpoint (income txns whose
  // source_transaction points at this one), newest first.
  const linkedRefunds = useMemo(() => {
    return [...(detail?.linked_refunds ?? [])].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
  }, [detail]);

  const totalRefunded = sum(linkedRefunds.map((r) => r.amount));

  // Prefer the fetched detail (full record) but fall back to the row/seed prop
  // so the header paints immediately and minimal {id} seeds (e.g. from the SMS
  // drawer or account ledger) still render once the detail loads.
  const t = detail ?? transaction;
  const {
    type, amount, date, notes, beneficiary, platform, tags, created_at,
  } = t;
  const category_id = t.category_id ?? t.category ?? null;
  const categoryName = t.category_name ?? transaction.category_name;

  // useTransactions enriches transactions with `amount`; callers from other
  // pages (SMS modal, account ledger) pass raw rows that have no amount.
  // Fall back to summing entries (debits == credits for a balanced txn).
  const displayAmount = useMemo(() => {
    if (amount != null && amount !== '') return D(amount);
    const debits = sum(entries.filter((e) => e.entry_type === 'DEBIT').map((e) => e.amount));
    const credits = sum(entries.filter((e) => e.entry_type === 'CREDIT').map((e) => e.amount));
    return debits.gt(credits) ? debits : credits;
  }, [amount, entries]);

  // Account info lives in entries; transaction model doesn't store it.
  const accountIds = new Set(accounts.map((a) => a.id));
  const accountEntries = entries.filter((e) => e.account_id != null);
  const debitAccount = accountEntries.find((e) => e.entry_type === 'DEBIT');
  const creditAccount = accountEntries.find((e) => e.entry_type === 'CREDIT');

  let fromName = null;
  let toName = null;
  if (type === 'expense' || type === 'split_expense') {
    fromName = creditAccount ? accountMap.get(creditAccount.account_id)?.name : null;
  } else if (type === 'income' || type === 'reimbursement') {
    toName = debitAccount ? accountMap.get(debitAccount.account_id)?.name : null;
  } else if (type === 'transfer' || type === 'bill_payment' || type === 'investment') {
    fromName = creditAccount ? accountMap.get(creditAccount.account_id)?.name : null;
    toName = debitAccount ? accountMap.get(debitAccount.account_id)?.name : null;
  }

  const detailRows = [
    fromName && { label: 'From Account', value: fromName },
    toName && { label: 'To Account', value: toName },
    category_id && { label: 'Category', value: categoryMap.get(category_id)?.name ?? categoryName ?? category_id },
    beneficiary && { label: 'Beneficiary', value: beneficiary.charAt(0).toUpperCase() + beneficiary.slice(1) },
    platform && { label: 'Platform', value: platform },
    tags?.length > 0 && { label: 'Tags', value: Array.isArray(tags) ? tags.join(', ') : tags },
    notes && { label: 'Notes', value: notes },
    created_at && { label: 'Created', value: formatDate(created_at) },
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-gray-900 leading-tight">
            {notes || transactionTypeLabel(type)}
          </p>
          {date && (
            <p className="text-sm text-gray-400 mt-0.5">{formatDate(date)}</p>
          )}
        </div>
        <Badge type={type} />
      </div>

      {/* Amount */}
      <div className="rounded-2xl bg-brand px-5 py-4 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-brand-muted">Amount</span>
        <p className="text-2xl font-bold text-white tabular-nums">
          {formatINR(displayAmount)}
        </p>
      </div>

      {/* Linked refunds (only for expenses with refunds attached) */}
      {linkedRefunds.length > 0 && (
        <div className="rounded-xl border border-accent/30 bg-accent-light/30 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-wider text-brand font-semibold">
              ↩ Refunded · {formatINR(totalRefunded)}
            </p>
            <p className="text-[11px] text-gray-400">
              Net: {formatINR(D(displayAmount).minus(totalRefunded))}
            </p>
          </div>
          <ul className="divide-y divide-accent/20 text-xs">
            {linkedRefunds.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => handleOpenLinkedRefund(r)}
                  className="w-full flex items-center justify-between py-1.5 text-left rounded hover:bg-accent/10 transition-colors px-1 -mx-1"
                >
                  <span className="text-gray-600">
                    {formatDate(r.date)}{r.notes ? ` · ${r.notes}` : ''}
                  </span>
                  <span className="font-semibold text-brand tabular-nums">
                    {formatINR(r.amount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Details grid */}
      {detailRows.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {detailRows.map(({ label, value }) => (
            <div key={label} className="contents">
              <dt className="text-gray-400 text-xs font-semibold uppercase tracking-wide">{label}</dt>
              <dd className="text-gray-700 font-medium break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Journal entries table */}
      {entries.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Journal Entries
          </p>
          <div className="rounded-xl ring-1 ring-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Account</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Debit</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="bg-white">
                    <td className="px-4 py-2.5 text-gray-700 font-medium truncate max-w-[140px]">
                      {resolveEntryName(entry)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-accent font-medium">
                      {entry.entry_type === 'DEBIT' ? formatINR(entry.amount) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-800 font-medium">
                      {entry.entry_type === 'CREDIT' ? formatINR(entry.amount) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Source-transaction link (refunds and other linked income) */}
      {sourceTxn && (
        <button
          type="button"
          onClick={handleOpenSource}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-left text-xs text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <span className="text-accent">↩</span>
          <span>
            <span className="text-gray-400">Refund of:</span>{' '}
            <span className="font-medium text-gray-700">
              {sourceTxn.notes || sourceTxn.beneficiary || 'Expense'} · {formatDate(sourceTxn.date)}
            </span>
          </span>
        </button>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1 flex-wrap">
        {!inClosedBooks && (
          <button
            onClick={handleEdit}
            className="flex-1 min-w-[100px] rounded-xl bg-brand py-2.5 text-sm
                       font-semibold text-white hover:bg-brand-hover transition-colors"
          >
            Edit
          </button>
        )}
        {type === 'expense' && (
          <button
            onClick={handleRefund}
            className="flex-1 min-w-[100px] rounded-xl border border-accent bg-accent-light py-2.5 text-sm
                       font-semibold text-brand hover:bg-accent/30 transition-colors"
          >
            ↩ Refund
          </button>
        )}
        {!inClosedBooks && (
          <button
            onClick={handleDelete}
            disabled={linkedRefunds.length > 0}
            title={linkedRefunds.length > 0
              ? `Delete the ${linkedRefunds.length === 1 ? 'refund' : `${linkedRefunds.length} refunds`} first.`
              : undefined}
            className="flex-1 min-w-[100px] rounded-xl border border-gray-200 py-2.5 text-sm
                       font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
          >
            Delete
          </button>
        )}
      </div>
      {inClosedBooks && (
        <p className="text-[11px] text-gray-400 text-center">
          🔒 In closed books (through {formatDate(book_closed_through)}) — record corrections as new transactions.
        </p>
      )}
    </div>
  );
}
